import type { Variant, VariantGroup } from "./types";

const QUERY_PARAM = "aitd";

function storageKey(groupId: string): string {
  return `aitd:${location.pathname}:${groupId}`;
}

export function readStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode, sandboxed iframe) — selection just won't persist.
  }
}

/** `?aitd-toolbar=off` applies the selection without mounting toolbars, so
 * screenshots show the variant unobstructed. */
export function isToolbarDisabled(): boolean {
  try {
    return new URLSearchParams(location.search).get("aitd-toolbar") === "off";
  } catch {
    return false;
  }
}

function readQueryIndex(): number | null {
  try {
    const raw = new URLSearchParams(location.search).get(QUERY_PARAM);
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

/**
 * Picks the variant to show first: `?aitd=<n>` (matched against the
 * `data-aitd-variant` value) wins, then the label remembered for this group in
 * sessionStorage, then the first variant. Matching the stored label rather
 * than a position keeps the choice stable when variants are reordered.
 */
export function resolveInitialIndex(group: VariantGroup): number {
  const fromQuery = readQueryIndex();
  if (fromQuery !== null) {
    const i = group.variants.findIndex((v) => v.index === fromQuery);
    if (i !== -1) return i;
  }

  const label = readStorage(storageKey(group.id));
  if (label !== null) {
    const i = group.variants.findIndex((v) => v.label === label);
    if (i !== -1) return i;
  }

  return 0;
}

export function rememberSelection(group: VariantGroup, variant: Variant): void {
  writeStorage(storageKey(group.id), variant.label);
}

export function jigStorageKey(group: VariantGroup, variant: Variant): string {
  return `${storageKey(group.id)}:jigs:${variant.label}`;
}
