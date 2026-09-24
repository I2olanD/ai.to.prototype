import { describe, expect, it } from "vitest";
import { rememberSelection, resolveInitialIndex } from "./persistence";
import type { VariantGroup } from "./types";
import { DEFAULT_CONFIG } from "./types";

function makeGroup(labels: string[], id = "hero"): VariantGroup {
  return {
    container: document.createElement("div"),
    id,
    variants: labels.map((label, i) => ({
      element: document.createElement("div"),
      index: i + 1,
      label,
      description: null,
      jigs: []
    })),
    activeIndex: 0,
    config: DEFAULT_CONFIG
  };
}

describe("resolveInitialIndex", () => {
  it("defaults to the first variant", () => {
    expect(resolveInitialIndex(makeGroup(["A", "B"]))).toBe(0);
  });

  it("restores the remembered label", () => {
    const group = makeGroup(["A", "B", "C"]);
    rememberSelection(group, group.variants[2]);
    expect(resolveInitialIndex(group)).toBe(2);
  });

  it("matches the remembered label after variants are reordered", () => {
    const before = makeGroup(["A", "B", "C"]);
    rememberSelection(before, before.variants[1]);
    const after = makeGroup(["B", "C", "A"]);
    expect(resolveInitialIndex(after)).toBe(0);
  });

  it("keeps selections of different groups apart", () => {
    const hero = makeGroup(["A", "B"], "hero");
    const footer = makeGroup(["A", "B"], "footer");
    rememberSelection(hero, hero.variants[1]);
    expect(resolveInitialIndex(footer)).toBe(0);
  });

  it("?aitd=<n> wins over storage and matches the data-aitd-variant value", () => {
    const group = makeGroup(["A", "B", "C"]);
    rememberSelection(group, group.variants[1]);
    window.history.replaceState(null, "", "/?aitd=3");
    expect(resolveInitialIndex(group)).toBe(2);
  });

  it("ignores an out-of-range ?aitd value", () => {
    window.history.replaceState(null, "", "/?aitd=9");
    expect(resolveInitialIndex(makeGroup(["A", "B"]))).toBe(0);
  });

  it("falls back to the first variant when storage throws", () => {
    const original = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      }
    });
    try {
      const group = makeGroup(["A", "B"]);
      expect(() => rememberSelection(group, group.variants[1])).not.toThrow();
      expect(resolveInitialIndex(group)).toBe(0);
    } finally {
      if (original) Object.defineProperty(window, "sessionStorage", original);
    }
  });
});
