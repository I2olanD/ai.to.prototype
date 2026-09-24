import { afterEach, describe, expect, it, vi } from "vitest";
import { announceVariant, bindKeyboardNavigation } from "./accessibility";
import type { VariantGroup } from "./types";
import { DEFAULT_CONFIG } from "./types";

const NO_TRANSITION = { ...DEFAULT_CONFIG, transition: "none" as const };

function makeGroup(count: number): VariantGroup {
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
    config: NO_TRANSITION
  };
}

function makeToolbarInShadow(): {
  host: HTMLElement;
  shadow: ShadowRoot;
  toolbar: HTMLElement;
} {
  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  const toolbar = document.createElement("div");
  toolbar.setAttribute("role", "toolbar");
  shadow.appendChild(toolbar);
  document.body.appendChild(host);
  return { host, shadow, toolbar };
}

describe("announceVariant", () => {
  it("sets live region textContent with label and position", () => {
    const region = document.createElement("div");
    const variant = {
      element: document.createElement("div"),
      index: 2,
      label: "Bold",
      description: null,
      jigs: []
    };
    announceVariant(region, variant, 4);
    expect(region.textContent).toBe("Showing variant: Bold (2 of 4)");
  });

  it("appends the description when present", () => {
    const region = document.createElement("div");
    const variant = {
      element: document.createElement("div"),
      index: 1,
      label: "Split",
      description: "Image left, copy right",
      jigs: []
    };
    announceVariant(region, variant, 2);
    expect(region.textContent).toBe(
      "Showing variant: Split (1 of 2) — Image left, copy right"
    );
  });
});

describe("bindKeyboardNavigation", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function setup(count: number) {
    const group = makeGroup(count);
    const { shadow, toolbar } = makeToolbarInShadow();
    const onSwitch = vi.fn((i: number) => {
      group.activeIndex = i;
    });
    bindKeyboardNavigation(shadow, group, onSwitch);
    return { group, onSwitch, toolbar };
  }

  function press(toolbar: HTMLElement, key: string): void {
    toolbar.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  }

  it("ArrowRight switches to next variant", () => {
    const { onSwitch, toolbar } = setup(3);
    press(toolbar, "ArrowRight");
    expect(onSwitch).toHaveBeenCalledWith(1);
  });

  it("ArrowLeft switches to previous variant", () => {
    const { group, onSwitch, toolbar } = setup(3);
    group.activeIndex = 2;
    press(toolbar, "ArrowLeft");
    expect(onSwitch).toHaveBeenCalledWith(1);
  });

  it("ArrowRight wraps from last to first", () => {
    const { group, onSwitch, toolbar } = setup(3);
    group.activeIndex = 2;
    press(toolbar, "ArrowRight");
    expect(onSwitch).toHaveBeenCalledWith(0);
  });

  it("ArrowLeft wraps from first to last", () => {
    const { onSwitch, toolbar } = setup(3);
    press(toolbar, "ArrowLeft");
    expect(onSwitch).toHaveBeenCalledWith(2);
  });

  it("number key 1 jumps to index 0", () => {
    const { group, onSwitch, toolbar } = setup(3);
    group.activeIndex = 2;
    press(toolbar, "1");
    expect(onSwitch).toHaveBeenCalledWith(0);
  });

  it("number key 3 jumps to index 2", () => {
    const { onSwitch, toolbar } = setup(4);
    press(toolbar, "3");
    expect(onSwitch).toHaveBeenCalledWith(2);
  });

  it("number key out of range is ignored", () => {
    const { onSwitch, toolbar } = setup(3);
    press(toolbar, "9");
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it("unrelated key is ignored", () => {
    const { onSwitch, toolbar } = setup(3);
    press(toolbar, "Tab");
    expect(onSwitch).not.toHaveBeenCalled();
  });
});
