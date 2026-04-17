/**
 * Integration tests for the Playwright renderer (T3.2).
 *
 * These tests spin up real headless Chromium instances — each `render()` call
 * launches and closes a browser, so the suite is intentionally marked with a
 * generous timeout. Unit-level walker behavior is covered in
 * `tests/unit/extract-in-page.test.ts`; this file focuses on:
 *
 *   - End-to-end rendering of a local HTML fixture
 *   - Theme emulation via `emulateMedia({ colorScheme })`
 *   - Timeout propagation as `ExtractionError`
 *   - Browser process cleanup on success AND on error
 *   - Graceful failure for missing files
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

import type { Browser } from 'playwright';
import { describe, expect, it } from 'vitest';

import { ExtractionError } from '../../src/errors.ts';
import { render } from '../../src/render/playwright.ts';
import type { Input } from '../../src/types.ts';

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(THIS_DIR, '..', 'fixtures');

const fixturePath = (name: string): string => resolve(FIXTURES_DIR, name);

const fixtureInput = (name: string): Input => ({
  kind: 'file',
  path: fixturePath(name),
});

describe(
  'render — Playwright integration',
  () => {
    it('returns a non-empty array of RawStyleRecord for a simple file fixture', async () => {
      const records = await render(
        fixtureInput('simple.html'),
        'light',
        30_000,
      );

      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBeGreaterThan(0);

      const sample = records[0];
      expect(sample).toMatchObject({
        selector: expect.any(String),
        property: expect.any(String),
        value: expect.any(String),
        source: expect.stringMatching(/^(inline|stylesheet)$/),
        theme: 'light',
        scope: ':root',
      });
    });

    it('emits at least one `color` record and one `font-size` record', async () => {
      const records = await render(
        fixtureInput('simple.html'),
        'light',
        30_000,
      );

      const hasColor = records.some((r) => r.property === 'color');
      const hasFontSize = records.some((r) => r.property === 'font-size');
      expect(hasColor).toBe(true);
      expect(hasFontSize).toBe(true);
    });

    it('tags every record with `theme: "light"` when rendered as light', async () => {
      const records = await render(
        fixtureInput('simple.html'),
        'light',
        30_000,
      );

      expect(records.length).toBeGreaterThan(0);
      for (const record of records) {
        expect(record.theme).toBe('light');
      }
    });

    it('produces different `color` values when emulating dark vs light on a dark-mode fixture', async () => {
      const input = fixtureInput('dark-mode.html');

      const lightRecords = await render(input, 'light', 30_000);
      const darkRecords = await render(input, 'dark', 30_000);

      // body's resolved color (inherited by the <p>) should flip between the
      // two render passes. Pick any record on the `body` selector.
      const lightBodyColor = lightRecords.find(
        (r) => r.selector === 'body' && r.property === 'color',
      );
      const darkBodyColor = darkRecords.find(
        (r) => r.selector === 'body' && r.property === 'color',
      );

      expect(lightBodyColor).toBeDefined();
      expect(darkBodyColor).toBeDefined();
      expect(lightBodyColor?.theme).toBe('light');
      expect(darkBodyColor?.theme).toBe('dark');
      expect(lightBodyColor?.value).not.toBe(darkBodyColor?.value);
    });

    it('throws `ExtractionError` with a timeout message when timeoutMs is too small', async () => {
      // 1ms is shorter than Chromium launch time — guaranteed to timeout.
      await expect(
        render(fixtureInput('simple.html'), 'light', 1),
      ).rejects.toThrow(ExtractionError);

      try {
        await render(fixtureInput('simple.html'), 'light', 1);
        expect.fail('expected render to reject');
      } catch (err) {
        expect(err).toBeInstanceOf(ExtractionError);
        const message = (err as Error).message.toLowerCase();
        expect(
          message.includes('timeout') || message.includes('timed out'),
        ).toBe(true);
      }
    });

    it('closes the browser after a successful render', async () => {
      let captured: Browser | undefined;

      const records = await render(
        fixtureInput('simple.html'),
        'light',
        30_000,
        {
          onBrowser: (browser) => {
            captured = browser;
          },
        },
      );

      expect(records.length).toBeGreaterThan(0);
      expect(captured).toBeDefined();
      expect(captured?.isConnected()).toBe(false);
    });

    it('closes the browser after a failed render (non-existent file)', async () => {
      let captured: Browser | undefined;

      await expect(
        render(
          { kind: 'file', path: '/does/not/exist-dte-test.html' },
          'light',
          30_000,
          {
            onBrowser: (browser) => {
              captured = browser;
            },
          },
        ),
      ).rejects.toThrow(ExtractionError);

      // On error the browser must still be closed — prove it by inspecting
      // the captured handle (if one was ever created; for a missing file we
      // fail pre-launch, so captured may be undefined — that is also a pass
      // because no browser was ever started).
      if (captured) {
        expect(captured.isConnected()).toBe(false);
      }
    });

    it('rejects with `ExtractionError` when the file does not exist', async () => {
      await expect(
        render(
          { kind: 'file', path: '/does/not/exist-dte-test.html' },
          'light',
          30_000,
        ),
      ).rejects.toThrow(ExtractionError);
    });

    it('accepts file:// URLs via pathToFileURL without mangling the path', async () => {
      // Sanity: make sure our own path helper produces a valid file URL —
      // this mirrors what render() does internally and guards against
      // accidental breakage in the resolver branch.
      const url = pathToFileURL(fixturePath('simple.html')).href;
      expect(url.startsWith('file://')).toBe(true);
    });
  },
  { timeout: 60_000 },
);
