# @moyarich/vscode-dev-toolkit

Reusable development infrastructure for VS Code extensions.

The toolkit centralizes the machinery that should not be copied into every
extension package:

- launch an isolated VS Code instance with `@vscode/test-electron`;
- attach Playwright to the VS Code workbench;
- run self-contained demo scenarios;
- record screenshots and WebM videos;
- capture Playwright Inspector actions as runnable scenarios;
- inject reusable caption and magnifier demo UI;
- create README GIFs with FFmpeg;
- launch a disposable desktop extension-development workspace;
- stage an extension directory;
- package a VSIX with `@vscode/vsce`;
- publish an existing VSIX to Open VSX;
- embed a built extension bundle as an ESM source string.

Each extension supplies a small configuration module describing its own paths,
extension ID, VS Code settings, and any extension-specific readiness/codegen
hooks.

## Package layout

```text
src/
├── config.mjs
├── process.mjs
├── demo/
│   ├── codegen-recorder.mjs
│   ├── extension-host.cjs
│   ├── gif.mjs
│   ├── index.mjs
│   ├── interactive.mjs
│   ├── run-cli.mjs
│   ├── run-scenario.mjs
│   ├── scenarios.mjs
│   ├── video-recorder.mjs
│   ├── vscode-runtime.mjs
│   └── ui/
└── extension/
    ├── dev.mjs
    ├── index.mjs
    ├── package.mjs
    ├── publish-openvsx.mjs
    ├── stage.mjs
    └── write-source.mjs
```

## Extension configuration

```js
import { defineVSCodeDevConfig } from "@moyarich/vscode-dev-toolkit";

export default defineVSCodeDevConfig({
  configFile: new URL(import.meta.url),
  projectDirectory: new URL("./", import.meta.url),

  extension: {
    id: "publisher.my-extension",
    developmentPath: "dist/vscode-extension",
    manifestFile: "extension.manifest.json",
    artifactDirectory: "artifacts",
    runtimeFiles: [
      "dist/extension.cjs",
      "README.md",
      "LICENSE",
      "CHANGELOG.md",
    ],
  },

  demo: {
    scenariosDirectory: "demo/scenarios",
    artifactsDirectory: "demo/artifacts",
    generatedScenariosDirectory: "demo/scenarios/generated",
    mediaDirectory: "media",
  },
});
```

Both `URL` and filesystem-string paths are supported for
`projectDirectory` and `configFile`.

## Self-contained scenarios

Scenario files remain inside the extension because they describe that
extension's behavior. Shared runtime code stays here.

```js
import config from "../../vscode-dev.config.mjs";
import { runScenarioModule } from "@moyarich/vscode-dev-toolkit/demo";

const scenario = {
  name: "basic",
  fileName: "example.css",
  source: ":root { --brand: rebeccapurple; }",

  async run({ page }) {
    // extension-specific demo steps
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

The same scenario can be imported by a multi-scenario runner or executed
directly with Node.

## Thin extension entrypoints

The toolkit is intended to leave extension packages with small adapters rather
than copied infrastructure.

### Demo runner

```js
import { runDemoCli } from "@moyarich/vscode-dev-toolkit/demo";
import config from "../vscode-dev.config.mjs";

await runDemoCli({ config });
```

### README GIFs

```js
import { runGifCli } from "@moyarich/vscode-dev-toolkit/demo";
import config from "../vscode-dev.config.mjs";

await runGifCli({ config });
```

### Interactive demo chooser

```js
import { runInteractiveDemoCli } from "@moyarich/vscode-dev-toolkit/demo";
import config from "../vscode-dev.config.mjs";

await runInteractiveDemoCli({ config });
```

### VSIX packaging

```js
import { packageExtension } from "@moyarich/vscode-dev-toolkit/extension";
import config from "../vscode-dev.config.mjs";

await packageExtension(config, {
  list: process.argv.includes("--list"),
});
```

### Open VSX publishing

```js
import { publishOpenVSX } from "@moyarich/vscode-dev-toolkit/extension";
import config from "../vscode-dev.config.mjs";

await publishOpenVSX(config);
```

The package keeps these workflows configurable while preserving one
implementation across multiple extensions.

