import { afterEach, describe, expect, it } from "vitest";
import { discoverVariantGroups } from "./discovery";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("discoverVariantGroups", () => {
  it("returns empty array when no containers exist", () => {
    document.body.innerHTML = "<div>Regular page content</div>";
    expect(discoverVariantGroups()).toHaveLength(0);
  });

  it("discovers a single group with multiple variants", () => {
    document.body.innerHTML = `
      <div data-aitd-variants>
        <div data-aitd-variant="1" data-aitd-label="Minimal">Content A</div>
        <div data-aitd-variant="2" data-aitd-label="Bold">Content B</div>
      </div>
    `;

    const groups = discoverVariantGroups();

    expect(groups).toHaveLength(1);
    expect(groups[0].variants).toHaveLength(2);
    expect(groups[0].variants[0].label).toBe("Minimal");
    expect(groups[0].variants[1].label).toBe("Bold");
  });

  it("discovers multiple independent groups", () => {
    document.body.innerHTML = `
      <div data-aitd-variants>
        <div data-aitd-variant="1" data-aitd-label="Hero A">...</div>
        <div data-aitd-variant="2" data-aitd-label="Hero B">...</div>
      </div>
      <div data-aitd-variants>
        <div data-aitd-variant="1" data-aitd-label="Footer A">...</div>
        <div data-aitd-variant="2" data-aitd-label="Footer B">...</div>
      </div>
    `;

    const groups = discoverVariantGroups();

    expect(groups).toHaveLength(2);
  });

  it("falls back to Variant N label when data-aitd-label is missing", () => {
    document.body.innerHTML = `
      <div data-aitd-variants>
        <div data-aitd-variant="1">Content A</div>
        <div data-aitd-variant="2">Content B</div>
      </div>
    `;

    const groups = discoverVariantGroups();

    expect(groups[0].variants[0].label).toBe("Variant 1");
    expect(groups[0].variants[1].label).toBe("Variant 2");
  });

  it("parses the optional description attribute", () => {
    document.body.innerHTML = `
      <div data-aitd-variants>
        <div data-aitd-variant="1" data-aitd-label="Minimal" data-aitd-description="Simple layout">Content A</div>
        <div data-aitd-variant="2" data-aitd-label="Bold">Content B</div>
      </div>
    `;

    const groups = discoverVariantGroups();

    expect(groups[0].variants[0].description).toBe("Simple layout");
    expect(groups[0].variants[1].description).toBeNull();
  });

  it("ignores children without data-aitd-variant", () => {
    document.body.innerHTML = `
      <div data-aitd-variants>
        <div data-aitd-variant="1" data-aitd-label="One">Content A</div>
        <div class="not-a-variant">Ignored</div>
        <div data-aitd-variant="2" data-aitd-label="Two">Content B</div>
      </div>
    `;

    const groups = discoverVariantGroups();

    expect(groups[0].variants).toHaveLength(2);
  });

  it("sorts variants by index", () => {
    document.body.innerHTML = `
      <div data-aitd-variants>
        <div data-aitd-variant="3" data-aitd-label="Third">C</div>
        <div data-aitd-variant="1" data-aitd-label="First">A</div>
        <div data-aitd-variant="2" data-aitd-label="Second">B</div>
      </div>
    `;

    const groups = discoverVariantGroups();

    expect(groups[0].variants[0].label).toBe("First");
    expect(groups[0].variants[1].label).toBe("Second");
    expect(groups[0].variants[2].label).toBe("Third");
  });

  it("uses data-aitd-variants value as group id when present", () => {
    document.body.innerHTML = `
      <div data-aitd-variants="hero-section">
        <div data-aitd-variant="1" data-aitd-label="A">A</div>
        <div data-aitd-variant="2" data-aitd-label="B">B</div>
      </div>
    `;

    const groups = discoverVariantGroups();

    expect(groups[0].id).toBe("hero-section");
  });

  it("auto-generates group id when data-aitd-variants has no value", () => {
    document.body.innerHTML = `
      <div data-aitd-variants>
        <div data-aitd-variant="1" data-aitd-label="A">A</div>
        <div data-aitd-variant="2" data-aitd-label="B">B</div>
      </div>
    `;

    const groups = discoverVariantGroups();

    expect(typeof groups[0].id).toBe("string");
    expect(groups[0].id.length).toBeGreaterThan(0);
  });

  it("sets activeIndex to 0", () => {
    document.body.innerHTML = `
      <div data-aitd-variants>
        <div data-aitd-variant="1" data-aitd-label="A">A</div>
        <div data-aitd-variant="2" data-aitd-label="B">B</div>
      </div>
    `;

    const groups = discoverVariantGroups();

    expect(groups[0].activeIndex).toBe(0);
  });

  it("parses data-aitd-jigs into custom property names", () => {
    document.body.innerHTML = `
      <div data-aitd-variants>
        <div data-aitd-variant="1" data-aitd-label="A" data-aitd-jigs="--v1-dur, --v1-accent bogus">A</div>
        <div data-aitd-variant="2" data-aitd-label="B">B</div>
      </div>
    `;
    const [group] = discoverVariantGroups();
    expect(group.variants[0].jigs).toEqual(["--v1-dur", "--v1-accent"]);
    expect(group.variants[1].jigs).toEqual([]);
  });
});
