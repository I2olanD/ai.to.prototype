import { jigStorageKey, readStorage, writeStorage } from "./persistence";
import type { Variant, VariantGroup } from "./types";

// Jigs are live controls for CSS custom properties a variant exposes via
// `data-aitd-jigs`. Values are written as inline custom properties on the
// variant element, so everything using `var(--…)` inside it updates at once,
// whatever produced the markup (plain CSS, Tailwind arbitrary values, modules).

export type NumericKind = "time" | "length" | "number";

export type JigControl =
  | {
      kind: NumericKind;
      value: number;
      unit: string;
      min: number;
      max: number;
      step: number;
    }
  | { kind: "color"; hex: string }
  | { kind: "easing"; presets: string[] }
  | { kind: "text" };

const JIG_NAME = /^--[A-Za-z0-9_-]+$/;
const NUMERIC = /^(-?(?:\d+\.?\d*|\.\d+))(ms|s|px|rem|em|%|vh|vw)?$/;
const EASING =
  /^(?:ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)$|^(?:cubic-bezier|steps|linear)\(/;

export const EASING_PRESETS = [
  "ease-out",
  "ease-in-out",
  "linear",
  "cubic-bezier(0.2, 0.8, 0.2, 1)",
  "cubic-bezier(0.34, 1.56, 0.64, 1)"
];

export function parseJigNames(raw: string | null): string[] {
  if (!raw) return [];
  const names = raw.split(/[\s,]+/).filter((n) => JIG_NAME.test(n));
  return Array.from(new Set(names));
}

function toHex(value: string): string | null {
  const short = /^#([0-9a-f]{3})$/i.exec(value);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();

  // rgb()/rgba() with full opacity only — <input type=color> has no alpha.
  const rgb =
    /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(
      value
    );
  if (!rgb) return null;
  const alpha = rgb[4];
  if (alpha !== undefined && alpha !== "1" && alpha !== "100%") return null;
  const channels = [rgb[1], rgb[2], rgb[3]].map((c) => Number(c));
  if (channels.some((c) => c > 255)) return null;
  return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function lengthFloor(unit: string): { floor: number; step: number } {
  if (unit === "px") return { floor: 96, step: 1 };
  if (unit === "%" || unit === "vh" || unit === "vw") {
    return { floor: 100, step: 1 };
  }
  return { floor: 6, step: 0.125 };
}

/** Picks a control and a range from the property's current value. */
export function inferControl(value: string): JigControl {
  const v = value.trim();

  const numeric = NUMERIC.exec(v);
  if (numeric) {
    const n = parseFloat(numeric[1]);
    const unit = numeric[2] ?? "";
    let kind: NumericKind = "length";
    let floor: number;
    let step: number;
    if (unit === "ms" || unit === "s") {
      kind = "time";
      floor = unit === "ms" ? 1000 : 1;
      step = unit === "ms" ? 10 : 0.05;
    } else if (unit === "") {
      kind = "number";
      floor = 1;
      step = 0.01;
    } else {
      ({ floor, step } = lengthFloor(unit));
    }
    const max = Math.max(floor, Math.abs(n) * 3);
    return { kind, value: n, unit, min: n < 0 ? -max : 0, max, step };
  }

  const hex = toHex(v);
  if (hex) return { kind: "color", hex };

  if (EASING.test(v)) return { kind: "easing", presets: EASING_PRESETS };

  return { kind: "text" };
}

export function formatNumeric(n: number, unit: string): string {
  return `${Math.round(n * 1000) / 1000}${unit}`;
}

export function readJig(el: HTMLElement, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

// Inline values the author set before any jig touched the element (e.g. a JSX
// `style={{"--v1-dur": "240ms"}}`), so reset restores them instead of deleting.
const originals = new WeakMap<HTMLElement, Map<string, string>>();

function rememberOriginal(el: HTMLElement, name: string): void {
  let map = originals.get(el);
  if (!map) {
    map = new Map();
    originals.set(el, map);
  }
  if (!map.has(name)) map.set(name, el.style.getPropertyValue(name));
}

function loadStored(
  group: VariantGroup,
  variant: Variant
): Record<string, string> {
  const raw = readStorage(jigStorageKey(group, variant));
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return {};
    const out: Record<string, string> = {};
    for (const [name, value] of Object.entries(parsed)) {
      if (variant.jigs.includes(name) && typeof value === "string") {
        out[name] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function saveStored(
  group: VariantGroup,
  variant: Variant,
  values: Record<string, string>
): void {
  const key = jigStorageKey(group, variant);
  writeStorage(key, Object.keys(values).length ? JSON.stringify(values) : null);
}

export function setJig(
  group: VariantGroup,
  variant: Variant,
  name: string,
  value: string
): void {
  rememberOriginal(variant.element, name);
  variant.element.style.setProperty(name, value);
  saveStored(group, variant, { ...loadStored(group, variant), [name]: value });
}

export function resetJig(
  group: VariantGroup,
  variant: Variant,
  name: string
): void {
  const original = originals.get(variant.element)?.get(name);
  if (original) variant.element.style.setProperty(name, original);
  else variant.element.style.removeProperty(name);
  const stored = loadStored(group, variant);
  delete stored[name];
  saveStored(group, variant, stored);
}

export function resetAllJigs(group: VariantGroup, variant: Variant): void {
  for (const name of variant.jigs) resetJig(group, variant, name);
}

/** Re-applies tuned values from this session, e.g. after a reload or HMR. */
export function restoreJigs(group: VariantGroup): void {
  for (const variant of group.variants) {
    for (const [name, value] of Object.entries(loadStored(group, variant))) {
      rememberOriginal(variant.element, name);
      variant.element.style.setProperty(name, value);
    }
  }
}

export function serializeJigs(variant: Variant): string {
  return variant.jigs
    .map((name) => `${name}: ${readJig(variant.element, name)};`)
    .join("\n");
}

function setRate(target: Element, rate: number): void {
  if (typeof target.getAnimations !== "function") return;
  for (const animation of target.getAnimations()) {
    animation.playbackRate = rate;
  }
}

const speeds = new WeakMap<HTMLElement, number>();

/**
 * Slow motion for everything animating inside the variant: running animations
 * immediately, plus CSS animations and transitions (hover, focus) that start
 * later. The variant element's own transitions are the picker's crossfade and
 * are left alone.
 */
export function setPlaybackSpeed(el: HTMLElement, rate: number): void {
  if (!speeds.has(el)) {
    const onStart = (event: Event): void => {
      const target = event.target;
      if (target === el || !(target instanceof Element)) return;
      setRate(target, speeds.get(el) ?? 1);
    };
    el.addEventListener("animationstart", onStart, true);
    el.addEventListener("transitionrun", onStart, true);
  }
  speeds.set(el, rate);
  if (typeof el.getAnimations !== "function") return;
  for (const animation of el.getAnimations({ subtree: true })) {
    if (animation.effect && "target" in animation.effect) {
      if ((animation.effect as KeyframeEffect).target === el) continue;
    }
    animation.playbackRate = rate;
  }
}

/**
 * Restarts the variant's CSS animations (entrances included — finished
 * animations aren't reachable via getAnimations) by toggling display, which
 * the CSS Animations spec treats as a fresh start.
 */
export function replayAnimations(el: HTMLElement): void {
  const display = el.style.getPropertyValue("display");
  const priority = el.style.getPropertyPriority("display");
  el.style.setProperty("display", "none", "important");
  void el.offsetWidth;
  if (display) el.style.setProperty("display", display, priority);
  else el.style.removeProperty("display");
  setPlaybackSpeed(el, speeds.get(el) ?? 1);
}
