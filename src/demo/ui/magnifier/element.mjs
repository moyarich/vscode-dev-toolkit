import styleSheet from "./styles.css" with { type: "css" };

/**
 * Cursor magnifier overlay that mirrors and magnifies the DOM content
 * underneath the pointer.
 *
 * The overlay:
 *
 * - follows pointer movement
 * - selects a suitable DOM subtree beneath the pointer
 * - clones that subtree into the magnifier
 * - preserves the target's effective background
 * - mirrors native text selection
 * - refreshes after scrolling and resizing
 * - provides a click animation
 *
 * @example
 * ```html
 * <demo-magnifier-cursor-overlay></demo-magnifier-cursor-overlay>
 * ```
 */
export class DemoMagnifierCursorOverlay extends HTMLElement {
  /** Custom element tag name. */
  static tagName = "demo-magnifier-cursor-overlay";

  /** Stylesheets adopted by the element's shadow root. */
  static styleSheets = [styleSheet];

  /**
   * Maximum number of ancestors inspected when selecting a magnification
   * target or resolving its effective background.
   *
   * @type {number}
   */
  static maxDepth = 12;

  /**
   * Prevents extremely large page containers from becoming magnifier targets.
   *
   * @type {number}
   */
  static maxTargetSize = 1.5;

  /** @type {HTMLDivElement} */
  #cursor;

  /** @type {HTMLDivElement} */
  #content;

  /** @type {HTMLDivElement} */
  #selectionLayer;

  /** @type {Element | null} */
  #target = null;

  /** @type {HTMLElement | null} */
  #clone = null;

  /** @type {number} */
  #x = 0;

  /** @type {number} */
  #y = 0;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #clickTimer;

  constructor() {
    super();

    const shadowRoot = this.attachShadow({
      mode: "open",
    });

    shadowRoot.adoptedStyleSheets = DemoMagnifierCursorOverlay.styleSheets;

    this.#cursor = document.createElement("div");
    this.#cursor.className = "cursor";

    this.#content = document.createElement("div");
    this.#content.className = "cursor__content";

    this.#selectionLayer = document.createElement("div");
    this.#selectionLayer.className = "cursor__selection-layer";

    this.#content.append(this.#selectionLayer);
    this.#cursor.append(this.#content);
    shadowRoot.append(this.#cursor);
  }

  /**
   * Returns the configured magnification scale.
   *
   * @returns {number}
   */
  #getScale() {
    return (
      parseFloat(
        getComputedStyle(this.#cursor).getPropertyValue("--cursor-scale"),
      ) || 1.3
    );
  }

  /**
   * Returns the current rendered diameter of the cursor.
   *
   * @returns {number}
   */
  #getSize() {
    return this.#cursor.offsetWidth || 1;
  }

  /**
   * Returns an element's logical parent, crossing a shadow-root boundary
   * through its host when necessary.
   *
   * @param {Element} element
   * @returns {Element | null}
   */
  #getParent(element) {
    if (element.parentElement) {
      return element.parentElement;
    }

    const root = element.getRootNode?.();

    return root instanceof ShadowRoot ? root.host : null;
  }

  /**
   * Determines whether an element contains enough visible area around the
   * pointer to completely fill the magnifier.
   *
   * @param {Element} element
   * @returns {boolean}
   */
  #hasEnoughArea(element) {
    const rect = element.getBoundingClientRect();
    const radius = this.#getSize() / this.#getScale() / 2;

    const localX = this.#x - rect.left;
    const localY = this.#y - rect.top;

    return (
      localX >= radius &&
      localY >= radius &&
      rect.width - localX >= radius &&
      rect.height - localY >= radius
    );
  }

  /**
   * Finds the most suitable DOM subtree underneath the pointer.
   *
   * Small elements are walked upward until an ancestor is large enough to
   * fill the lens. Extremely large page containers are ignored.
   *
   * @returns {Element | null}
   */
  #getTarget() {
    let element = document.elementFromPoint(this.#x, this.#y);
    let fallback = null;

    for (
      let depth = 0;
      element && depth < DemoMagnifierCursorOverlay.maxDepth;
      depth += 1
    ) {
      if (
        element === this ||
        element === document.body ||
        element === document.documentElement
      ) {
        break;
      }

      const rect = element.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        element = this.#getParent(element);
        continue;
      }

      if (
        rect.width > innerWidth * DemoMagnifierCursorOverlay.maxTargetSize ||
        rect.height > innerHeight * DemoMagnifierCursorOverlay.maxTargetSize
      ) {
        break;
      }

      fallback = element;

      if (this.#hasEnoughArea(element)) {
        return element;
      }

      element = this.#getParent(element);
    }

    return fallback;
  }

  /**
   * Determines whether a CSS color is effectively transparent.
   *
   * @param {string} color
   * @returns {boolean}
   */
  #isTransparent(color) {
    return !color || color === "transparent" || color === "rgba(0, 0, 0, 0)";
  }

  /**
   * Resolves the effective background behind an element.
   *
   * Transparent ancestors are traversed until a usable background color or
   * background image is found.
   *
   * @param {Element} element
   * @returns {string}
   */
  #getBackground(element) {
    let current = element;

    for (
      let depth = 0;
      current && depth < DemoMagnifierCursorOverlay.maxDepth;
      depth += 1
    ) {
      const style = getComputedStyle(current);

      if (style.backgroundImage !== "none") {
        return style.background;
      }

      if (!this.#isTransparent(style.backgroundColor)) {
        return style.backgroundColor;
      }

      current = this.#getParent(current);
    }

    return getComputedStyle(document.body).backgroundColor || "#fff";
  }

  /**
   * Removes IDs from a cloned subtree so the magnifier never introduces
   * duplicate document IDs.
   *
   * @param {Element} element
   * @returns {void}
   */
  #removeIds(element) {
    element.removeAttribute("id");

    element.querySelectorAll("[id]").forEach((child) => {
      child.removeAttribute("id");
    });
  }

  /**
   * Replaces the currently magnified subtree.
   *
   * @param {Element | null} nextTarget
   * @returns {void}
   */
  #setTarget(nextTarget) {
    if (nextTarget === this.#target) {
      return;
    }

    this.#target = nextTarget;

    this.#clone?.remove();
    this.#clone = null;

    this.#selectionLayer.replaceChildren();

    if (!this.#target) {
      this.#cursor.classList.remove("visible");
      return;
    }

    const rect = this.#target.getBoundingClientRect();
    const clone = this.#target.cloneNode(true);

    if (!(clone instanceof HTMLElement)) {
      return;
    }

    // Document styles do not cross the lens shadow root. Preserve the rendered
    // appearance, including Monaco token colors and absolutely positioned lines.
    const originals = [this.#target, ...this.#target.querySelectorAll("*")];
    const copies = [clone, ...clone.querySelectorAll("*")];
    originals.forEach((original, index) => {
      const computed = getComputedStyle(original);
      for (const property of computed) {
        copies[index].style.setProperty(
          property,
          computed.getPropertyValue(property),
        );
      }
    });
    this.#removeIds(clone);

    clone.classList.add("cursor__clone");
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;

    this.#clone = clone;

    this.#content.insertBefore(clone, this.#selectionLayer);

    this.#cursor.style.setProperty(
      "--cursor-background",
      this.#getBackground(this.#target),
    );

    this.#cursor.classList.add("visible");
  }

  /**
   * Calculates the transform shared by the cloned content and mirrored
   * selection layer.
   *
   * @returns {string}
   */
  #getTransform() {
    if (!this.#target) {
      return "";
    }

    const rect = this.#target.getBoundingClientRect();
    const scale = this.#getScale();
    const radius = this.#getSize() / 2;

    const localX = this.#x - rect.left;
    const localY = this.#y - rect.top;

    return `
      translate(
        ${radius - localX * scale}px,
        ${radius - localY * scale}px
      )
      scale(${scale})
    `;
  }

  /**
   * Positions all magnified layers around the current pointer location.
   *
   * @returns {void}
   */
  #positionLayers() {
    if (!this.#target || !this.#clone) {
      return;
    }

    const transform = this.#getTransform();

    this.#clone.style.transform = transform;
    this.#selectionLayer.style.transform = transform;
  }

  /**
   * Mirrors the browser's native text selection inside the magnifier.
   *
   * Selection rectangles are clipped to the currently cloned target.
   *
   * @returns {void}
   */
  #updateSelection = () => {
    this.#selectionLayer.replaceChildren();

    if (!this.#target || !this.#clone) {
      return;
    }

    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }

    const targetRect = this.#target.getBoundingClientRect();
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < selection.rangeCount; i += 1) {
      const range = selection.getRangeAt(i);

      for (const rect of range.getClientRects()) {
        const left = Math.max(rect.left, targetRect.left);
        const top = Math.max(rect.top, targetRect.top);
        const right = Math.min(rect.right, targetRect.right);
        const bottom = Math.min(rect.bottom, targetRect.bottom);

        if (right <= left || bottom <= top) {
          continue;
        }

        const highlight = document.createElement("div");

        highlight.className = "cursor__selection-rect";
        highlight.style.left = `${left - targetRect.left}px`;
        highlight.style.top = `${top - targetRect.top}px`;
        highlight.style.width = `${right - left}px`;
        highlight.style.height = `${bottom - top}px`;

        fragment.append(highlight);
      }
    }

    this.#selectionLayer.append(fragment);
  };

  /**
   * Updates the cursor position and magnified subtree after pointer movement.
   *
   * @param {PointerEvent} event
   * @returns {void}
   */
  #handlePointerMove = (event) => {
    this.#x = event.clientX;
    this.#y = event.clientY;

    this.#cursor.style.left = `${this.#x}px`;
    this.#cursor.style.top = `${this.#y}px`;

    this.#setTarget(this.#getTarget());

    if (!this.#target || !this.#clone) {
      return;
    }

    this.#positionLayers();
    this.#updateSelection();
  };

  /**
   * Restarts the cursor click animation.
   *
   * @returns {void}
   */
  #handlePointerDown = () => {
    this.#cursor.classList.remove("click");

    void this.#cursor.offsetWidth;

    this.#cursor.classList.add("click");

    clearTimeout(this.#clickTimer);

    this.#clickTimer = setTimeout(() => {
      this.#cursor.classList.remove("click");
    }, 500);
  };

  /**
   * Recalculates the target and magnified layers without requiring additional
   * pointer movement.
   *
   * Useful when scrolling or resizing changes the DOM beneath the pointer.
   *
   * @returns {void}
   */
  #refresh = () => {
    if (!this.#target) {
      return;
    }

    this.#target = null;

    this.#setTarget(this.#getTarget());
    this.#positionLayers();
    this.#updateSelection();
  };

  /**
   * Hides the magnifier when the pointer leaves the document.
   *
   * @returns {void}
   */
  #handlePointerLeave = () => {
    this.#cursor.classList.remove("visible");
  };

  /**
   * Hides the magnifier when the browser window loses focus.
   *
   * @returns {void}
   */
  #handleBlur = () => {
    this.#cursor.classList.remove("visible");
  };

  /**
   * Activates the overlay and installs its document-level event listeners.
   *
   * @returns {void}
   */
  connectedCallback() {
    this.setAttribute("popover", "manual");

    if (!this.matches(":popover-open")) {
      this.showPopover();
    }

    document.addEventListener("pointermove", this.#handlePointerMove, {
      capture: true,
      passive: true,
    });

    document.addEventListener("pointerdown", this.#handlePointerDown, {
      capture: true,
      passive: true,
    });

    document.addEventListener("selectionchange", this.#updateSelection);

    document.addEventListener("scroll", this.#refresh, {
      capture: true,
      passive: true,
    });

    window.addEventListener("resize", this.#refresh, {
      passive: true,
    });

    document.addEventListener("pointerleave", this.#handlePointerLeave);

    window.addEventListener("blur", this.#handleBlur);
  }

  /**
   * Removes global event listeners and transient state when disconnected.
   *
   * @returns {void}
   */
  disconnectedCallback() {
    document.removeEventListener("pointermove", this.#handlePointerMove, true);

    document.removeEventListener("pointerdown", this.#handlePointerDown, true);

    document.removeEventListener("selectionchange", this.#updateSelection);

    document.removeEventListener("scroll", this.#refresh, true);

    window.removeEventListener("resize", this.#refresh);

    document.removeEventListener("pointerleave", this.#handlePointerLeave);

    window.removeEventListener("blur", this.#handleBlur);

    clearTimeout(this.#clickTimer);

    this.#target = null;
    this.#clone?.remove();
    this.#clone = null;
    this.#selectionLayer.replaceChildren();
  }
}

if (!customElements.get(DemoMagnifierCursorOverlay.tagName)) {
  customElements.define(
    DemoMagnifierCursorOverlay.tagName,
    DemoMagnifierCursorOverlay,
  );
}
