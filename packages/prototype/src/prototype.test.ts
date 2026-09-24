import { afterEach, describe, expect, it } from "vitest";
import { init } from "./prototype";

afterEach(async () => {
  document.body.innerHTML = "";
  await flush();
});

// MutationObserver callbacks run as microtasks.
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function toolbarCount(): number {
  return document.querySelectorAll("[data-aitd-dock] > *").length;
}

function makeVariantHtml(count: number): string {
  const variants = Array.from(
    { length: count },
    (_, i) =>
      `<div data-aitd-variant="${i + 1}" data-aitd-label="Variant ${i + 1}">Content ${i + 1}</div>`
  ).join("");
  return `<div data-aitd-variants>${variants}</div>`;
}

describe("init", () => {
  it("shows only the first variant and hides the rest", () => {
    document.body.innerHTML = makeVariantHtml(3);
    init();

    const variants = document.querySelectorAll("[data-aitd-variant]");
    expect(variants[0].getAttribute("data-aitd-active")).toBe("");
    expect((variants[1] as HTMLElement).style.display).toBe("none");
    expect((variants[2] as HTMLElement).style.display).toBe("none");
  });

  it("skips groups with fewer than 2 variants", () => {
    document.body.innerHTML = makeVariantHtml(1);
    init();

    const variant = document.querySelector(
      "[data-aitd-variant]"
    ) as HTMLElement;
    expect(variant.hasAttribute("data-aitd-active")).toBe(false);
  });

  it("initializes all groups with 2+ variants", () => {
    document.body.innerHTML = makeVariantHtml(2) + makeVariantHtml(3);
    init();

    const groups = document.querySelectorAll("[data-aitd-variants]");
    const firstOfGroup1 = groups[0].querySelector(
      "[data-aitd-variant]"
    ) as HTMLElement;
    const firstOfGroup2 = groups[1].querySelector(
      "[data-aitd-variant]"
    ) as HTMLElement;

    expect(firstOfGroup1.hasAttribute("data-aitd-active")).toBe(true);
    expect(firstOfGroup2.hasAttribute("data-aitd-active")).toBe(true);
  });

  it("does nothing when no variant containers exist", () => {
    document.body.innerHTML = "<div>Regular content</div>";
    expect(() => init()).not.toThrow();
  });

  it("does not create a second toolbar when called twice", () => {
    document.body.innerHTML = makeVariantHtml(2);
    init();
    init();
    expect(toolbarCount()).toBe(1);
  });

  it("stacks toolbars of multiple groups in one dock", () => {
    document.body.innerHTML = makeVariantHtml(2) + makeVariantHtml(3);
    init();
    expect(document.querySelectorAll("[data-aitd-dock]")).toHaveLength(1);
    expect(toolbarCount()).toBe(2);
  });

  it("restores the variant from ?aitd=<n>", () => {
    window.history.replaceState(null, "", "/?aitd=2");
    document.body.innerHTML = makeVariantHtml(3);
    init();
    const variants = document.querySelectorAll("[data-aitd-variant]");
    expect(variants[1].hasAttribute("data-aitd-active")).toBe(true);
    expect((variants[0] as HTMLElement).style.display).toBe("none");
  });
});

describe("?aitd-toolbar=off", () => {
  it("applies the selection without mounting a toolbar", () => {
    window.history.replaceState(null, "", "/?aitd=2&aitd-toolbar=off");
    document.body.innerHTML = makeVariantHtml(3);
    init();
    expect(document.querySelector("[data-aitd-dock]")).toBeNull();
    const variants = document.querySelectorAll("[data-aitd-variant]");
    expect(variants[1].hasAttribute("data-aitd-active")).toBe(true);
  });
});

describe("mutation observer", () => {
  it("mounts a container nested inside an added subtree", async () => {
    const wrapper = document.createElement("section");
    wrapper.innerHTML = `<div>${makeVariantHtml(2)}</div>`;
    document.body.appendChild(wrapper);
    await flush();
    expect(toolbarCount()).toBe(1);
  });

  it("mounts a container once enough variants are added", async () => {
    document.body.innerHTML = makeVariantHtml(1);
    init();
    await flush();
    expect(toolbarCount()).toBe(0);

    const container = document.querySelector(
      "[data-aitd-variants]"
    ) as HTMLElement;
    const second = document.createElement("div");
    second.setAttribute("data-aitd-variant", "2");
    second.setAttribute("data-aitd-label", "Variant 2");
    container.appendChild(second);
    await flush();
    expect(toolbarCount()).toBe(1);
  });

  it("removes the toolbar when its container is removed", async () => {
    document.body.innerHTML = `<main>${makeVariantHtml(2)}</main>`;
    init();
    expect(toolbarCount()).toBe(1);
    (document.querySelector("main") as HTMLElement).remove();
    await flush();
    expect(toolbarCount()).toBe(0);
  });

  it("keeps one toolbar and the selection when HMR replaces the container", async () => {
    document.body.innerHTML = `<main>${makeVariantHtml(3)}</main>`;
    init();
    const main = document.querySelector("main") as HTMLElement;
    const group = main.querySelector("[data-aitd-variants]") as HTMLElement;
    const variants = group.querySelectorAll("[data-aitd-variant]");
    // Simulate the user having picked variant 2 before the reload.
    window.sessionStorage.setItem(
      `aitd:${location.pathname}:aitd-group-1`,
      "Variant 2"
    );
    expect(variants.length).toBe(3);

    main.replaceChildren(group.cloneNode(true));
    await flush();

    expect(toolbarCount()).toBe(1);
    const fresh = main.querySelectorAll("[data-aitd-variant]");
    expect(fresh[1].hasAttribute("data-aitd-active")).toBe(true);
    expect((fresh[0] as HTMLElement).style.display).toBe("none");
  });

  it("re-mounts when a live group's variant children are swapped", async () => {
    document.body.innerHTML = makeVariantHtml(2);
    init();
    const container = document.querySelector(
      "[data-aitd-variants]"
    ) as HTMLElement;
    const replacement = document.createElement("div");
    replacement.innerHTML = makeVariantHtml(3);
    const inner = replacement.firstElementChild as HTMLElement;
    container.replaceChildren(...Array.from(inner.children));
    await flush();

    expect(toolbarCount()).toBe(1);
    const hidden = Array.from(
      container.querySelectorAll<HTMLElement>("[data-aitd-variant]")
    ).filter((v) => v.style.display === "none");
    expect(hidden).toHaveLength(2);
  });
});
