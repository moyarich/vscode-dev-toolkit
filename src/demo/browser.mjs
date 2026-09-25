import { createRequire } from "node:module";
import { runProcess } from "../process.mjs";

export async function installDemoBrowser({
  browser = "chromium",
} = {}) {
  const cli = createRequire(import.meta.url).resolve(
    "playwright-core/cli",
  );

  await runProcess(process.execPath, [
    cli,
    "install",
    browser,
  ]);
}
