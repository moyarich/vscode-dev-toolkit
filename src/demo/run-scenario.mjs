import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProjectPath } from "../config.mjs";
import { captureScenario } from "./codegen-recorder.mjs";
import {
  createVSCodeRuntime,
  pause,
  prepareVSCodeRuntime,
} from "./vscode-runtime.mjs";
import {
  createFrameRecorder,
  encodeRecording,
  ensureVideoEncoder,
} from "./video-recorder.mjs";
import {
  hideDemoCaption,
  showDemoCaption,
} from "./ui/caption/install.mjs";
import {
  installDemoMagnifierCursorOverlay,
  pointDemoMagnifierCursorAt,
  removeDemoMagnifierCursorOverlay,
} from "./ui/magnifier/install.mjs";

export function isDirectScenario(moduleUrl) {
  return Boolean(
    process.argv[1] &&
      path.resolve(process.argv[1]) ===
        path.resolve(fileURLToPath(moduleUrl)),
  );
}

export async function prepareDemoRuntime({ config, codegen = false }) {
  if (!codegen) {
    await ensureVideoEncoder();
  }

  return prepareVSCodeRuntime({ config });
}

export async function runScenario({
  config,
  name,
  scenario,
  vscodeExecutablePath,
  codegen = false,
}) {
  if (!scenario?.fileName || typeof scenario.source !== "string") {
    throw new Error(`Scenario "${name}" must define fileName and source.`);
  }

  if (!codegen && typeof scenario.run !== "function") {
    throw new Error(
      `Scenario "${name}" must define run({ page, ...helpers }).`,
    );
  }

  const executable =
    vscodeExecutablePath ??
    (await prepareDemoRuntime({
      config,
      codegen,
    }));
  const artifactsDirectory = resolveProjectPath(
    config,
    config.demo?.artifactsDirectory ?? "demo/artifacts",
  );
  const outputDirectory = path.join(artifactsDirectory, name);
  const framesDirectory = path.join(outputDirectory, "frames");
  const runtime = await createVSCodeRuntime({
    config,
    scenario,
    vscodeExecutablePath: executable,
    codegen,
  });

  let recorder;

  try {
    if (codegen) {
      await captureScenario({
        config,
        page: runtime.page,
        name,
        baseScenarioName: scenario.baseScenarioName ?? scenario.name ?? name,
      });

      return;
    }

    await rm(framesDirectory, { recursive: true, force: true });
    await mkdir(framesDirectory, { recursive: true });

    recorder = createFrameRecorder({
      page: runtime.page,
      framesDirectory,
      frameRate: config.demo?.frameRate ?? 10,
    });

    await recorder.start();

    await scenario.run({
      page: runtime.page,
      browser: runtime.browser,
      name,
      workspaceDirectory: runtime.workspaceDirectory,
      temporaryDirectory: runtime.temporaryDirectory,
      outputDirectory,
      projectDirectory: resolveProjectPath(config, "."),
      pause,
      showDemoCaption,
      hideDemoCaption,
      installDemoMagnifierCursorOverlay,
      pointDemoMagnifierCursorAt,
      removeDemoMagnifierCursorOverlay,
    });

    await recorder.stop();

    await encodeRecording({
      framesDirectory,
      recordingPath: path.join(outputDirectory, `${name}.webm`),
      frameRate: config.demo?.frameRate ?? 10,
    });

    await runtime.complete();

    console.log(`Recorded ${name}: ${outputDirectory}`);
  } finally {
    await recorder?.stop().catch(() => undefined);
    await runtime.dispose();
  }
}

export async function runScenarioModule({
  config,
  moduleUrl,
  name,
  scenario,
}) {
  if (!isDirectScenario(moduleUrl)) {
    return;
  }

  const codegen = process.argv.includes("--codegen");
  const executable = await prepareDemoRuntime({
    config,
    codegen,
  });

  await runScenario({
    config,
    name,
    scenario,
    vscodeExecutablePath: executable,
    codegen,
  });
}
