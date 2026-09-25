/* eslint-disable @typescript-eslint/no-require-imports -- VS Code loads this entry through CommonJS. */
const assert = require("node:assert/strict");
const { access } = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
const vscode = require("vscode");

exports.run = async function run() {
  const completionFile = process.env.VSCODE_DEV_TOOLKIT_COMPLETION_FILE;
  const sourceFile = process.env.VSCODE_DEV_TOOLKIT_SOURCE_FILE;
  const extensionId = process.env.VSCODE_DEV_TOOLKIT_EXTENSION_ID;
  const setupFile = process.env.VSCODE_DEV_TOOLKIT_HOST_SETUP;

  assert.ok(
    completionFile && sourceFile && extensionId,
    "VS Code dev toolkit host paths and extension ID are required.",
  );

  const extension = vscode.extensions.getExtension(extensionId);
  assert.ok(extension, `Extension must be loaded: ${extensionId}`);

  await extension.activate();

  if (setupFile) {
    const setup = await import(pathToFileURL(setupFile).href);
    const prepare = setup.prepare ?? setup.default;

    assert.equal(
      typeof prepare,
      "function",
      "Extension host setup module must export prepare() or a default function.",
    );

    await prepare({
      vscode,
      extension,
      sourceFile,
    });
  } else {
    const document = await vscode.workspace.openTextDocument(
      vscode.Uri.file(sourceFile),
    );
    await vscode.window.showTextDocument(document);
  }

  const deadline =
    process.env.VSCODE_DEV_TOOLKIT_CODEGEN === "1"
      ? Infinity
      : Date.now() + 120000;

  while (Date.now() < deadline) {
    try {
      await access(completionFile);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error("Timed out waiting for the VS Code demo recorder.");
};
