import {
  formatNumeric,
  inferControl,
  type JigControl,
  readJig,
  replayAnimations,
  resetAllJigs,
  resetJig,
  serializeJigs,
  setJig,
  setPlaybackSpeed
} from "./jigs";
import type { Variant, VariantGroup } from "./types";

export const JIG_PANEL_ID = "aitd-jigs";

const MONO = "11px ui-monospace,SFMono-Regular,Menlo,monospace";

export const JIG_PANEL_STYLES = `.jigs{background:var(--bg);border:1px solid var(--border);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-radius:10px;padding:10px 12px;box-shadow:0 2px 12px rgba(0,0,0,.15);font:12px system-ui,-apple-system,sans-serif;color:var(--text);width:320px;max-width:calc(100vw - 32px);max-height:min(60vh,420px);overflow:auto;box-sizing:border-box;display:flex;flex-direction:column;gap:8px}.jigs-title{font-weight:600}.jig-row{display:grid;grid-template-columns:92px 1fr auto;align-items:center;gap:8px}.jig-name{color:var(--muted);font:${MONO};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.jig-field{display:flex;align-items:center;gap:6px;min-width:0}.jig-field input[type=range]{flex:1;min-width:0;accent-color:var(--text)}.jig-input,.jig-copy{font:${MONO};color:var(--text);background:transparent;border:1px solid var(--border);border-radius:4px;padding:2px 4px;min-width:0;box-sizing:border-box}.jig-num{width:60px}.jig-stack{flex-direction:column;align-items:stretch;gap:4px}.jig-stack>*{width:100%}.jig-text{flex:1}.jig-field input[type=color]{width:28px;height:20px;padding:0;border:1px solid var(--border);border-radius:4px;background:none;flex-shrink:0}.jig-unit,.jig-hint{color:var(--muted);font-size:11px}.jig-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:8px}.jig-action{all:unset;cursor:pointer;padding:3px 8px;border-radius:4px;border:1px solid var(--border);font-size:11px}.jig-action:hover{background:var(--hover)}.jig-action:focus-visible{outline:2px solid var(--text);outline-offset:1px}.jig-copy{width:100%;height:72px;resize:vertical}`;

export interface JigPanel {
  element: HTMLElement;
  render: () => void;
}

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function actionButton(text: string, ariaLabel?: string): HTMLButtonElement {
  const btn = make("button", "jig-action", text);
  btn.setAttribute("type", "button");
  if (ariaLabel) btn.setAttribute("aria-label", ariaLabel);
  return btn;
}

function numericField(
  control: Extract<JigControl, { unit: string }>,
  id: string,
  name: string,
  apply: (value: string) => void
): HTMLElement[] {
  const range = make("input", "");
  range.type = "range";
  range.id = id;
  const num = make("input", "jig-input jig-num");
  num.type = "number";
  num.setAttribute("aria-label", `${name} value`);
  for (const input of [range, num]) {
    input.min = String(control.min);
    input.max = String(control.max);
    input.step = String(control.step);
    input.value = String(control.value);
  }

  range.addEventListener("input", () => {
    num.value = range.value;
    apply(formatNumeric(Number(range.value), control.unit));
  });
  num.addEventListener("input", () => {
    const n = Number(num.value);
    if (num.value === "" || !Number.isFinite(n)) return;
    // Typed values may exceed the inferred range; widen it instead of clamping.
    if (n > Number(range.max)) range.max = String(n);
    if (n < Number(range.min)) range.min = String(n);
    range.value = num.value;
    apply(formatNumeric(n, control.unit));
  });

  const unit = make("span", "jig-unit", control.unit);
  return [range, num, unit];
}

function colorField(
  hex: string,
  id: string,
  apply: (value: string) => void
): HTMLElement[] {
  const input = make("input", "");
  input.type = "color";
  input.id = id;
  input.value = hex;
  const readout = make("span", "jig-unit", hex);
  input.addEventListener("input", () => {
    readout.textContent = input.value;
    apply(input.value);
  });
  return [input, readout];
}

function easingField(
  current: string,
  presets: string[],
  id: string,
  name: string,
  apply: (value: string) => void
): HTMLElement[] {
  const select = make("select", "jig-input");
  select.id = id;
  for (const value of presets.includes(current)
    ? presets
    : [current, ...presets]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
  select.value = current;
  const text = make("input", "jig-input jig-text");
  text.type = "text";
  text.value = current;
  text.setAttribute("aria-label", `${name} custom value`);

  select.addEventListener("change", () => {
    text.value = select.value;
    apply(select.value);
  });
  text.addEventListener("change", () => apply(text.value));
  return [select, text];
}

function textField(
  current: string,
  id: string,
  apply: (value: string) => void
): HTMLElement[] {
  const input = make("input", "jig-input jig-text");
  input.type = "text";
  input.id = id;
  input.value = current;
  input.addEventListener("change", () => apply(input.value));
  return [input];
}

function buildRow(
  group: VariantGroup,
  variant: Variant,
  name: string,
  id: string,
  rerender: () => void
): HTMLElement {
  const row = make("div", "jig-row");
  const label = make("label", "jig-name", name.replace(/^--/, ""));
  label.htmlFor = id;
  label.title = name;

  const current = readJig(variant.element, name);
  const control = inferControl(current);
  const apply = (value: string): void => setJig(group, variant, name, value);

  // Easing gets a preset menu plus a free-text field; stack them so neither
  // collapses in the narrow panel.
  const field = make(
    "div",
    control.kind === "easing" ? "jig-field jig-stack" : "jig-field"
  );
  const parts =
    control.kind === "color"
      ? colorField(control.hex, id, apply)
      : control.kind === "easing"
        ? easingField(current, control.presets, id, name, apply)
        : control.kind === "text"
          ? textField(current, id, apply)
          : numericField(control, id, name, apply);
  field.append(...parts);

  const reset = actionButton("↺", `Reset ${name}`);
  reset.addEventListener("click", () => {
    resetJig(group, variant, name);
    rerender();
  });

  row.append(label, field, reset);
  return row;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API missing or denied (file://, insecure origin).
    return false;
  }
}

/**
 * Live controls for the active variant's `data-aitd-jigs`. Lives outside the
 * `[role=toolbar]` element so typing digits into a field never triggers the
 * toolbar's variant-switch shortcuts.
 */
export function createJigPanel(
  group: VariantGroup,
  onClose: () => void
): JigPanel {
  const panel = make("div", "jigs");
  panel.id = JIG_PANEL_ID;
  panel.setAttribute("role", "group");
  panel.hidden = true;
  let speed = 1;

  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  });

  const render = (): void => {
    const variant = group.variants[group.activeIndex];
    panel.setAttribute("aria-label", `Jigs for ${variant.label}`);
    panel.replaceChildren(make("div", "jigs-title", `Jigs · ${variant.label}`));

    variant.jigs.forEach((name, i) => {
      panel.appendChild(
        buildRow(group, variant, name, `aitd-jig-${i}`, render)
      );
    });

    const actions = make("div", "jig-actions");
    const replay = actionButton("Replay", "Replay animations");
    replay.addEventListener("click", () => replayAnimations(variant.element));

    const speedSelect = make("select", "jig-input");
    speedSelect.setAttribute("aria-label", "Animation speed");
    for (const rate of [1, 0.5, 0.25]) {
      const option = document.createElement("option");
      option.value = String(rate);
      option.textContent = `${rate}×`;
      speedSelect.appendChild(option);
    }
    speedSelect.value = String(speed);
    speedSelect.addEventListener("change", () => {
      speed = Number(speedSelect.value);
      setPlaybackSpeed(variant.element, speed);
    });
    if (speed !== 1) setPlaybackSpeed(variant.element, speed);

    const resetAll = actionButton("Reset", "Reset all jigs");
    resetAll.addEventListener("click", () => {
      resetAllJigs(group, variant);
      render();
    });

    const copy = actionButton("Copy", "Copy jig values as CSS");
    copy.addEventListener("click", async () => {
      const css = serializeJigs(variant);
      if (await copyText(css)) {
        copy.textContent = "Copied";
        setTimeout(() => {
          copy.textContent = "Copy";
        }, 1200);
        return;
      }
      const fallback = make("textarea", "jig-copy");
      fallback.readOnly = true;
      fallback.value = css;
      fallback.setAttribute("aria-label", "Jig values as CSS");
      panel.querySelector(".jig-copy")?.remove();
      panel.appendChild(fallback);
      fallback.select();
    });

    actions.append(replay, speedSelect, resetAll, copy);
    panel.appendChild(actions);
    panel.appendChild(
      make(
        "div",
        "jig-hint",
        "Speed also applies to hover and click transitions."
      )
    );
  };

  return { element: panel, render };
}
