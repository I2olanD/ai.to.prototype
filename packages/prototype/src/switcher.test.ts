import { describe, expect, it, vi } from "vitest";
import {
  getNextIndex,
  getPrevIndex,
  initializeVisibility,
  switchVariant
} from "./switcher";
import type { PickerConfig, VariantGroup } from "./types";
import { DEFAULT_CONFIG } from "./types";

const NO_ANIM = { ...DEFAULT_CONFIG, transition: "none" as const };

function makeGroup(
  count: number,
  config: PickerConfig = NO_ANIM
): VariantGroup {
  const container = document.createElement("div");
  const variants = Array.from({ length: count }, (_, i) => {
    const el = document.createElement("div");
    container.appendChild(el);
    return {
      element: el,
      index: i + 1,
      label: `Variant ${i + 1}`,
      description: null,
      jigs: []
    };
  });
  return { container, id: "test-group", variants, activeIndex: 0, config };
}

describe("initializeVisibility", () => {
  it("shows the first variant", () => {
    const group = makeGroup(3);
    initializeVisibility(group);
    expect(group.variants[0].element.style.display).not.toBe("none");
  });

  it("hides all other variants", () => {
    const group = makeGroup(3);
    initializeVisibility(group);
    expect(group.variants[1].element.style.display).toBe("none");
    expect(group.variants[2].element.style.display).toBe("none");
  });

  it("sets data-aitd-active on the first variant", () => {
    const group = makeGroup(3);
    initializeVisibility(group);
    expect(group.variants[0].element.hasAttribute("data-aitd-active")).toBe(
      true
    );
  });
});

describe("switchVariant (transition: none)", () => {
  it("hides the current variant", () => {
    const group = makeGroup(3);
    initializeVisibility(group);
    switchVariant(group, 1);
    expect(group.variants[0].element.style.display).toBe("none");
  });

  it("shows the target variant", () => {
    const group = makeGroup(3);
    initializeVisibility(group);
    switchVariant(group, 1);
    expect(group.variants[1].element.style.display).not.toBe("none");
  });

  it("sets data-aitd-active on the target variant", () => {
    const group = makeGroup(3);
    initializeVisibility(group);
    switchVariant(group, 1);
    expect(group.variants[1].element.hasAttribute("data-aitd-active")).toBe(
      true
    );
  });

  it("removes data-aitd-active from the previous variant", () => {
    const group = makeGroup(3);
    initializeVisibility(group);
    switchVariant(group, 1);
    expect(group.variants[0].element.hasAttribute("data-aitd-active")).toBe(
      false
    );
  });

  it("updates activeIndex", () => {
    const group = makeGroup(3);
    initializeVisibility(group);
    switchVariant(group, 2);
    expect(group.activeIndex).toBe(2);
  });

  it("is a no-op when target equals current", () => {
    const group = makeGroup(3);
    initializeVisibility(group);
    switchVariant(group, 0);
    expect(group.variants[0].element.hasAttribute("data-aitd-active")).toBe(
      true
    );
    expect(group.activeIndex).toBe(0);
  });
});

describe("switchVariant (transition: crossfade)", () => {
  const CROSSFADE = { ...DEFAULT_CONFIG, transition: "crossfade" as const };

  it("updates activeIndex immediately", () => {
    const group = makeGroup(3, CROSSFADE);
    initializeVisibility(group);
    switchVariant(group, 1);
    expect(group.activeIndex).toBe(1);
  });

  it("starts fading out the current variant", () => {
    const group = makeGroup(3, CROSSFADE);
    initializeVisibility(group);
    switchVariant(group, 1);
    expect(group.variants[0].element.style.opacity).toBe("0");
  });

  it("makes the target visible at opacity 0 during transition", () => {
    const group = makeGroup(3, CROSSFADE);
    initializeVisibility(group);
    switchVariant(group, 1);
    expect(group.variants[1].element.style.opacity).toBe("0");
    expect(group.variants[1].element.style.display).not.toBe("none");
  });

  it("hides current and fades in target after transitionend", () => {
    const group = makeGroup(3, CROSSFADE);
    initializeVisibility(group);
    switchVariant(group, 1);
    group.variants[0].element.dispatchEvent(new Event("transitionend"));
    expect(group.variants[0].element.style.display).toBe("none");
    expect(group.variants[1].element.style.opacity).toBe("1");
  });

  it("falls back to instant swap when prefers-reduced-motion is true", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "",
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    } as MediaQueryList);

    const group = makeGroup(3, CROSSFADE);
    initializeVisibility(group);
    switchVariant(group, 1);
    expect(group.variants[0].element.style.display).toBe("none");
    vi.restoreAllMocks();
  });
});

describe("initializeVisibility with a start index", () => {
  it("shows the start variant and records it as active", () => {
    const group = makeGroup(3);
    initializeVisibility(group, 2);
    expect(group.activeIndex).toBe(2);
    expect(group.variants[2].element.hasAttribute("data-aitd-active")).toBe(
      true
    );
    expect(group.variants[0].element.style.display).toBe("none");
  });
});

describe("switchVariant (transition: slide)", () => {
  const SLIDE = { ...DEFAULT_CONFIG, transition: "slide" as const };

  it("shifts the outgoing variant opposite to the direction", () => {
    const group = makeGroup(3, SLIDE);
    initializeVisibility(group);
    switchVariant(group, 1);
    expect(group.variants[0].element.style.transform).toBe("translateX(-16px)");
    expect(group.variants[1].element.style.transform).toBe("translateX(16px)");
  });

  it("honours an explicit backwards direction", () => {
    const group = makeGroup(3, SLIDE);
    initializeVisibility(group);
    switchVariant(group, 2, -1);
    expect(group.variants[2].element.style.transform).toBe("translateX(-16px)");
  });

  it("clears transform, opacity and transition when done", () => {
    const group = makeGroup(3, SLIDE);
    initializeVisibility(group);
    switchVariant(group, 1);
    const [prev, next] = [group.variants[0].element, group.variants[1].element];
    prev.dispatchEvent(new Event("transitionend"));
    expect(prev.style.display).toBe("none");
    expect(prev.style.transform).toBe("");
    expect(next.style.transform).toBe("translateX(0)");
    next.dispatchEvent(new Event("transitionend"));
    expect(next.style.transform).toBe("");
    expect(next.style.opacity).toBe("");
    expect(next.style.transition).toBe("");
  });

  it("swaps instantly when prefers-reduced-motion is true", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true
    } as MediaQueryList);
    const group = makeGroup(3, SLIDE);
    initializeVisibility(group);
    switchVariant(group, 1);
    expect(group.variants[0].element.style.display).toBe("none");
    expect(group.variants[1].element.style.transform).toBe("");
    vi.restoreAllMocks();
  });
});

describe("getNextIndex", () => {
  it("advances to the next index", () => {
    expect(getNextIndex(0, 3)).toBe(1);
    expect(getNextIndex(1, 3)).toBe(2);
  });

  it("wraps from last to first", () => {
    expect(getNextIndex(2, 3)).toBe(0);
  });
});

describe("getPrevIndex", () => {
  it("goes to the previous index", () => {
    expect(getPrevIndex(2, 3)).toBe(1);
    expect(getPrevIndex(1, 3)).toBe(0);
  });

  it("wraps from first to last", () => {
    expect(getPrevIndex(0, 3)).toBe(2);
  });
});
