import type { PickerConfig, VariantGroup } from "./types";

const SLIDE_DISTANCE_PX = 16;

export function initializeVisibility(
  group: VariantGroup,
  startIndex: number = 0
): void {
  group.activeIndex = startIndex;
  for (let i = 0; i < group.variants.length; i++) {
    const variant = group.variants[i];
    if (i === startIndex) {
      variant.element.style.display = "";
      variant.element.setAttribute("data-aitd-active", "");
    } else {
      variant.element.removeAttribute("data-aitd-active");
      variant.element.style.setProperty("display", "none", "important");
    }
  }
}

/**
 * `direction` only affects the slide transition (1 = next enters from the
 * right). It defaults to the index order; callers that wrap around (next on
 * the last variant) pass it explicitly so the motion matches the button.
 */
export function switchVariant(
  group: VariantGroup,
  targetIndex: number,
  direction: 1 | -1 = targetIndex > group.activeIndex ? 1 : -1
): void {
  if (targetIndex === group.activeIndex) return;

  const prev = group.variants[group.activeIndex];
  const next = group.variants[targetIndex];

  prev.element.removeAttribute("data-aitd-active");
  next.element.setAttribute("data-aitd-active", "");
  group.activeIndex = targetIndex;

  if (shouldAnimate(group.config)) {
    const shift =
      group.config.transition === "slide" ? SLIDE_DISTANCE_PX * direction : 0;
    startTransition(prev.element, next.element, shift);
  } else {
    prev.element.style.setProperty("display", "none", "important");
    next.element.style.display = "";
  }
}

function shouldAnimate(config: PickerConfig): boolean {
  if (config.transition === "none") return false;
  try {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function clearTransitionStyles(el: HTMLElement): void {
  el.style.removeProperty("transition");
  el.style.removeProperty("opacity");
  el.style.removeProperty("transform");
}

// Two-phase: fade (and, for slide, shift) the old variant out, then bring the
// new one in. `shift` is 0 for crossfade.
function startTransition(
  prev: HTMLElement,
  next: HTMLElement,
  shift: number
): void {
  const transition = shift
    ? "opacity 150ms ease, transform 150ms ease"
    : "opacity 150ms ease";

  prev.style.transition = transition;
  prev.style.opacity = "0";
  if (shift) prev.style.transform = `translateX(${-shift}px)`;
  next.style.display = "";
  next.style.opacity = "0";
  if (shift) next.style.transform = `translateX(${shift}px)`;

  const onPrevEnd = (): void => {
    prev.removeEventListener("transitionend", onPrevEnd);
    prev.style.setProperty("display", "none", "important");
    clearTransitionStyles(prev);
    next.style.transition = transition;
    next.style.opacity = "1";
    if (shift) next.style.transform = "translateX(0)";

    const onNextEnd = (): void => {
      next.removeEventListener("transitionend", onNextEnd);
      clearTransitionStyles(next);
    };
    next.addEventListener("transitionend", onNextEnd);
  };
  prev.addEventListener("transitionend", onPrevEnd);
}

export function getNextIndex(current: number, total: number): number {
  return (current + 1) % total;
}

export function getPrevIndex(current: number, total: number): number {
  return (current - 1 + total) % total;
}
