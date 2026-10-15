import {
  access,
  mkdir,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import { resolveProjectPath } from "../config.mjs";
import { runProcess } from "../process.mjs";
import { createScenarioRegistry } from "./scenarios.mjs";
import { runSelectedScenarios } from "./run-cli.mjs";
import { ensureVideoEncoder } from "./video-recorder.mjs";

function positiveNumber({ value, fallback, minimum }) {
  const parsed = Number(value ?? fallback);

  return Number.isFinite(parsed)
    ? Math.max(minimum, parsed)
    : fallback;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function createReadmeGifs({
  config,
  selection = "all",
  record = true,
}) {
  await ensureVideoEncoder();

  if (record) {
    await runSelectedScenarios({
      config,
      selection,
      codegen: false,
    });
  }

  const artifactsDirectory = resolveProjectPath(
    config,
    config.demo?.artifactsDirectory ?? "demo/artifacts",
  );
  const mediaDirectory = resolveProjectPath(
    config,
    config.demo?.mediaDirectory ?? "media",
  );
  const gif = config.demo?.gif ?? {};
  const fps = positiveNumber({
    value: process.env.VSCODE_DEMO_GIF_FPS,
    fallback: gif.fps ?? 12,
    minimum: 1,
  });
  const width = positiveNumber({
    value: process.env.VSCODE_DEMO_GIF_WIDTH,
    fallback: gif.width ?? 960,
    minimum: 320,
  });
  const trimStart = positiveNumber({
    value: process.env.VSCODE_DEMO_GIF_TRIM_START,
    fallback: gif.trimStart ?? 1,
    minimum: 0,
  });

  await mkdir(artifactsDirectory, { recursive: true });
  await mkdir(mediaDirectory, { recursive: true });

  const { selectScenarios } =
    await createScenarioRegistry({ config });
  const requested = new Set(selectScenarios(selection));
  const entries = await readdir(artifactsDirectory, {
    withFileTypes: true,
  });

  const filter = [
    `trim=start=${trimStart}`,
    "setpts=PTS-STARTPTS",
    `fps=${fps}`,
    `scale='min(${width},iw)':-2:flags=lanczos`,
    "split[a][b]",
    "[a]palettegen=max_colors=256:reserve_transparent=0:stats_mode=full[p]",
    "[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle",
  ].join(",");

  for (const entry of entries) {
    if (!entry.isDirectory() || !requested.has(entry.name)) {
      continue;
    }

    const source = path.join(
      artifactsDirectory,
      entry.name,
      `${entry.name}.webm`,
    );

    if (!(await exists(source))) {
      continue;
    }

    const destination = path.join(
      mediaDirectory,
      `${entry.name}.gif`,
    );

    await runProcess("ffmpeg", [
      "-y",
      "-i",
      source,
      "-filter_complex",
      filter,
      "-gifflags",
      "+transdiff",
      "-loop",
      "0",
      destination,
    ]);

    console.log(`README GIF created: ${destination}`);
  }
}

export async function runGifCli({
  config,
  argv = process.argv.slice(2),
}) {
  const selection =
    argv
      .find((argument) => argument.startsWith("--scenario="))
      ?.slice("--scenario=".length) ?? "all";

  await createReadmeGifs({
    config,
    selection,
    record: !argv.includes("--no-record"),
  });
}
