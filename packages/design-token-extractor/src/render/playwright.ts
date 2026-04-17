/**
 * Playwright-backed renderer (T3.2).
 *
 * Launches a headless Chromium, navigates to the target URL (or local HTML
 * file), emulates the requested `prefers-color-scheme`, runs the in-page
 * walker (`extractInPageFromGlobals`) via `page.evaluate()`, and returns the
 * resulting `RawStyleRecord[]`.
 *
 * Invariants:
 *   1. `browser.close()` is called in `finally`, so a zombie process cannot
 *      survive a timeout, a `goto` failure, or an evaluate crash.
 *   2. A `SIGINT` handler is installed for the duration of each render and
 *      removed in `finally` — Ctrl+C during extraction closes the browser
 *      before propagating.
 *   3. Every thrown error bubbles up as an `ExtractionError` (mapped to
 *      exit code 2 per SDD §"Error Handling"); original errors are preserved
 *      via the ES2022 `{ cause }` option.
 *   4. Timeout is enforced around the ENTIRE operation (launch + navigate +
 *      evaluate) via `Promise.race`, matching the SDD's "Extraction timed out
 *      after <N>s" error message verbatim.
 */

import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium, type Browser } from 'playwright';

import { ExtractionError } from '../errors';
import type { Input, RawStyleRecord, ThemeTag } from '../types';

import { extractInPageFromGlobals } from './extract-in-page';

export type RenderOptions = {
  /**
   * Test-only hook: receives the `Browser` handle as soon as it is launched,
   * BEFORE navigation or evaluation. Used by the integration suite to assert
   * that the browser is properly closed on both success and failure paths.
   *
   * Production callers should not need this.
   */
  onBrowser?: (browser: Browser) => void;
};

/**
 * Resolves the navigation target for Playwright's `page.goto()`.
 *
 * - `kind: 'url'`  → passed through verbatim (caller is responsible for
 *   having already validated the scheme via `sources/url.ts`).
 * - `kind: 'file'` → converted to a `file://` URL via `pathToFileURL`. We
 *   ALSO stat the file first: navigating to a non-existent `file://` URL in
 *   Playwright produces a confusing `ERR_FILE_NOT_FOUND` DevTools error that
 *   is hard to map back to a clean user-facing message. Failing fast here
 *   gives a clearer `ExtractionError`.
 */
const resolveTargetUrl = async (input: Input): Promise<string> => {
  if (input.kind === 'url') {
    return input.url;
  }

  const absolute = resolve(input.path);
  try {
    await stat(absolute);
  } catch (err) {
    throw new ExtractionError(`File not found: ${absolute}`, { cause: err });
  }
  return pathToFileURL(absolute).href;
};

/**
 * Wraps `operation` so it rejects with an `ExtractionError` if it does not
 * settle before `timeoutMs` elapses. The message matches the SDD §"Error
 * Handling" table.
 *
 * The returned cleanup handle cancels the pending timer — callers MUST
 * invoke it in a `finally` to avoid a dangling `setTimeout` keeping the
 * event loop alive after the operation resolves.
 */
const withTimeout = <T>(
  operation: Promise<T>,
  timeoutMs: number,
): { result: Promise<T>; cancel: () => void } => {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const seconds = timeoutMs / 1000;
      reject(
        new ExtractionError(
          `Extraction timed out after ${seconds}s — consider --file or --fast`,
        ),
      );
    }, timeoutMs);
  });

  return {
    result: Promise.race([operation, timeout]),
    cancel: (): void => {
      if (timer !== undefined) clearTimeout(timer);
    },
  };
};

/**
 * Wraps any non-`ExtractionError` thrown value in an `ExtractionError` so the
 * CLI top-level always sees a typed error it knows the exit code for.
 */
const asExtractionError = (err: unknown): ExtractionError => {
  if (err instanceof ExtractionError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new ExtractionError(`Render failed: ${message}`, { cause: err });
};

export const render = async (
  input: Input,
  theme: ThemeTag,
  timeoutMs: number,
  opts?: RenderOptions,
): Promise<RawStyleRecord[]> => {
  const targetUrl = await resolveTargetUrl(input);

  let browser: Browser | undefined;

  // Install a SIGINT handler for the duration of this render. Using `once`
  // means we do not leak subscribers if the user Ctrl+Cs mid-extraction —
  // Node's default SIGINT behavior (exit) kicks in immediately after our
  // handler runs. We ALSO remove it in `finally` so successful renders do
  // not leave stray listeners on the process.
  const onSigint = (): void => {
    if (browser && browser.isConnected()) {
      // Fire-and-forget; we're about to exit anyway. Intentional void.
      void browser.close();
    }
  };
  process.once('SIGINT', onSigint);

  const operation = (async (): Promise<RawStyleRecord[]> => {
    browser = await chromium.launch({ headless: true });
    opts?.onBrowser?.(browser);

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(targetUrl, { waitUntil: 'networkidle' });
    // `extractInPageFromGlobals` is self-contained: its body re-declares the
    // property list and helpers it needs. See `extract-in-page.ts` module
    // docstring for why this matters.
    const records = await page.evaluate(extractInPageFromGlobals, theme);
    return records;
  })();

  const { result, cancel } = withTimeout(operation, timeoutMs);

  try {
    return await result;
  } catch (err) {
    throw asExtractionError(err);
  } finally {
    cancel();
    process.removeListener('SIGINT', onSigint);
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Swallow — we are already unwinding; surfacing a close-time error
        // would mask the original failure. The primary failure (if any) is
        // already being thrown via the catch above.
      }
    }
  }
};
