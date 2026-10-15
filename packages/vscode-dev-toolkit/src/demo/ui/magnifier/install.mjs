import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEMO_CURSOR_TAG_NAME = "demo-magnifier-cursor-overlay";
const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "element.mjs",
);
const stylesheetPath = path.join(path.dirname(componentPath), "styles.css");
const componentSource = readFile(componentPath, "utf8");
const stylesheetSource = readFile(stylesheetPath, "utf8");

/** Installs the visible cursor halo over the VS Code workbench. */
export async function installDemoMagnifierCursorOverlay({ page }) {
  const isRegistered = await page.evaluate(
    (tagName) => Boolean(customElements.get(tagName)),
    DEMO_CURSOR_TAG_NAME,
  );

  if (!isRegistered) {
    const session = await page.context().newCDPSession(page);
    try {
      const result = await session.send("Runtime.evaluate", {
        expression: `{\n${(await componentSource)
          .replace(
            'import styleSheet from "./styles.css" with { type: "css" };',
            `const styleSheet = new CSSStyleSheet();\nstyleSheet.replaceSync(${JSON.stringify(await stylesheetSource)});`,
          )
          .replace(
            "export class DemoMagnifierCursorOverlay",
            "class DemoMagnifierCursorOverlay",
          )}\n}
//# sourceURL=${componentPath}`,
        awaitPromise: true,
      });

      if (result.exceptionDetails) {
        throw new Error(
          result.exceptionDetails.exception?.description ??
            result.exceptionDetails.text ??
            "Could not register DemoMagnifierCursorOverlay.",
        );
      }
    } finally {
      await session.detach();
    }
  }

  await page.evaluate((tagName) => {
    document.querySelector(tagName)?.remove();
    document.documentElement.append(document.createElement(tagName));
  }, DEMO_CURSOR_TAG_NAME);
}

/**
 * Moves the visible halo to the center of a Playwright target, including a
 * target inside a webview iframe.
 */
export async function pointDemoMagnifierCursorAt({
  page,
  locator,
  pause = 500,
}) {
  const bounds = await locator.boundingBox();
  if (!bounds) {
    throw new Error("Could not position the demo cursor on a hidden control.");
  }

  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await new Promise((resolve) => setTimeout(resolve, pause));
}

/** Removes the cursor halo before keyboard input or unobstructed result shots. */
export async function removeDemoMagnifierCursorOverlay({ page }) {
  await page.evaluate((tagName) => {
    document.querySelector(tagName)?.remove();
  }, DEMO_CURSOR_TAG_NAME);
}
