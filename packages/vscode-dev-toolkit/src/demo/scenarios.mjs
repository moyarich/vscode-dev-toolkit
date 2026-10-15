import { globSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveProjectPath } from "../config.mjs";

/**
 * Loads every runnable scenario beneath the configured scenario directory.
 *
 * @param {object} options
 * @param {object} options.config
 */
export async function createScenarioRegistry({ config }) {
  const directory = resolveProjectPath(
    config,
    config.demo?.scenariosDirectory ?? "demo/scenarios",
  );

  const files = globSync("**/*.mjs", {
    cwd: directory,
    exclude: ["**/index.mjs"],
  }).sort();

  const entries = await Promise.all(
    files.map(async (file) => {
      const name = path.basename(file, ".mjs");
      const module = await import(pathToFileURL(path.join(directory, file)).href);

      return [name, module.default];
    }),
  );

  const duplicate = entries.find(
    ([name], index) => entries.findIndex(([other]) => other === name) !== index,
  );

  if (duplicate) {
    throw new Error(
      `Duplicate VS Code demo scenario name: ${duplicate[0]}. Scenario filenames must be unique.`,
    );
  }

  const scenarios = Object.freeze(Object.fromEntries(entries));

  function selectScenarios(selection = "all") {
    const available = Object.keys(scenarios);
    const names =
      selection === "all"
        ? available
        : [
            ...new Set(
              selection
                .split(",")
                .map((name) => name.trim())
                .filter(Boolean),
            ),
          ];

    if (
      !names.length ||
      names.some((name) => !Object.hasOwn(scenarios, name))
    ) {
      throw new Error(
        `Unknown demo scenario: ${selection}. Available: ${available.join(", ")}`,
      );
    }

    return names;
  }

  return {
    scenarios,
    selectScenarios,
  };
}
