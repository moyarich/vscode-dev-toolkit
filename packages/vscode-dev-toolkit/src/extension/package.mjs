import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  createVSIX,
  listFiles,
} from "@vscode/vsce";
import { stageExtension } from "./stage.mjs";

export async function packageExtension(
  config,
  { list = false } = {},
) {
  const {
    manifest,
    extensionDirectory,
    artifactDirectory,
  } = await stageExtension(config);
  const options = {
    cwd: extensionDirectory,
    dependencies: false,
    packagedDependencies: [],
  };

  if (list) {
    const files = await listFiles(options);
    console.log(files.join("\n"));
    return files;
  }

  await mkdir(artifactDirectory, { recursive: true });

  const packagePath = path.join(
    artifactDirectory,
    `${manifest.name}-${manifest.version}.vsix`,
  );

  await createVSIX({
    ...options,
    packagePath,
  });

  console.log(`Extension package: ${packagePath}`);

  return packagePath;
}
