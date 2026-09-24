import { afterEach, describe, expect, it } from "vitest";
import {
  EASING_PRESETS,
  inferControl,
  parseJigNames,
  readJig,
  replayAnimations,
  resetAllJigs,
  resetJig,
  restoreJigs,
  serializeJigs,
  setJig
} from "./jigs";
import type { VariantGroup } from "./types";
import { DEFAULT_CONFIG } from "./types";

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

function makeGroup(jigs: string[], css = ""): VariantGroup {
  const container = document.createElement("div");
  const element = document.createElement("div");
  element.className = "v1";
  container.appendChild(element);
  document.body.appendChild(container);
  if (css) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }
  return {
    container,
    id: "hero",
    variants: [
      { element, index: 1, label: "Minimal", description: null, jigs }
    ],
    activeIndex: 0,
    config: DEFAULT_CONFIG
  };
}

describe("parseJigNames", () => {
  it("accepts space- or comma-separated custom property names", () => {
    expect(parseJigNames("--a --b,--c ,  --d")).toEqual([
      "--a",
      "--b",
      "--c",
      "--d"
    ]);
  });

  it("drops malformed names and duplicates", () => {
    expect(
      parseJigNames("--ok color -missing --bad;name --ok --x(y) --also_ok")
    ).toEqual(["--ok", "--also_ok"]);
  });

  it("returns an empty list for a missing attribute", () => {
    expect(parseJigNames(null)).toEqual([]);
    expect(parseJigNames("")).toEqual([]);
  });
});

describe("inferControl", () => {
  it.each([
    ["240ms", { kind: "time", value: 240, unit: "ms", min: 0, max: 1000 }],
    ["2s", { kind: "time", value: 2, unit: "s", min: 0, max: 6 }],
    ["24px", { kind: "length", value: 24, unit: "px", min: 0, max: 96 }],
    ["1.5rem", { kind: "length", value: 1.5, unit: "rem", min: 0, max: 6 }],
    ["-8px", { kind: "length", value: -8, unit: "px", min: -96, max: 96 }],
    ["0.9", { kind: "number", value: 0.9, unit: "", min: 0 }],
    ["0.2", { kind: "number", value: 0.2, unit: "", max: 1 }],
    [".5", { kind: "number", value: 0.5, unit: "" }]
  ])("reads %s as a numeric control", (value, expected) => {
    expect(inferControl(value)).toMatchObject(expected);
  });

  it("scales the range with large values", () => {
    expect(inferControl("600px")).toMatchObject({ max: 1800 });
  });

  it.each([
    ["#3A5BD9", "#3a5bd9"],
    ["#fa0", "#ffaa00"],
    ["rgb(58, 91, 217)", "#3a5bd9"],
    ["rgb(58 91 217 / 1)", "#3a5bd9"]
  ])("reads %s as a color", (value, hex) => {
    expect(inferControl(value)).toEqual({ kind: "color", hex });
  });

  it("falls back to text for colors with transparency", () => {
    expect(inferControl("rgba(0, 0, 0, 0.5)").kind).toBe("text");
    expect(inferControl("#00000080").kind).toBe("text");
  });

  it.each([
    "ease-out",
    "cubic-bezier(0.2, 0.8, 0.2, 1)",
    "steps(4, end)",
    "linear"
  ])("reads %s as an easing", (value) => {
    expect(inferControl(value)).toEqual({
      kind: "easing",
      presets: EASING_PRESETS
    });
  });

  it("falls back to text for anything else", () => {
    expect(inferControl("0 4px 12px rgba(0,0,0,.1)").kind).toBe("text");
    expect(inferControl("Inter, sans-serif").kind).toBe("text");
  });
});

describe("setJig / resetJig", () => {
  it("writes the value as an inline custom property on the variant", () => {
    const group = makeGroup(["--v1-dur"], ".v1{--v1-dur:240ms}");
    const variant = group.variants[0];
    expect(readJig(variant.element, "--v1-dur")).toBe("240ms");
    setJig(group, variant, "--v1-dur", "480ms");
    expect(variant.element.style.getPropertyValue("--v1-dur")).toBe("480ms");
    expect(readJig(variant.element, "--v1-dur")).toBe("480ms");
  });

  it("reset removes the override so the stylesheet value applies again", () => {
    const group = makeGroup(["--v1-dur"], ".v1{--v1-dur:240ms}");
    const variant = group.variants[0];
    setJig(group, variant, "--v1-dur", "480ms");
    resetJig(group, variant, "--v1-dur");
    expect(variant.element.style.getPropertyValue("--v1-dur")).toBe("");
    expect(readJig(variant.element, "--v1-dur")).toBe("240ms");
  });

  it("reset restores a value the author set inline", () => {
    const group = makeGroup(["--v1-gap"]);
    const variant = group.variants[0];
    variant.element.style.setProperty("--v1-gap", "16px");
    setJig(group, variant, "--v1-gap", "40px");
    resetJig(group, variant, "--v1-gap");
    expect(variant.element.style.getPropertyValue("--v1-gap")).toBe("16px");
  });

  it("resetAllJigs resets every declared jig", () => {
    const group = makeGroup(["--a", "--b"]);
    const variant = group.variants[0];
    setJig(group, variant, "--a", "1px");
    setJig(group, variant, "--b", "2px");
    resetAllJigs(group, variant);
    expect(variant.element.style.getPropertyValue("--a")).toBe("");
    expect(variant.element.style.getPropertyValue("--b")).toBe("");
  });
});

describe("restoreJigs", () => {
  it("re-applies values tuned earlier in the session", () => {
    const first = makeGroup(["--v1-accent"]);
    setJig(first, first.variants[0], "--v1-accent", "#ff0000");
    document.body.innerHTML = "";

    const second = makeGroup(["--v1-accent"]);
    restoreJigs(second);
    expect(
      second.variants[0].element.style.getPropertyValue("--v1-accent")
    ).toBe("#ff0000");
  });

  it("ignores stored names the variant no longer declares", () => {
    const first = makeGroup(["--old"]);
    setJig(first, first.variants[0], "--old", "1px");
    const second = makeGroup(["--new"]);
    restoreJigs(second);
    expect(second.variants[0].element.style.getPropertyValue("--old")).toBe("");
  });

  it("forgets a jig once it is reset", () => {
    const first = makeGroup(["--a"]);
    setJig(first, first.variants[0], "--a", "1px");
    resetJig(first, first.variants[0], "--a");
    const second = makeGroup(["--a"]);
    restoreJigs(second);
    expect(second.variants[0].element.style.getPropertyValue("--a")).toBe("");
  });
});

describe("serializeJigs", () => {
  it("returns pasteable declarations with current values", () => {
    const group = makeGroup(
      ["--v1-accent", "--v1-dur"],
      ".v1{--v1-accent:#3a5bd9;--v1-dur:240ms}"
    );
    setJig(group, group.variants[0], "--v1-dur", "320ms");
    expect(serializeJigs(group.variants[0])).toBe(
      "--v1-accent: #3a5bd9;\n--v1-dur: 320ms;"
    );
  });
});

describe("replayAnimations", () => {
  it("restores the variant's display and survives a missing getAnimations", () => {
    const group = makeGroup([]);
    const el = group.variants[0].element;
    expect(() => replayAnimations(el)).not.toThrow();
    expect(el.style.display).toBe("");
  });
});
