import {
  access,
  mkdtemp,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { downloadAndUnzipVSCode, runTests } from "@vscode/test-electron";
import { chromium } from "playwright-core";
import { resolveProjectPath, toFilePath } from "../config.mjs";
import { runProcess } from "../process.mjs";

const extensionHostPath = fileURLToPath(
  new URL("./extension-host.cjs", import.meta.url),
);

export const pause = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function ensureBuiltExtension(config) {
  const developmentPath = resolveProjectPath(
    config,
    config.extension.developmentPath ?? "dist/vscode-extension",
  );
  const packageFile = path.join(developmentPath, "package.json");

  try {
    await access(packageFile);
  } catch {
    const command = config.extension.buildCommand ?? {
      command: "npm",
      args: ["run", "build"],
    };

    await runProcess(command.command, command.args ?? [], {
      cwd: toFilePath(config.projectDirectory),
    });
    await access(packageFile);
  }
}

export async function prepareVSCodeRuntime({ config }) {
  await ensureBuiltExtension(config);

  return downloadAndUnzipVSCode({
    version: process.env.VSCODE_VERSION ?? "stable",
    cachePath: resolveProjectPath(
      config,
      config.demo?.vscodeCacheDirectory ?? ".vscode-test",
    ),
  });
}

async function freePort() {
  const server = createServer();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const port = server.address().port;

  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );

  return port;
}

async function waitForVSCodeDevTools({ remoteDebuggingPort }) {
  const endpoint = `http://127.0.0.1:${remoteDebuggingPort}`;
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${endpoint}/json/version`);

      if (response.ok) {
        return endpoint;
      }
    } catch {
      // VS Code is still starting.
    }

    await pause(250);
  }

  throw new Error("Timed out waiting for the VS Code demo window.");
}

async function findVSCodeWorkbenchPage(browser) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const pages = browser.contexts().flatMap((context) => context.pages());
    const workbench = pages.find((page) => page.url().includes("workbench"));

    if (workbench) {
      await workbench.locator(".monaco-workbench").waitFor({
        timeout: 30_000,
      });

      return workbench;
    }

    await pause(250);
  }

  throw new Error("VS Code opened, but the workbench page was not found.");
}

export async function createVSCodeRuntime({
  config,
  scenario,
  vscodeExecutablePath,
  codegen = false,
}) {
  const projectDirectory = toFilePath(config.projectDirectory);
  const temporaryDirectory = await mkdtemp(
    path.join(
      process.platform === "darwin" ? "/tmp" : os.tmpdir(),
      "vscode-demo-",
    ),
  );
  const workspaceDirectory = path.join(temporaryDirectory, "workspace");
  const userDataDirectory = path.join(temporaryDirectory, "user");
  const completionFile = path.join(temporaryDirectory, "done");
  const remoteDebuggingPort = await freePort();

  let browser;
  let testRun;

  try {
    await mkdir(workspaceDirectory, { recursive: true });
    await mkdir(path.join(userDataDirectory, "User"), { recursive: true });
    await mkdir(path.join(temporaryDirectory, "extensions"), {
      recursive: true,
    });

    await writeFile(
      path.join(userDataDirectory, "User/settings.json"),
      JSON.stringify(config.demo?.settings ?? {}, null, 2),
    );

    const sourceFile = path.join(workspaceDirectory, scenario.fileName);
    await mkdir(path.dirname(sourceFile), { recursive: true });
    await writeFile(sourceFile, scenario.source);

    const hostSetup = config.demo?.extensionHostSetup
      ? resolveProjectPath(config, config.demo.extensionHostSetup)
      : "";

    testRun = runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath: resolveProjectPath(
        config,
        config.extension.developmentPath ?? "dist/vscode-extension",
      ),
      extensionTestsPath: extensionHostPath,
      extensionTestsEnv: {
        VSCODE_DEV_TOOLKIT_COMPLETION_FILE: completionFile,
        VSCODE_DEV_TOOLKIT_SOURCE_FILE: sourceFile,
        VSCODE_DEV_TOOLKIT_EXTENSION_ID: config.extension.id,
        VSCODE_DEV_TOOLKIT_HOST_SETUP: hostSetup,
        VSCODE_DEV_TOOLKIT_CODEGEN: codegen ? "1" : "0",
      },
      launchArgs: [
        workspaceDirectory,
        sourceFile,
        `--user-data-dir=${userDataDirectory}`,
        `--extensions-dir=${path.join(temporaryDirectory, "extensions")}`,
        `--remote-debugging-port=${remoteDebuggingPort}`,
        ...(config.demo?.launchArgs ?? []),
      ],
    });

    let hostFailure;
    testRun.catch((error) => {
      hostFailure = error;
    });

    const endpoint = await waitForVSCodeDevTools({ remoteDebuggingPort });

    if (hostFailure) {
      throw hostFailure;
    }

    browser = await chromium.connectOverCDP(endpoint);
    const page = await findVSCodeWorkbenchPage(browser);
    const viewport = config.demo?.viewport ?? {
      width: 1280,
      height: 900,
    };

    await page.bringToFront();
    await page.setViewportSize(viewport);

    await config.demo?.waitForReady?.({
      page,
      scenario,
      sourceFile,
      workspaceDirectory,
      temporaryDirectory,
    });

    return {
      page,
      browser,
      sourceFile,
      workspaceDirectory,
      temporaryDirectory,

      async complete() {
        await writeFile(completionFile, "done");
        await testRun;
      },

      async dispose() {
        await writeFile(completionFile, "done").catch(() => undefined);
        await testRun?.catch(() => undefined);
        await browser?.close().catch(() => undefined);
        await rm(temporaryDirectory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await writeFile(completionFile, "done").catch(() => undefined);
    await testRun?.catch(() => undefined);
    await browser?.close().catch(() => undefined);
    await rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
}
