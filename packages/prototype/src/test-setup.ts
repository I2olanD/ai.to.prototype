import { afterEach } from "vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })
});

// Selection and jig values persist in sessionStorage; keep tests independent.
afterEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});
