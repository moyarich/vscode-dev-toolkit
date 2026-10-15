import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEMO_CAPTION_TAG_NAME = "demo-caption";
const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "element.mjs",
);
const stylesheetPath = path.join(path.dirname(componentPath), "styles.css");
const componentSource = readFile(componentPath, "utf8");
const stylesheetSource = readFile(stylesheetPath, "utf8");

/** Executes the component module without violating VS Code's Trusted Types policy. */
async function registerDemoCaptionElement(page) {
  const session = await page.context().newCDPSession(page);

  try {
    const result = await session.send("Runtime.evaluate", {
      expression: `{\n${(await componentSource)
        .replace(
          'import styleSheet from "./styles.css" with { type: "css" };',
          `const styleSheet = new CSSStyleSheet();\nstyleSheet.replaceSync(${JSON.stringify(await stylesheetSource)});`,
        )
        .replace(
          "export class DemoCaptionElement",
          "class DemoCaptionElement",
        )}\n}
//# sourceURL=${componentPath}`,
      awaitPromise: true,
    });

    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text ??
          "Could not register DemoCaptionElement.",
      );
    }
  } finally {
    await session.detach();
  }
}

/**
 * Loads the caption component and assigns its object-valued caption state.
 *
 * @param {object} options
 * @param {import("playwright").Page} options.page
 * @param {object} options.caption
 */
export async function showDemoCaption({ page, caption }) {
  const isRegistered = await page.evaluate(
    (tagName) => Boolean(customElements.get(tagName)),
    DEMO_CAPTION_TAG_NAME,
  );

  if (!isRegistered) {
    await registerDemoCaptionElement(page);
  }

  await page.evaluate(
    ({ tagName, caption }) => {
      let element = document.querySelector(tagName);
      if (!element) {
        element = document.createElement(tagName);
        element.setAttribute("popover", "manual");
        document.documentElement.append(element);
      }
      if (
        typeof element.showPopover === "function" &&
        !element.matches(":popover-open")
      ) {
        element.showPopover();
      }
      element.caption = { ...caption, visible: true };
    },
    {
      tagName: DEMO_CAPTION_TAG_NAME,
      caption,
    },
  );
}

/** Hides the current caption while keeping the reusable element mounted. */
export async function hideDemoCaption({ page }) {
  await page.evaluate((tagName) => {
    const element = document.querySelector(tagName);
    if (element) {
      element.caption = { ...element.caption, visible: false };
    }
  }, DEMO_CAPTION_TAG_NAME);
}
