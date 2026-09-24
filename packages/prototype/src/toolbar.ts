import { announceVariant, bindKeyboardNavigation } from "./accessibility";
import { createJigPanel, JIG_PANEL_ID, JIG_PANEL_STYLES } from "./jig-panel";
import { restoreJigs } from "./jigs";
import { rememberSelection } from "./persistence";
import { switchVariant } from "./switcher";
import type { PickerConfig, VariantGroup } from "./types";

export interface ToolbarHandle {
  host: HTMLElement;
  shadow: ShadowRoot;
  liveRegion: HTMLElement;
  destroy: () => void;
}

export function getToolbarStyles(config: PickerConfig): string {
  const darkVars = `--bg:rgba(30,30,30,.9);--border:rgba(255,255,255,.12);--text:#eee;--muted:#999;--hover:rgba(255,255,255,.07);color-scheme:dark`;
  const lightVars = `--bg:rgba(255,255,255,.88);--border:rgba(0,0,0,.1);--text:#111;--muted:#666;--hover:rgba(0,0,0,.05);color-scheme:light`;
  const forced =
    config.theme === "dark"
      ? darkVars
      : config.theme === "light"
        ? lightVars
        : "";

  // Theme variables live on :host so the toolbar and the jig panel share them.
  return `:host{${forced || lightVars}}[hidden]{display:none!important}.stack{display:flex;flex-direction:column;align-items:center;gap:6px}.stack.top{flex-direction:column-reverse}.w{display:flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--border);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-radius:10px;padding:6px 12px;box-shadow:0 2px 12px rgba(0,0,0,.15);font:12px system-ui,-apple-system,sans-serif;color:var(--text);box-sizing:border-box;user-select:none}${!forced ? `@media(prefers-color-scheme:dark){:host{${darkVars}}}` : ""}.nav-btn{all:unset;cursor:pointer;padding:4px 6px;border-radius:4px;opacity:.6;flex-shrink:0;font-size:14px;line-height:1}.nav-btn:hover{opacity:1;background:var(--hover)}.nav-btn:focus-visible{outline:2px solid var(--text);outline-offset:1px}.nav-btn:disabled{opacity:.2;cursor:default}.label{font-weight:600;white-space:nowrap;width:180px;text-overflow:ellipsis;overflow:hidden;flex-shrink:0}.counter{color:var(--muted);font-size:11px;white-space:nowrap}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0}.branding{opacity:.4;flex-shrink:0;display:flex;align-items:center}.jig-btn{font-size:11px;font-weight:600;border:1px solid var(--border);padding:3px 8px}.jig-btn[aria-expanded=true]{opacity:1;background:var(--hover)}${JIG_PANEL_STYLES}`;
}

const POSITIONS: Record<PickerConfig["position"], string> = {
  "bottom-center":
    "bottom:16px;left:50%;transform:translateX(-50%);align-items:center",
  "bottom-left": "bottom:16px;left:16px;align-items:flex-start",
  "bottom-right": "bottom:16px;right:16px;align-items:flex-end",
  "top-center":
    "top:16px;left:50%;transform:translateX(-50%);align-items:center"
};

// One fixed dock per position; each group's toolbar host is a flex child, so
// several groups on one page stack instead of rendering on top of each other.
const docks = new Map<PickerConfig["position"], HTMLElement>();

function getDock(position: PickerConfig["position"]): HTMLElement {
  const existing = docks.get(position);
  if (existing?.isConnected) return existing;
  const dock = document.createElement("div");
  dock.setAttribute("data-aitd-dock", position);
  dock.setAttribute(
    "style",
    `position:fixed;z-index:2147483640;display:flex;flex-direction:column;gap:8px;${POSITIONS[position]}`
  );
  document.body.appendChild(dock);
  docks.set(position, dock);
  return dock;
}

function releaseDock(
  position: PickerConfig["position"],
  dock: HTMLElement
): void {
  if (dock.childElementCount > 0) return;
  dock.remove();
  if (docks.get(position) === dock) docks.delete(position);
}

function buildBranding(): HTMLElement {
  const span = document.createElement("span");
  span.className = "branding";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="16" height="16" role="img" aria-label="ai.to.design"><defs><radialGradient id="aitd-c1" cx="50%" cy="5%" r="75%"><stop offset="0%" stop-color="#00FF9C" stop-opacity="1"/><stop offset="100%" stop-color="#00FF9C" stop-opacity="0"/></radialGradient><radialGradient id="aitd-c2" cx="95%" cy="62%" r="75%"><stop offset="0%" stop-color="#00D9FF" stop-opacity="1"/><stop offset="100%" stop-color="#00D9FF" stop-opacity="0"/></radialGradient><radialGradient id="aitd-c3" cx="72%" cy="97%" r="75%"><stop offset="0%" stop-color="#BF6FFF" stop-opacity="1"/><stop offset="100%" stop-color="#BF6FFF" stop-opacity="0"/></radialGradient><radialGradient id="aitd-c4" cx="28%" cy="97%" r="75%"><stop offset="0%" stop-color="#FF4D1C" stop-opacity="1"/><stop offset="100%" stop-color="#FF4D1C" stop-opacity="0"/></radialGradient><radialGradient id="aitd-c5" cx="5%" cy="62%" r="75%"><stop offset="0%" stop-color="#FF8A75" stop-opacity="1"/><stop offset="100%" stop-color="#FF8A75" stop-opacity="0"/></radialGradient><clipPath id="aitd-clip"><circle cx="200" cy="200" r="200"/></clipPath></defs><circle cx="200" cy="200" r="200" fill="#00FF9C"/><g clip-path="url(#aitd-clip)"><rect x="0" y="0" width="400" height="400" fill="url(#aitd-c1)"/><rect x="0" y="0" width="400" height="400" fill="url(#aitd-c2)"/><rect x="0" y="0" width="400" height="400" fill="url(#aitd-c3)"/><rect x="0" y="0" width="400" height="400" fill="url(#aitd-c4)"/><rect x="0" y="0" width="400" height="400" fill="url(#aitd-c5)"/></g></svg>`;
  return span;
}

function buildNavButton(label: string, ariaLabel: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.setAttribute("type", "button");
  btn.setAttribute("aria-label", ariaLabel);
  btn.className = "nav-btn";
  btn.textContent = label;
  return btn;
}

function setLabel(label: Element, group: VariantGroup): void {
  const variant = group.variants[group.activeIndex];
  label.textContent = variant.label;
  if (variant.description) label.setAttribute("title", variant.description);
  else label.removeAttribute("title");
}

export function updateLabel(shadow: ShadowRoot, group: VariantGroup): void {
  const label = shadow.querySelector(".label");
  const counter = shadow.querySelector(".counter");
  if (label) {
    setLabel(label, group);
  }
  if (counter) {
    counter.textContent = `${group.activeIndex + 1}/${group.variants.length}`;
  }
}

export function createToolbar(group: VariantGroup): ToolbarHandle {
  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = getToolbarStyles(group.config);
  shadow.appendChild(style);

  const toolbar = document.createElement("div");
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "UI prototype picker");
  toolbar.className = "w";

  if (group.config.branding) toolbar.appendChild(buildBranding());

  const prevBtn = buildNavButton("\u25c0", "Previous variant");
  const nextBtn = buildNavButton("\u25b6", "Next variant");

  const label = document.createElement("span");
  label.className = "label";
  setLabel(label, group);

  const counter = document.createElement("span");
  counter.className = "counter";
  counter.textContent = `${group.activeIndex + 1}/${group.variants.length}`;

  toolbar.appendChild(prevBtn);
  toolbar.appendChild(label);
  toolbar.appendChild(counter);
  toolbar.appendChild(nextBtn);

  const stack = document.createElement("div");
  stack.className =
    group.config.position === "top-center" ? "stack top" : "stack";

  // Groups without any jigs keep the original toolbar untouched.
  let syncJigs = (): void => {};
  if (group.variants.some((v) => v.jigs.length > 0)) {
    restoreJigs(group);
    const jigBtn = buildNavButton("Jigs", "Adjust design tokens");
    jigBtn.classList.add("jig-btn");
    jigBtn.setAttribute("aria-controls", JIG_PANEL_ID);
    jigBtn.setAttribute("aria-expanded", "false");

    let isOpen = false;
    const setOpen = (open: boolean): void => {
      isOpen = open;
      panel.element.hidden = !open;
      jigBtn.setAttribute("aria-expanded", String(open));
      if (open) panel.render();
    };
    const panel = createJigPanel(group, () => {
      setOpen(false);
      jigBtn.focus();
    });

    jigBtn.addEventListener("click", () => setOpen(!isOpen));
    syncJigs = () => {
      const hasJigs = group.variants[group.activeIndex].jigs.length > 0;
      jigBtn.hidden = !hasJigs;
      if (!hasJigs) setOpen(false);
      else if (isOpen) panel.render();
    };
    syncJigs();

    toolbar.appendChild(jigBtn);
    stack.appendChild(panel.element);
  }

  stack.appendChild(toolbar);
  shadow.appendChild(stack);

  const liveRegion = document.createElement("div");
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.setAttribute("aria-atomic", "true");
  liveRegion.className = "sr-only";
  shadow.appendChild(liveRegion);

  const performSwitch = (i: number, direction?: 1 | -1): void => {
    switchVariant(group, i, direction);
    rememberSelection(group, group.variants[group.activeIndex]);
    updateLabel(shadow, group);
    syncJigs();
    announceVariant(
      liveRegion,
      group.variants[group.activeIndex],
      group.variants.length
    );
  };

  prevBtn.addEventListener("click", () => {
    const total = group.variants.length;
    performSwitch((group.activeIndex - 1 + total) % total, -1);
  });

  nextBtn.addEventListener("click", () => {
    const total = group.variants.length;
    performSwitch((group.activeIndex + 1) % total, 1);
  });

  bindKeyboardNavigation(shadow, group, performSwitch);

  const position = group.config.position;
  const dock = getDock(position);
  dock.appendChild(host);

  const destroy = (): void => {
    host.remove();
    releaseDock(position, dock);
  };

  return { host, shadow, liveRegion, destroy };
}
