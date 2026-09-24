export interface Variant {
  element: HTMLElement;
  index: number;
  label: string;
  description: string | null;
  /** CSS custom properties exposed as live controls (`data-aitd-jigs`). */
  jigs: string[];
}

export interface PickerConfig {
  transition: "crossfade" | "slide" | "none";
  theme: "light" | "dark" | "auto";
  branding: boolean;
  position: "bottom-center" | "bottom-left" | "bottom-right" | "top-center";
}

export interface VariantGroup {
  container: HTMLElement;
  id: string;
  variants: Variant[];
  activeIndex: number;
  config: PickerConfig;
}

export const DEFAULT_CONFIG: PickerConfig = {
  transition: "crossfade",
  theme: "auto",
  branding: true,
  position: "bottom-center"
};

const VALID_TRANSITIONS = ["crossfade", "slide", "none"] as const;
const VALID_THEMES = ["light", "dark", "auto"] as const;
const VALID_POSITIONS = [
  "bottom-center",
  "bottom-left",
  "bottom-right",
  "top-center"
] as const;

export function parseConfig(container: HTMLElement): PickerConfig {
  const raw = {
    transition: container.getAttribute("data-aitd-transition"),
    theme: container.getAttribute("data-aitd-theme"),
    branding: container.getAttribute("data-aitd-branding"),
    position: container.getAttribute("data-aitd-position")
  };

  const transition = VALID_TRANSITIONS.includes(
    raw.transition as (typeof VALID_TRANSITIONS)[number]
  )
    ? (raw.transition as PickerConfig["transition"])
    : DEFAULT_CONFIG.transition;

  const theme = VALID_THEMES.includes(
    raw.theme as (typeof VALID_THEMES)[number]
  )
    ? (raw.theme as PickerConfig["theme"])
    : DEFAULT_CONFIG.theme;

  const position = VALID_POSITIONS.includes(
    raw.position as (typeof VALID_POSITIONS)[number]
  )
    ? (raw.position as PickerConfig["position"])
    : DEFAULT_CONFIG.position;

  const branding =
    raw.branding === "false"
      ? false
      : raw.branding === "true"
        ? true
        : DEFAULT_CONFIG.branding;

  return { transition, theme, branding, position };
}
