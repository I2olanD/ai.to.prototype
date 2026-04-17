import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { extractInPage } from '../../src/render/extract-in-page.ts';
import type { RawStyleRecord } from '../../src/types.ts';

/**
 * jsdom computes only a limited set of computed styles reliably — specifically,
 * inline `style="..."` attributes. These tests exercise the walker logic and
 * contract of `extractInPage` using inline-style fixtures, which is sufficient
 * for unit testing. Real stylesheet resolution is covered later by Playwright
 * integration tests (T3.2).
 *
 * Important jsdom behaviors to be aware of:
 *   - Named CSS colors (`red`, `blue`, `white`) are normalized to `rgb(...)`
 *     form by `getComputedStyle`. Inline `element.style` preserves the raw
 *     source string.
 *   - `border-radius` shorthand is NOT expanded into longhand computed values.
 *     Tests for radius therefore set the longhand property directly.
 *   - `getComputedStyle` returns UA-default values for many properties
 *     (`padding: 0`, `font-size: medium`, etc.). Tests that assert counts
 *     must filter by `source: 'inline'` to isolate author-set values.
 */

type DomHandle = {
  doc: Document;
  win: Window & typeof globalThis;
};

const buildDom = (html: string): DomHandle => {
  const dom = new JSDOM(html);
  return {
    doc: dom.window.document,
    // jsdom's Window is structurally compatible with the global Window for
    // the subset of APIs the extractor calls (only `getComputedStyle`).
    win: dom.window as unknown as Window & typeof globalThis,
  };
};

const recordsFor = (
  html: string,
  theme: 'light' | 'dark' = 'light',
): RawStyleRecord[] => {
  const { doc, win } = buildDom(html);
  return extractInPage(doc, win, theme);
};

describe('extractInPage — basic property emission', () => {
  it('emits inline records for color and background-color on an inline-styled element', () => {
    const html = `
      <!doctype html>
      <html><body>
        <p id="p1" style="color: red; background-color: blue">hi</p>
      </body></html>
    `;
    const records = recordsFor(html);

    const inlineOnP1 = records.filter(
      (r) => r.selector.includes('#p1') && r.source === 'inline',
    );
    const color = inlineOnP1.find((r) => r.property === 'color');
    const background = inlineOnP1.find(
      (r) => r.property === 'background-color',
    );

    // jsdom normalizes color names to rgb()
    expect(color?.value).toBe('rgb(255, 0, 0)');
    expect(background?.value).toBe('rgb(0, 0, 255)');
  });

  it('never emits records with empty string values', () => {
    const html = `<!doctype html><html><body><p></p></body></html>`;
    const records = recordsFor(html);

    for (const record of records) {
      expect(record.value).not.toBe('');
    }
  });
});

describe('extractInPage — DOM walk coverage', () => {
  it('emits one inline record per element for the same property across siblings', () => {
    const html = `
      <!doctype html>
      <html><body>
        <p class="a" style="color: red">one</p>
        <p class="b" style="color: red">two</p>
        <p class="c" style="color: red">three</p>
      </body></html>
    `;
    const records = recordsFor(html);

    // Filter on source='inline' to count only author-set color declarations
    // (otherwise inherited/UA color values on every descendant dilute the count).
    const inlineColor = records.filter(
      (r) => r.property === 'color' && r.source === 'inline',
    );
    expect(inlineColor).toHaveLength(3);
  });

  it('walks nested elements and emits records for each descendant', () => {
    const html = `
      <!doctype html>
      <html><body style="color: black">
        <div style="background-color: gray">
          <span style="font-size: 12px">deep</span>
        </div>
      </body></html>
    `;
    const records = recordsFor(html);

    const bodyColor = records.find(
      (r) =>
        r.selector.startsWith('body') &&
        r.property === 'color' &&
        r.source === 'inline',
    );
    const divBg = records.find(
      (r) =>
        r.selector.startsWith('div') &&
        r.property === 'background-color' &&
        r.source === 'inline',
    );
    const spanFont = records.find(
      (r) =>
        r.selector.startsWith('span') &&
        r.property === 'font-size' &&
        r.source === 'inline',
    );

    expect(bodyColor?.value).toBe('rgb(0, 0, 0)');
    expect(divBg?.value).toBe('rgb(128, 128, 128)');
    expect(spanFont?.value).toBe('12px');
  });

  it('includes the <html> root element in the walk', () => {
    const html = `
      <!doctype html>
      <html style="background-color: white"><body></body></html>
    `;
    const records = recordsFor(html);

    const htmlBg = records.find(
      (r) =>
        r.selector.startsWith('html') &&
        r.property === 'background-color' &&
        r.source === 'inline',
    );
    expect(htmlBg).toBeDefined();
    expect(htmlBg?.value).toBe('rgb(255, 255, 255)');
  });

  it('still emits records for elements with display: none', () => {
    const html = `
      <!doctype html>
      <html><body>
        <p id="hidden" style="display: none; color: red">hidden</p>
      </body></html>
    `;
    const records = recordsFor(html);

    const color = records.find(
      (r) =>
        r.selector.includes('#hidden') &&
        r.property === 'color' &&
        r.source === 'inline',
    );
    expect(color).toBeDefined();
    expect(color?.value).toBe('rgb(255, 0, 0)');
  });
});

describe('extractInPage — theme tagging', () => {
  it('tags every record with theme: "light" when called with "light"', () => {
    const html = `
      <!doctype html>
      <html><body>
        <p style="color: red">a</p>
        <p style="color: blue">b</p>
      </body></html>
    `;
    const records = recordsFor(html, 'light');

    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.theme).toBe('light');
    }
  });

  it('tags every record with theme: "dark" when called with "dark"', () => {
    const html = `
      <!doctype html>
      <html><body>
        <p style="color: red">a</p>
      </body></html>
    `;
    const records = recordsFor(html, 'dark');

    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.theme).toBe('dark');
    }
  });
});

describe('extractInPage — source attribution', () => {
  it('marks records from style="..." attributes as source: "inline"', () => {
    const html = `
      <!doctype html>
      <html><body>
        <p id="p1" style="color: red">hi</p>
      </body></html>
    `;
    const records = recordsFor(html);

    const inlineColor = records.find(
      (r) =>
        r.selector.includes('#p1') &&
        r.property === 'color' &&
        r.source === 'inline',
    );
    expect(inlineColor).toBeDefined();
  });

  it('marks inherited / UA-default values as source: "stylesheet"', () => {
    // The inner <span> has no inline styles; its color is inherited from the
    // UA default cascade, so any record for it must be source: 'stylesheet'.
    const html = `
      <!doctype html>
      <html><body><span id="s"></span></body></html>
    `;
    const records = recordsFor(html);

    const spanRecords = records.filter((r) => r.selector.includes('#s'));
    expect(spanRecords.length).toBeGreaterThan(0);
    for (const record of spanRecords) {
      expect(record.source).toBe('stylesheet');
    }
  });
});

describe('extractInPage — selector shape', () => {
  it('includes the tag name in the selector', () => {
    const html = `
      <!doctype html>
      <html><body><p id="tag-probe" style="color: red">x</p></body></html>
    `;
    const records = recordsFor(html);
    const pRecord = records.find(
      (r) =>
        r.selector.includes('#tag-probe') &&
        r.property === 'color' &&
        r.source === 'inline',
    );
    expect(pRecord).toBeDefined();
    expect(pRecord?.selector.startsWith('p')).toBe(true);
  });

  it('includes the id with a leading # when present', () => {
    const html = `
      <!doctype html>
      <html><body><p id="main" style="color: red">x</p></body></html>
    `;
    const records = recordsFor(html);
    const pRecord = records.find(
      (r) =>
        r.property === 'color' &&
        r.source === 'inline' &&
        r.selector.includes('p'),
    );
    expect(pRecord).toBeDefined();
    expect(pRecord?.selector).toContain('#main');
  });

  it('includes class names with leading dots when present', () => {
    const html = `
      <!doctype html>
      <html><body><p class="foo bar" style="color: red">x</p></body></html>
    `;
    const records = recordsFor(html);
    const pRecord = records.find(
      (r) =>
        r.property === 'color' &&
        r.source === 'inline' &&
        r.selector.startsWith('p'),
    );
    expect(pRecord).toBeDefined();
    expect(pRecord?.selector).toContain('.foo');
    expect(pRecord?.selector).toContain('.bar');
  });
});

describe('extractInPage — record shape', () => {
  it('sets scope to ":root" on every record (resolver sets real scope later)', () => {
    const html = `
      <!doctype html>
      <html><body><p style="color: red">x</p></body></html>
    `;
    const records = recordsFor(html);

    for (const record of records) {
      expect(record.scope).toBe(':root');
    }
  });

  it('produces records matching the RawStyleRecord shape exactly', () => {
    const html = `
      <!doctype html>
      <html><body><p style="color: red">x</p></body></html>
    `;
    const records = recordsFor(html);
    const sample = records.find(
      (r) => r.property === 'color' && r.source === 'inline',
    );
    expect(sample).toBeDefined();

    // Required fields present and typed.
    const keys = Object.keys(sample as RawStyleRecord).sort();
    // originalVar is optional — must not be present unless set.
    expect(keys).toEqual(
      ['property', 'scope', 'selector', 'source', 'theme', 'value'].sort(),
    );
  });
});

describe('extractInPage — property coverage (smattering)', () => {
  it('reads padding-top as an inline style', () => {
    const html = `
      <!doctype html>
      <html><body><div style="padding-top: 8px"></div></body></html>
    `;
    const records = recordsFor(html);
    const record = records.find(
      (r) =>
        r.selector.startsWith('div') &&
        r.property === 'padding-top' &&
        r.source === 'inline',
    );
    expect(record?.value).toBe('8px');
  });

  it('reads border-top-left-radius as an inline style (shorthand expansion is not supported by jsdom)', () => {
    const html = `
      <!doctype html>
      <html><body><div style="border-top-left-radius: 4px"></div></body></html>
    `;
    const records = recordsFor(html);
    const record = records.find(
      (r) =>
        r.selector.startsWith('div') &&
        r.property === 'border-top-left-radius' &&
        r.source === 'inline',
    );
    expect(record?.value).toBe('4px');
  });

  it('reads font-weight as an inline style', () => {
    const html = `
      <!doctype html>
      <html><body><span style="font-weight: 700"></span></body></html>
    `;
    const records = recordsFor(html);
    const record = records.find(
      (r) =>
        r.selector.startsWith('span') &&
        r.property === 'font-weight' &&
        r.source === 'inline',
    );
    expect(record?.value).toBe('700');
  });
});
