import {
  access,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import {
  resolveProjectPath,
  toFilePath,
} from "../config.mjs";

function dedent(source) {
  const lines = source.replace(/^\n+|\n+$/g, "").split("\n");
  const indents = lines
    .filter((line) => line.trim())
    .map((line) => line.match(/^\s*/)?.[0].length ?? 0);
  const width = indents.length ? Math.min(...indents) : 0;

  return lines.map((line) => line.slice(width)).join("\n");
}

function extractPageActions(source) {
  const start = source.indexOf("await page.");

  if (start === -1) {
    throw new Error("Playwright codegen did not record any page actions.");
  }

  const endMarkers = [
    "// ---------------------",
    "await context.close()",
    "await browser.close()",
  ];
  const ends = endMarkers
    .map((marker) => source.indexOf(marker, start))
    .filter((index) => index !== -1);
  const end = ends.length ? Math.min(...ends) : source.length;

  return dedent(source.slice(start, end));
}

function indent(source, spaces) {
  const prefix = " ".repeat(spaces);

  return source
    .split("\n")
    .map((line) => (line ? `${prefix}${line}` : ""))
    .join("\n");
}

function importSpecifier(fromFile, targetFile) {
  let relative = path
    .relative(path.dirname(fromFile), targetFile)
    .split(path.sep)
    .join("/");

  if (!relative.startsWith(".")) {
    relative = `./${relative}`;
  }

  return relative;
}

async function convertRecording({
  config,
  outputFile,
  scenarioName,
  baseScenarioName,
  timestamp,
}) {
  if (!config.configFile) {
    throw new Error(
      "Codegen requires config.configFile so generated scenarios can import the extension configuration.",
    );
  }

  const generated = await readFile(outputFile, "utf8");
  const actions = extractPageActions(generated);
  const scenariosDirectory = resolveProjectPath(
    config,
    config.demo?.scenariosDirectory ?? "demo/scenarios",
  );
  const baseScenarioFile = path.join(
    scenariosDirectory,
    `${baseScenarioName}.mjs`,
  );
  const configFile = toFilePath(config.configFile);
  const content = `import config from "${importSpecifier(outputFile, configFile)}";
import { runScenarioModule } from "@moyarich/vscode-dev-toolkit/demo";
import baseScenario from "${importSpecifier(outputFile, baseScenarioFile)}";

const scenario = {
  ...baseScenario,
  name: ${JSON.stringify(scenarioName)},
  baseScenarioName: ${JSON.stringify(baseScenarioName)},
  title: \`\${baseScenario.title} — recorded ${timestamp}\`,

  async run({ page }) {
${indent(actions, 4)}
  },
};

export default scenario;

await runScenarioModule({
  config,
  moduleUrl: import.meta.url,
  name: scenario.name,
  scenario,
});
`;

  await writeFile(outputFile, content, "utf8");
}

export async function captureScenario({
  config,
  page,
  name,
  baseScenarioName = name,
}) {
  const directory = resolveProjectPath(
    config,
    config.demo?.generatedScenariosDirectory ??
      "demo/scenarios/generated",
  );

  await mkdir(directory, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const scenarioName = `${path.basename(name)}-${timestamp}`;
  const outputFile = path.join(directory, `${scenarioName}.mjs`);
  const context = page.context();

  if (typeof context._enableRecorder !== "function") {
    throw new Error(
      "This Playwright version does not support the Inspector recorder adapter.",
    );
  }

  await config.demo?.prepareCodegenPage?.({
    page,
    name,
    baseScenarioName,
  });

  await context._enableRecorder({
    language: "javascript",
    mode: "recording",
    testIdAttributeName:
      config.demo?.testIdAttributeName ?? "data-testid",
    outputFile,
    handleSIGINT: false,
  });

  console.log(`Inspector recording to ${outputFile}`);
  console.log(
    "Interact with VS Code. Press Enter in this terminal when finished.",
  );

  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let finish;
  const interrupted = new Promise((resolve) => {
    finish = resolve;
  });

  process.once("SIGINT", finish);

  try {
    await Promise.race([
      interrupted,
      terminal.question("Finish recording: "),
      new Promise((resolve) => page.once("close", resolve)),
    ]);
  } finally {
    process.removeListener("SIGINT", finish);
    terminal.close();
    await context._disableRecorder().catch(() => undefined);
  }

  // Codegen batches file writes for 250 ms. Allow its last action to flush.
  await new Promise((resolve) => setTimeout(resolve, 300));
  await access(outputFile);

  await convertRecording({
    config,
    outputFile,
    scenarioName,
    baseScenarioName,
    timestamp,
  });

  console.log(`Saved runnable demo scenario: ${outputFile}`);
}
