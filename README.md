# @moyarich/vscode-dev-toolkit

Reusable development tooling for VS Code extensions.

`@moyarich/vscode-dev-toolkit` centralizes the infrastructure that otherwise
gets copied from one extension repository to the next: disposable VS Code
workspaces, Playwright-driven demos, scenario recording, README GIF generation,
VSIX staging and packaging, Open VSX publishing, and extension-development
launching.

The extension keeps its own behavior and configuration. The toolkit owns the
reusable machinery.

## Features

- Launch isolated VS Code instances with `@vscode/test-electron`.
- Attach Playwright to the VS Code workbench over CDP.
- Run self-contained demo scenarios directly with Node.
- Record screenshots and WebM demo videos.
- Capture Playwright Inspector interactions as runnable scenario modules.
- Inject reusable caption and magnifier overlays into demo recordings.
- Convert recordings into README GIFs with FFmpeg.
- Launch disposable desktop extension-development workspaces.
- Stage extension files into a clean VS Code extension directory.
- Package VSIX files with `@vscode/vsce`.
- Publish existing VSIX files to Open VSX.
- Generate an ESM module containing a built extension bundle as source text.

## Requirements

- Node.js `^22.13.0 || >=24`.
- A graphical desktop for VS Code demo recording.
- `ffmpeg` for video and GIF generation.
- `fzf` only when using the interactive demo chooser.
- The VS Code `code` command, or `CODE_COMMAND`, only when using the desktop
  development launcher.
- An `OVSX_PAT` environment variable when publishing to Open VSX.

Playwright Inspector recording currently relies on Playwright's internal
recorder API for an already-running VS Code/Electron page. The toolkit pins
`playwright-core` so that integration stays isolated here rather than leaking
into every consuming extension.

## Install

The package can be consumed directly from GitHub; it does not need to be
published to npm first.

During active development:

```json
{
  "devDependencies": {
    "@moyarich/vscode-dev-toolkit": "github:moyarich/vscode-dev-toolkit#main"
  }
}
```

For reproducible installs, pin an exact commit:

```json
{
  "devDependencies": {
    "@moyarich/vscode-dev-toolkit": "git+https://github.com/moyarich/vscode-dev-toolkit.git#<commit-sha>"
  }
}
```

## Recommended extension structure

A consuming extension can stay small:

```text
my-vscode-extension/
├── vscode-dev.config.mjs
├── extension.manifest.json
├── package.json
├── demo/
│   ├── run.mjs
│   ├── gif.mjs
│   ├── interactive.mjs
│   ├── setup.mjs
│   ├── dev.mjs
│   ├── prepare-extension-host.mjs
│   ├── dev/
│   │   └── fixtures/
│   └── scenarios/
│       ├── index.mjs
│       ├── basic.mjs
│       └── generated/
└── scripts/
    ├── build.mjs
    ├── package-extension.mjs
    └── publish-extension.mjs
```

The extension-specific pieces are:

- its configuration;
- its scenarios and fixtures;
- optional extension-host preparation/validation;
- its build command;
- small entrypoint files that call the toolkit.

The VS Code runtime, Playwright integration, video recorder, GIF converter,
demo overlays, packaging helpers, and publishing helpers stay in this package.

## Configure an extension

Create `vscode-dev.config.mjs` in the consuming extension:

```js
import {
  defineVSCodeDevConfig,
} from "@moyarich/vscode-dev-toolkit";

export default defineVSCodeDevConfig({
  configFile: new URL(import.meta.url),
  projectDirectory: new URL("./", import.meta.url),

  extension: {
    id: "publisher.my-extension",
    developmentPath: "dist/vscode-extension",
    manifestFile: "extension.manifest.json",
    packageFile: "package.json",
    artifactDirectory: "artifacts",

    runtimeFiles: [
      "dist/extension.cjs",
      "README.md",
      "LICENSE",
      "CHANGELOG.md",
    ],

    source: {
      input: "dist/extension.cjs",
      module: "dist/extension-source.js",
      types: "dist/extension-source.d.ts",
    },

    dev: {
      fixtureFile: "demo/dev/fixtures/example.txt",
      settings: {
        "telemetry.telemetryLevel": "off",
      },
      launchArgs: [],
    },
  },

  demo: {
    scenariosDirectory: "demo/scenarios",
    generatedScenariosDirectory: "demo/scenarios/generated",
    artifactsDirectory: "demo/artifacts",
    mediaDirectory: "media",

    defaultCodegenScenario: "basic",
    frameRate: 10,

    viewport: {
      width: 1280,
      height: 900,
    },

    settings: {
      "workbench.startupEditor": "none",
      "window.restoreWindows": "none",
      "telemetry.telemetryLevel": "off",
    },

    launchArgs: [
      "--new-window",
      "--skip-welcome",
      "--skip-release-notes",
    ],

    extensionHostSetup: "demo/prepare-extension-host.mjs",

    async waitForReady({ page }) {
      await page
        .locator(".monaco-workbench")
        .waitFor({ state: "visible" });
    },

    async prepareCodegenPage({ page }) {
      // Optional: add stable data-testid attributes or other recorder helpers.
    },
  },
});
```

`projectDirectory`, `configFile`, and configured paths may be filesystem
strings or URLs where supported. Relative paths are resolved from
`projectDirectory`.

### Extension configuration

Common `extension` options:

| Option | Purpose |
| --- | --- |
| `id` | Installed VS Code extension ID, such as `publisher.extension-name`. |
| `developmentPath` | Staged extension directory passed to VS Code. |
| `manifestFile` | VS Code extension manifest used while staging. |
| `packageFile` | npm package metadata used for version validation. |
| `artifactDirectory` | Destination for generated VSIX files. |
| `runtimeFiles` | Files copied into the staged extension directory. |
| `source` | Optional built-bundle-to-ESM-source generation. |
| `dev` | Desktop development-launch settings and fixture. |

### Demo configuration

Common `demo` options:

| Option | Purpose |
| --- | --- |
| `scenariosDirectory` | Root containing runnable scenario modules. |
| `generatedScenariosDirectory` | Destination for Inspector-generated scenarios. |
| `artifactsDirectory` | Screenshots, frames, and WebM recordings. |
| `mediaDirectory` | README GIF destination. |
| `defaultCodegenScenario` | Scenario selected when `--codegen` has no explicit selection. |
| `frameRate` | Demo video capture frame rate. |
| `viewport` | VS Code workbench viewport used by Playwright. |
| `settings` | Disposable VS Code user settings for demos. |
| `launchArgs` | Extra VS Code launch arguments. |
| `extensionHostSetup` | Optional module run inside the VS Code extension host before recording. |
| `waitForReady` | Optional Playwright hook that waits for extension-specific UI/readiness. |
| `prepareCodegenPage` | Optional hook for adding stable recorder targets. |
| `testIdAttributeName` | Recorder test-ID attribute; defaults to `data-testid`. |

## Self-contained scenarios

Scenario files remain in the consuming extension because they describe that
extension's actual behavior.

```js
import {
  runScenarioModule,
} from "@moyarich/vscode-dev-toolkit/demo";

import config from "../../vscode-dev.config.mjs";

const scenario = {
  name: "basic",
  title: "Basic extension demo",
  description: "Shows the extension's primary workflow.",

  fileName: "example.css",

  source: `
:root {
  --brand: rebeccapurple;
}
`,

  async run({
    page,
    pause,
    outputDirectory,
    showDemoCaption,
    hideDemoCaption,
    installDemoMagnifierCursorOverlay,
    pointDemoMagnifierCursorAt,
    removeDemoMagnifierCursorOverlay,
  }) {
    await showDemoCaption({
      page,
      caption: {
        title: this.title,
        description: this.description,
        placement: "top-right",
      },
    });

    await pause(1500);
    await hideDemoCaption({ page });

    // Extension-specific Playwright interactions go here.
  },
};

export default scenario;

await runScenarioModule({
  config,
  moduleUrl: import.meta.url,
  name: scenario.name,
  scenario,
});
```

Because the module calls `runScenarioModule()`, it can be executed directly:

```bash
node demo/scenarios/basic.mjs
```

The same module can also be imported by the scenario registry without
automatically running.

## Scenario registry

Use the toolkit registry instead of maintaining a second hand-written scenario
list:

```js
import {
  createScenarioRegistry,
} from "@moyarich/vscode-dev-toolkit/demo";

import config from "../../vscode-dev.config.mjs";

export const {
  scenarios,
  selectScenarios,
} = await createScenarioRegistry({ config });
```

The registry recursively discovers `.mjs` files beneath
`demo.scenariosDirectory`, excluding `index.mjs`. Scenario filenames must be
unique because the filename becomes the scenario selection name.

## Record Playwright actions as a scenario

Run an existing scenario with `--codegen`:

```bash
node demo/scenarios/basic.mjs --codegen
```

Or expose the normal demo CLI:

```js
// demo/run.mjs
import {
  runDemoCli,
} from "@moyarich/vscode-dev-toolkit/demo";

import config from "../vscode-dev.config.mjs";

await runDemoCli({ config });
```

Then:

```bash
node demo/run.mjs --codegen --scenario=basic
```

Playwright Inspector records interactions against the already-running VS Code
workbench. When recording finishes, the toolkit converts Playwright's generated
JavaScript into a normal runnable scenario module under
`generatedScenariosDirectory`.

Generated scenarios:

- inherit the base scenario's source fixture and metadata;
- contain only the recorded `run({ page })` interaction sequence;
- import the extension's own config;
- use the same direct-execution contract as handwritten scenarios;
- are automatically discovered by the scenario registry.

## Demo entrypoints

### List or record scenarios

```js
import {
  runDemoCli,
} from "@moyarich/vscode-dev-toolkit/demo";

import config from "../vscode-dev.config.mjs";

await runDemoCli({ config });
```

Examples:

```bash
node demo/run.mjs --list
node demo/run.mjs --demo --scenario=all
node demo/run.mjs --demo --scenario=basic,advanced
node demo/run.mjs --codegen --scenario=basic
```

### Install the Playwright demo browser

```js
import {
  installDemoBrowser,
} from "@moyarich/vscode-dev-toolkit/demo";

await installDemoBrowser();
```

### Interactive scenario chooser

```js
import {
  runInteractiveDemoCli,
} from "@moyarich/vscode-dev-toolkit/demo";

import config from "../vscode-dev.config.mjs";

await runInteractiveDemoCli({ config });
```

This workflow requires `fzf`.

## README GIFs

Create a thin entrypoint:

```js
import {
  runGifCli,
} from "@moyarich/vscode-dev-toolkit/demo";

import config from "../vscode-dev.config.mjs";

await runGifCli({ config });
```

Then:

```bash
node demo/gif.mjs --scenario=basic
node demo/gif.mjs --scenario=basic --no-record
```

Without `--no-record`, the selected scenarios are recorded first.

The toolkit writes WebM recordings beneath `artifactsDirectory` and GIFs
beneath `mediaDirectory`.

GIF defaults can be configured through `demo.gif` or overridden with:

- `VSCODE_DEMO_GIF_FPS`
- `VSCODE_DEMO_GIF_WIDTH`
- `VSCODE_DEMO_GIF_TRIM_START`

## Extension-host setup

Most extensions can simply open the scenario source document. Extensions that
need additional activation checks or VS Code API validation can supply
`demo.extensionHostSetup`.

Example:

```js
// demo/prepare-extension-host.mjs
import assert from "node:assert/strict";

export async function prepare({
  vscode,
  extension,
  sourceFile,
}) {
  const document = await vscode.workspace.openTextDocument(
    vscode.Uri.file(sourceFile),
  );

  await vscode.window.showTextDocument(document);

  assert.equal(extension.isActive, true);
}
```

This module executes inside the VS Code extension host, not in the Playwright
process.

## Desktop extension development

Create a small entrypoint:

```js
import {
  launchExtensionDevelopment,
} from "@moyarich/vscode-dev-toolkit/extension";

import config from "../vscode-dev.config.mjs";

await launchExtensionDevelopment(config);
```

The launcher creates temporary workspace, user-data, and extensions directories,
copies the configured fixture into the workspace, and launches VS Code with the
staged extension.

## Staging a VS Code extension

```js
import {
  stageExtension,
} from "@moyarich/vscode-dev-toolkit/extension";

import config from "../vscode-dev.config.mjs";

await stageExtension(config);
```

Staging:

1. reads the configured VS Code manifest;
2. validates that its version matches the npm package version;
3. recreates `extension.developmentPath`;
4. writes the VS Code manifest as the staged `package.json`;
5. copies the configured runtime files.

## Generate extension source

For browser/Monaco hosts that need the compiled extension bundle as a JavaScript
string:

```js
import {
  writeExtensionSource,
} from "@moyarich/vscode-dev-toolkit/extension";

import config from "../vscode-dev.config.mjs";

await writeExtensionSource(config);
```

Configure `extension.source.input`, `module`, and `types` to enable this
step.

## Package a VSIX

```js
import {
  packageExtension,
} from "@moyarich/vscode-dev-toolkit/extension";

import config from "../vscode-dev.config.mjs";

await packageExtension(config, {
  list: process.argv.includes("--list"),
});
```

`list: true` prints the files that VSCE would include without creating the
VSIX.

## Publish to Open VSX

Package first, then:

```js
import {
  publishOpenVSX,
} from "@moyarich/vscode-dev-toolkit/extension";

import config from "../vscode-dev.config.mjs";

await publishOpenVSX(config);
```

The publisher reads `OVSX_PAT` from the environment by default. The token is
not added to command arguments.

## Package exports

### `@moyarich/vscode-dev-toolkit`

Configuration and all public toolkit exports.

### `@moyarich/vscode-dev-toolkit/demo`

Demo-oriented APIs including:

- `installDemoBrowser()`
- `captureScenario()`
- `createReadmeGifs()`
- `runGifCli()`
- `runInteractiveDemoCli()`
- `runDemoCli()`
- `runSelectedScenarios()`
- `runScenario()`
- `runScenarioModule()`
- `createScenarioRegistry()`

### `@moyarich/vscode-dev-toolkit/extension`

Extension-development and distribution APIs including:

- `launchExtensionDevelopment()`
- `stageExtension()`
- `readExtensionManifest()`
- `writeExtensionSource()`
- `packageExtension()`
- `publishOpenVSX()`

## Package layout

```text
src/
├── config.mjs
├── process.mjs
├── index.mjs
├── demo/
│   ├── browser.mjs
│   ├── codegen-recorder.mjs
│   ├── extension-host.cjs
│   ├── gif.mjs
│   ├── interactive.mjs
│   ├── run-cli.mjs
│   ├── run-scenario.mjs
│   ├── scenarios.mjs
│   ├── video-recorder.mjs
│   ├── vscode-runtime.mjs
│   └── ui/
│       ├── caption/
│       └── magnifier/
└── extension/
    ├── dev.mjs
    ├── package.mjs
    ├── publish-openvsx.mjs
    ├── stage.mjs
    └── write-source.mjs
```

## Design principle

The toolkit should contain behavior that is reusable across VS Code extensions.

A consuming extension should contain only what is specific to that extension:
its manifest, build configuration, scenarios, fixtures, validation hooks, and
small entrypoint modules.

If a second extension would otherwise need to copy an implementation file, that
implementation probably belongs here.
