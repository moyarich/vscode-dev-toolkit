import assert from "node:assert/strict";
import test from "node:test";

test("workspace package preserves public import paths", async () => {
  for (const entry of [
    "@moyarich/vscode-dev-toolkit",
    "@moyarich/vscode-dev-toolkit/demo",
    "@moyarich/vscode-dev-toolkit/extension",
  ]) {
    const exported = await import(entry);
    assert.ok(Object.keys(exported).length > 0, `${entry} exports symbols`);
  }
});
