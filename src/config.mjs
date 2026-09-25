import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Marks and validates a VS Code development-toolkit configuration.
 *
 * @param {object} config
 * @returns {object}
 */
export function defineVSCodeDevConfig(config) {
  if (!config?.projectDirectory) {
    throw new Error("VS Code dev config requires projectDirectory.");
  }

  if (!config?.extension?.id) {
    throw new Error("VS Code dev config requires extension.id.");
  }

  return config;
}

/**
 * Converts a URL or path-like value to an absolute filesystem path.
 *
 * @param {URL | string} value
 * @returns {string}
 */
export function toFilePath(value) {
  if (value instanceof URL) {
    return fileURLToPath(value);
  }

  return String(value);
}

/**
 * Resolves a project-relative config path.
 *
 * @param {object} config
 * @param {URL | string} value
 * @returns {string}
 */
export function resolveProjectPath(config, value) {
  const filePath = toFilePath(value);

  return path.isAbsolute(filePath)
    ? filePath
    : path.join(toFilePath(config.projectDirectory), filePath);
}
