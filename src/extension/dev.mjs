import { spawn, spawnSync } from "node:child_process";
import {
  copyFile,
  mkdtemp,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveProjectPath } from "../config.mjs";

export async function launchExtensionDevelopment(config) {
  const development = config.extension.dev;

  if (!development?.fixtureFile) {
    throw new Error(
      "Extension development launch requires extension.dev.fixtureFile.",
    );
  }

  const codeCommand =
    process.env.CODE_COMMAND ??
    development.codeCommand ??
    "code";
  const check = spawnSync(codeCommand, ["--version"], {
    stdio: "ignore",
  });

  if (check.error?.code === "ENOENT") {
    throw new Error(
      "Install the VS Code 'code' shell command or set CODE_COMMAND.",
    );
  }

  const temporaryDirectory = await mkdtemp(
    path.join(
      process.platform === "darwin" ? "/tmp" : os.tmpdir(),
      "vscode-extension-dev-",
    ),
  );
  const workspaceDirectory = path.join(
    temporaryDirectory,
    "workspace",
  );
  const extensionsDirectory = path.join(
    temporaryDirectory,
    "extensions",
  );
  const userDirectory = path.join(
    temporaryDirectory,
    "user",
  );
  const settingsDirectory = path.join(
    userDirectory,
    "User",
  );

  try {
    await Promise.all([
      mkdir(workspaceDirectory, { recursive: true }),
      mkdir(extensionsDirectory, { recursive: true }),
      mkdir(settingsDirectory, { recursive: true }),
    ]);

    const fixture = resolveProjectPath(
      config,
      development.fixtureFile,
    );
    const destination = path.join(
      workspaceDirectory,
      path.basename(fixture),
    );

    await copyFile(fixture, destination);
    await writeFile(
      path.join(settingsDirectory, "settings.json"),
      JSON.stringify(development.settings ?? {}, null, 2),
    );

    const child = spawn(
      codeCommand,
      [
        "--new-window",
        "--wait",
        ...(development.launchArgs ?? []),
        `--extensionDevelopmentPath=${resolveProjectPath(
          config,
          config.extension.developmentPath ??
            "dist/vscode-extension",
        )}`,
        `--user-data-dir=${userDirectory}`,
        `--extensions-dir=${extensionsDirectory}`,
        workspaceDirectory,
        destination,
      ],
      {
        stdio: "inherit",
      },
    );

    await new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0
          ? resolve()
          : reject(
              new Error(
                `${codeCommand} exited with ${code}`,
              ),
            ),
      );
    });
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
}
