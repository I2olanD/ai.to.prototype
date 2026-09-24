import { discoverVariantGroups, parseVariantGroup } from "./discovery";
import { restoreJigs } from "./jigs";
import { isToolbarDisabled, resolveInitialIndex } from "./persistence";
import { initializeVisibility } from "./switcher";
import { createToolbar, type ToolbarHandle } from "./toolbar";
import type { VariantGroup } from "./types";

const CONTAINER = "[data-aitd-variants]";

// A Map (not WeakMap) because removal handling has to iterate it to find
// containers that fell out of the document; entries are deleted on unmount.
// `null` marks a group mounted without a toolbar (`?aitd-toolbar=off`).
const mounted = new Map<HTMLElement, ToolbarHandle | null>();

function mountGroup(group: VariantGroup): void {
  if (mounted.has(group.container) || group.variants.length < 2) return;
  initializeVisibility(group, resolveInitialIndex(group));
  if (isToolbarDisabled()) {
    restoreJigs(group);
    mounted.set(group.container, null);
  } else {
    mounted.set(group.container, createToolbar(group));
  }
}

function mount(container: HTMLElement): void {
  if (!mounted.has(container)) mountGroup(parseVariantGroup(container));
}

function unmount(container: HTMLElement): void {
  mounted.get(container)?.destroy();
  mounted.delete(container);
}

export function init(): void {
  for (const group of discoverVariantGroups()) mountGroup(group);
}

function handleMutation(mutations: MutationRecord[]): void {
  const changed = new Set<HTMLElement>();
  let removedAny = false;

  for (const mutation of mutations) {
    if (mutation.removedNodes.length > 0) removedAny = true;
    // HMR / re-render swapped the variant children of a live group.
    if (
      mutation.target instanceof HTMLElement &&
      mounted.has(mutation.target)
    ) {
      changed.add(mutation.target);
    }
    for (const node of mutation.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      // `closest` covers the node itself and a variant added into a container
      // that had too few variants to mount earlier.
      const owner = node.closest<HTMLElement>(CONTAINER);
      if (owner) mount(owner);
      for (const nested of node.querySelectorAll<HTMLElement>(CONTAINER)) {
        mount(nested);
      }
    }
  }

  if (removedAny) {
    for (const container of mounted.keys()) {
      if (!container.isConnected) unmount(container);
    }
  }
  for (const container of changed) {
    if (!container.isConnected) continue;
    unmount(container);
    mount(container);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

const observer = new MutationObserver(handleMutation);
observer.observe(document.body, { childList: true, subtree: true });
