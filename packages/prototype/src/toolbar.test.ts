import { afterEach, describe, expect, it } from "vitest";
import { createToolbar, getToolbarStyles, updateLabel } from "./toolbar";
import type { VariantGroup } from "./types";
import { DEFAULT_CONFIG } from "./types";

const NO_TRANSITION = { ...DEFAULT_CONFIG, transition: "none" as const };

function makeGroup(
  count: number,
  overrides: Partial<typeof DEFAULT_CONFIG> = {}
): VariantGroup {
  const container = document.createElement("div");
  const variants = Array.from({ length: count }, (_, i) => ({
    element: document.createElement("div"),
    index: i + 1,
    label: `Variant ${i + 1}`,
    description: null,
    jigs: []
  }));
  return {
    container,
    id: "test",
    variants,
    activeIndex: 0,
    config: { ...NO_TRANSITION, ...overrides }
  };
}

describe("createToolbar", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("appends host element to a dock on document.body", () => {
    const { host } = createToolbar(makeGroup(2));
    expect(document.body.children.length).toBe(1);
    expect(host.parentElement?.parentElement).toBe(document.body);
  });

  it("dock has position fixed", () => {
    const { host } = createToolbar(makeGroup(2));
    expect(host.parentElement?.style.position).toBe("fixed");
  });

  it("stacks toolbars for the same position in one dock", () => {
    const a = createToolbar(makeGroup(2));
    const b = createToolbar(makeGroup(3));
    expect(document.querySelectorAll("[data-aitd-dock]")).toHaveLength(1);
    expect(a.host.parentElement).toBe(b.host.parentElement);
  });

  it("uses a separate dock per position", () => {
    createToolbar(makeGroup(2));
    createToolbar(makeGroup(2, { position: "top-center" }));
    expect(document.querySelectorAll("[data-aitd-dock]")).toHaveLength(2);
  });

  it("destroy removes the host and the emptied dock", () => {
    const a = createToolbar(makeGroup(2));
    const b = createToolbar(makeGroup(2));
    a.destroy();
    expect(a.host.isConnected).toBe(false);
    expect(document.querySelector("[data-aitd-dock]")).not.toBeNull();
    b.destroy();
    expect(document.querySelector("[data-aitd-dock]")).toBeNull();
  });

  it("shows the variant description as the label title", () => {
    const group = makeGroup(2);
    group.variants[1].description = "Two-column split";
    const { shadow } = createToolbar(group);
    const label = shadow.querySelector(".label") as HTMLElement;
    expect(label.hasAttribute("title")).toBe(false);
    (
      shadow.querySelector("[aria-label='Next variant']") as HTMLElement
    ).click();
    expect(label.getAttribute("title")).toBe("Two-column split");
  });

  it("remembers the chosen variant label in sessionStorage", () => {
    const { shadow } = createToolbar(makeGroup(3));
    (
      shadow.querySelector("[aria-label='Next variant']") as HTMLElement
    ).click();
    expect(Object.values({ ...window.sessionStorage })).toContain("Variant 2");
  });

  it("shadow contains role=toolbar", () => {
    const { shadow } = createToolbar(makeGroup(2));
    expect(shadow.querySelector("[role='toolbar']")).not.toBeNull();
  });

  it("shows current variant label", () => {
    const { shadow } = createToolbar(makeGroup(3));
    const label = shadow.querySelector(".label") as HTMLElement;
    expect(label.textContent).toBe("Variant 1");
  });

  it("shows counter as 1/N", () => {
    const { shadow } = createToolbar(makeGroup(4));
    const counter = shadow.querySelector(".counter") as HTMLElement;
    expect(counter.textContent).toBe("1/4");
  });

  it("has prev and next navigation buttons", () => {
    const { shadow } = createToolbar(makeGroup(3));
    const prevBtn = shadow.querySelector("[aria-label='Previous variant']");
    const nextBtn = shadow.querySelector("[aria-label='Next variant']");
    expect(prevBtn).not.toBeNull();
    expect(nextBtn).not.toBeNull();
  });

  it("clicking next updates label and counter", () => {
    const group = makeGroup(3);
    const { shadow } = createToolbar(group);
    const nextBtn = shadow.querySelector(
      "[aria-label='Next variant']"
    ) as HTMLElement;
    nextBtn.click();
    const label = shadow.querySelector(".label") as HTMLElement;
    const counter = shadow.querySelector(".counter") as HTMLElement;
    expect(label.textContent).toBe("Variant 2");
    expect(counter.textContent).toBe("2/3");
    expect(group.activeIndex).toBe(1);
  });

  it("clicking prev wraps to last variant", () => {
    const group = makeGroup(3);
    const { shadow } = createToolbar(group);
    const prevBtn = shadow.querySelector(
      "[aria-label='Previous variant']"
    ) as HTMLElement;
    prevBtn.click();
    const label = shadow.querySelector(".label") as HTMLElement;
    const counter = shadow.querySelector(".counter") as HTMLElement;
    expect(label.textContent).toBe("Variant 3");
    expect(counter.textContent).toBe("3/3");
    expect(group.activeIndex).toBe(2);
  });

  it("clicking next wraps to first variant", () => {
    const group = makeGroup(2);
    const { shadow } = createToolbar(group);
    const nextBtn = shadow.querySelector(
      "[aria-label='Next variant']"
    ) as HTMLElement;
    nextBtn.click();
    nextBtn.click();
    const label = shadow.querySelector(".label") as HTMLElement;
    expect(label.textContent).toBe("Variant 1");
    expect(group.activeIndex).toBe(0);
  });

  it("shadow contains a live region", () => {
    const { shadow } = createToolbar(makeGroup(2));
    expect(shadow.querySelector("[aria-live='polite']")).not.toBeNull();
  });

  it("shows branding when config.branding is true", () => {
    const { shadow } = createToolbar(makeGroup(2, { branding: true }));
    expect(shadow.querySelector(".branding")).not.toBeNull();
  });

  it("hides branding when config.branding is false", () => {
    const { shadow } = createToolbar(makeGroup(2, { branding: false }));
    expect(shadow.querySelector(".branding")).toBeNull();
  });
});

describe("updateLabel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("updates label and counter text", () => {
    const group = makeGroup(3);
    const { shadow } = createToolbar(group);
    group.activeIndex = 2;
    updateLabel(shadow, group);
    const label = shadow.querySelector(".label") as HTMLElement;
    const counter = shadow.querySelector(".counter") as HTMLElement;
    expect(label.textContent).toBe("Variant 3");
    expect(counter.textContent).toBe("3/3");
  });
});

describe("getToolbarStyles", () => {
  it("returns a non-empty CSS string", () => {
    const css = getToolbarStyles(DEFAULT_CONFIG);
    expect(typeof css).toBe("string");
    expect(css.length).toBeGreaterThan(0);
  });

  it("includes dark mode media query for auto theme", () => {
    const css = getToolbarStyles({ ...DEFAULT_CONFIG, theme: "auto" });
    expect(css).toContain("prefers-color-scheme");
  });

  it("does not include dark media query when theme is forced light", () => {
    const css = getToolbarStyles({ ...DEFAULT_CONFIG, theme: "light" });
    expect(css).not.toContain("prefers-color-scheme");
  });

  it("includes backdrop-filter for frosted glass", () => {
    const css = getToolbarStyles(DEFAULT_CONFIG);
    expect(css).toContain("backdrop-filter");
  });
});

describe("jigs panel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function makeJigGroup(): VariantGroup {
    const group = makeGroup(3);
    group.variants.forEach((v) => {
      document.body.appendChild(v.element);
    });
    group.variants[0].jigs = ["--v1-dur", "--v1-accent"];
    group.variants[0].element.style.setProperty("--v1-dur", "240ms");
    group.variants[0].element.style.setProperty("--v1-accent", "#3a5bd9");
    group.variants[2].jigs = ["--v3-gap"];
    group.variants[2].element.style.setProperty("--v3-gap", "24px");
    return group;
  }

  function jigButton(shadow: ShadowRoot): HTMLButtonElement {
    return shadow.querySelector(
      "[aria-label='Adjust design tokens']"
    ) as HTMLButtonElement;
  }

  it("adds no jig button to groups without jigs", () => {
    const { shadow } = createToolbar(makeGroup(2));
    expect(jigButton(shadow)).toBeNull();
    expect(shadow.querySelector(".jigs")).toBeNull();
  });

  it("hides the jig button on variants without jigs", () => {
    const { shadow } = createToolbar(makeJigGroup());
    expect(jigButton(shadow).hidden).toBe(false);
    (
      shadow.querySelector("[aria-label='Next variant']") as HTMLElement
    ).click();
    expect(jigButton(shadow).hidden).toBe(true);
  });

  it("opens a panel with one row per jig", () => {
    const { shadow } = createToolbar(makeJigGroup());
    const panel = shadow.querySelector(".jigs") as HTMLElement;
    expect(panel.hidden).toBe(true);
    jigButton(shadow).click();
    expect(panel.hidden).toBe(false);
    expect(jigButton(shadow).getAttribute("aria-expanded")).toBe("true");
    expect(panel.querySelectorAll(".jig-row")).toHaveLength(2);
    expect(panel.querySelector("input[type=color]")).not.toBeNull();
  });

  it("keeps the panel outside the keyboard-handled toolbar", () => {
    const { shadow } = createToolbar(makeJigGroup());
    const toolbar = shadow.querySelector("[role='toolbar']") as HTMLElement;
    expect(toolbar.contains(shadow.querySelector(".jigs"))).toBe(false);
  });

  it("updates the variant's custom property live from the range input", () => {
    const group = makeJigGroup();
    const { shadow } = createToolbar(group);
    jigButton(shadow).click();
    const range = shadow.querySelector("input[type=range]") as HTMLInputElement;
    range.value = "600";
    range.dispatchEvent(new Event("input"));
    expect(group.variants[0].element.style.getPropertyValue("--v1-dur")).toBe(
      "600ms"
    );
    const num = shadow.querySelector("input[type=number]") as HTMLInputElement;
    expect(num.value).toBe("600");
  });

  it("does not switch variants when typing digits into a jig field", () => {
    const group = makeJigGroup();
    const { shadow } = createToolbar(group);
    jigButton(shadow).click();
    const num = shadow.querySelector("input[type=number]") as HTMLInputElement;
    num.dispatchEvent(
      new KeyboardEvent("keydown", { key: "3", bubbles: true })
    );
    expect(group.activeIndex).toBe(0);
  });

  it("rebuilds the open panel for the next variant with jigs", () => {
    const group = makeJigGroup();
    const { shadow } = createToolbar(group);
    jigButton(shadow).click();
    const prev = shadow.querySelector(
      "[aria-label='Previous variant']"
    ) as HTMLElement;
    prev.click(); // wraps to variant 3
    const panel = shadow.querySelector(".jigs") as HTMLElement;
    expect(panel.hidden).toBe(false);
    expect(panel.querySelectorAll(".jig-row")).toHaveLength(1);
    expect(panel.querySelector(".jig-name")?.textContent).toBe("v3-gap");
  });

  it("closes the panel on switching to a variant without jigs", () => {
    const { shadow } = createToolbar(makeJigGroup());
    jigButton(shadow).click();
    (
      shadow.querySelector("[aria-label='Next variant']") as HTMLElement
    ).click();
    expect((shadow.querySelector(".jigs") as HTMLElement).hidden).toBe(true);
    expect(jigButton(shadow).getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the panel on Escape", () => {
    const { shadow } = createToolbar(makeJigGroup());
    jigButton(shadow).click();
    const panel = shadow.querySelector(".jigs") as HTMLElement;
    panel.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(panel.hidden).toBe(true);
  });

  it("Reset all restores the authored values", () => {
    const group = makeJigGroup();
    const { shadow } = createToolbar(group);
    jigButton(shadow).click();
    const range = shadow.querySelector("input[type=range]") as HTMLInputElement;
    range.value = "900";
    range.dispatchEvent(new Event("input"));
    (
      shadow.querySelector("[aria-label='Reset all jigs']") as HTMLElement
    ).click();
    expect(group.variants[0].element.style.getPropertyValue("--v1-dur")).toBe(
      "240ms"
    );
  });

  it("Copy falls back to a selectable textarea without clipboard access", async () => {
    const { shadow } = createToolbar(makeJigGroup());
    jigButton(shadow).click();
    (
      shadow.querySelector(
        "[aria-label='Copy jig values as CSS']"
      ) as HTMLElement
    ).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const fallback = shadow.querySelector(".jig-copy") as HTMLTextAreaElement;
    expect(fallback.value).toBe("--v1-dur: 240ms;\n--v1-accent: #3a5bd9;");
  });
});
