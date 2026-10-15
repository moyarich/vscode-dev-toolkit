import {
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { resolveProjectPath } from "../config.mjs";

export async function readExtensionManifest(config) {
  return JSON.parse(
    await readFile(
      resolveProjectPath(
        config,
        config.extension.manifestFile ??
          "extension.manifest.json",
      ),
      "utf8",
    ),
  );
}

export async function stageExtension(config) {
  const manifest = await readExtensionManifest(config);
  const npmPackage = JSON.parse(
    await readFile(
      resolveProjectPath(
        config,
        config.extension.packageFile ?? "package.json",
      ),
      "utf8",
    ),
  );

  if (manifest.version !== npmPackage.version) {
    throw new Error(
      "Keep package.json and the VS Code extension manifest versions in sync before building.",
    );
  }

  const extensionDirectory = resolveProjectPath(
    config,
    config.extension.developmentPath ??
      "dist/vscode-extension",
  );
  const artifactDirectory = resolveProjectPath(
    config,
    config.extension.artifactDirectory ?? "artifacts",
  );
  const runtimeFiles = config.extension.runtimeFiles ?? [
    "dist/extension.cjs",
    "README.md",
    "LICENSE",
    "CHANGELOG.md",
  ];

  await rm(extensionDirectory, {
    recursive: true,
    force: true,
  });
  await mkdir(extensionDirectory, { recursive: true });
  await writeFile(
    path.join(extensionDirectory, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  for (const file of runtimeFiles) {
    const destination = path.join(extensionDirectory, file);

    await mkdir(path.dirname(destination), {
      recursive: true,
    });
    await copyFile(
      resolveProjectPath(config, file),
      destination,
    );
  }

  return {
    manifest,
    extensionDirectory,
    artifactDirectory,
  };
}
