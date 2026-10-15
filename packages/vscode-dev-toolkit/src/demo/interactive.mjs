import { spawnSync } from "node:child_process";
import { createReadmeGifs } from "./gif.mjs";
import { createScenarioRegistry } from "./scenarios.mjs";
import { runSelectedScenarios } from "./run-cli.mjs";

function runFzf(lines, args) {
  const result = spawnSync("fzf", args, {
    input: `${lines.join("\n")}\n`,
    encoding: "utf8",
  });

  if (result.error?.code === "ENOENT") {
    throw new Error(
      "Interactive demos require fzf. Install fzf or use the non-interactive demo commands.",
    );
  }

  if (result.status !== 0) {
    return "";
  }

  return result.stdout.trim();
}

export async function runInteractiveDemoCli({ config }) {
  const { scenarios } = await createScenarioRegistry({ config });
  const selected = runFzf(
    ["all", ...Object.keys(scenarios)],
    [
      "--multi",
      "--height=80%",
      "--layout=reverse",
      "--border",
      "--info=inline-right",
      "--marker=✓ ",
      "--pointer=▶",
      "--prompt=Scenarios › ",
      "--bind=ctrl-a:select-all,ctrl-d:deselect-all",
      "--header=Tab: toggle  Ctrl+A: select all  Ctrl+D: clear  Enter: continue  Esc: cancel",
    ],
  );

  if (!selected) {
    return;
  }

  const selectedNames = selected.split("\n");
  const selection = selectedNames.includes("all")
    ? "all"
    : selectedNames.join(",");

  const action = runFzf(
    [
      "Record new video, then create GIF",
      "Record new video only",
      "Create GIF from existing video (do not record)",
    ],
    [
      "--height=40%",
      "--layout=reverse",
      "--border",
      "--info=hidden",
      "--pointer=▶",
      "--prompt=Action › ",
      "--header=↑/↓: choose  Enter: run  Esc: cancel",
    ],
  );

  if (!action) {
    return;
  }

  if (action === "Record new video only") {
    await runSelectedScenarios({
      config,
      selection,
    });
    return;
  }

  await createReadmeGifs({
    config,
    selection,
    record:
      action === "Record new video, then create GIF",
  });
}
