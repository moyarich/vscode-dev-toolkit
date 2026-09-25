import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { resolveProjectPath } from "../config.mjs";
import { readExtensionManifest } from "./stage.mjs";

export async function publishOpenVSX(
  config,
  { tokenEnvironmentVariable = "OVSX_PAT" } = {},
) {
  if (!process.env[tokenEnvironmentVariable]) {
    throw new Error(
      `Set ${tokenEnvironmentVariable} to an Open VSX token before publishing.`,
    );
  }

  const manifest = await readExtensionManifest(config);
  const artifactDirectory = resolveProjectPath(
    config,
    config.extension.artifactDirectory ?? "artifacts",
  );
  const packagePath = path.join(
    artifactDirectory,
    `${manifest.name}-${manifest.version}.vsix`,
  );

  await access(packagePath);

  const child = spawn(
    process.execPath,
    [
      createRequire(import.meta.url).resolve("ovsx/bin/ovsx"),
      "publish",
      packagePath,
    ],
    {
      stdio: "inherit",
      env: process.env,
    },
  );

  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`ovsx exited with ${code}`)),
    );
  });
}
