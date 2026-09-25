import {
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolveProjectPath } from "../config.mjs";

export async function writeExtensionSource(config) {
  const source = config.extension.source;

  if (!source) {
    return;
  }

  const extensionSource = await readFile(
    resolveProjectPath(config, source.input),
    "utf8",
  );

  await Promise.all([
    writeFile(
      resolveProjectPath(config, source.module),
      `const extensionSource = ${JSON.stringify(
        extensionSource,
      )};\n\nexport default extensionSource;\n`,
    ),
    writeFile(
      resolveProjectPath(config, source.types),
      "declare const extensionSource: string;\n\nexport default extensionSource;\n",
    ),
  ]);
}
