import { createScenarioRegistry } from "./scenarios.mjs";
import {
  prepareDemoRuntime,
  runScenario,
} from "./run-scenario.mjs";

export async function runSelectedScenarios({
  config,
  selection = "all",
  codegen = false,
}) {
  const { scenarios, selectScenarios } =
    await createScenarioRegistry({ config });
  const selected = selectScenarios(selection);
  const executable = await prepareDemoRuntime({
    config,
    codegen,
  });

  for (const name of selected) {
    await runScenario({
      config,
      name,
      scenario: scenarios[name],
      vscodeExecutablePath: executable,
      codegen,
    });
  }
}

export async function runDemoCli({
  config,
  argv = process.argv.slice(2),
}) {
  const { scenarios, selectScenarios } =
    await createScenarioRegistry({ config });
  const codegen = argv.includes("--codegen");
  const selection =
    argv
      .find((argument) => argument.startsWith("--scenario="))
      ?.slice("--scenario=".length) ??
    (codegen
      ? config.demo?.defaultCodegenScenario ?? "all"
      : "all");
  const selected = selectScenarios(selection);

  if (argv.includes("--list")) {
    for (const [name, scenario] of Object.entries(scenarios)) {
      console.log(
        `${name}: ${scenario.title ?? scenario.description ?? ""}`,
      );
    }

    return;
  }

  if (!argv.includes("--demo") && !codegen) {
    throw new Error(
      "Use --demo to record video, --codegen to capture actions, or --list to list scenarios.",
    );
  }

  const executable = await prepareDemoRuntime({
    config,
    codegen,
  });

  for (const name of selected) {
    await runScenario({
      config,
      name,
      scenario: scenarios[name],
      vscodeExecutablePath: executable,
      codegen,
    });
  }
}
