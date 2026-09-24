import type { Variant, VariantGroup } from "./types";

export function announceVariant(
  liveRegion: HTMLElement,
  variant: Variant,
  total: number
): void {
  const detail = variant.description ? ` — ${variant.description}` : "";
  liveRegion.textContent = `Showing variant: ${variant.label} (${variant.index} of ${total})${detail}`;
}

export function bindKeyboardNavigation(
  shadow: ShadowRoot,
  group: VariantGroup,
  onSwitch: (targetIndex: number) => void
): void {
  const toolbar = shadow.querySelector("[role='toolbar']");
  if (!toolbar) return;
  toolbar.addEventListener("keydown", (event) => {
    handleKeyDown(event as KeyboardEvent, group, onSwitch);
  });
}

function handleKeyDown(
  event: KeyboardEvent,
  group: VariantGroup,
  onSwitch: (i: number) => void
): void {
  const total = group.variants.length;
  if (event.key === "ArrowRight") {
    event.preventDefault();
    onSwitch((group.activeIndex + 1) % total);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    onSwitch((group.activeIndex - 1 + total) % total);
  } else {
    const num = parseInt(event.key, 10);
    if (num >= 1 && num <= 9 && num <= total) {
      event.preventDefault();
      onSwitch(num - 1);
    }
  }
}
