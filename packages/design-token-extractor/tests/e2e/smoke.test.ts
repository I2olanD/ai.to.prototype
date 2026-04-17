/**
 * End-to-end smoke tests (spec 001, T9.2).
 *
 * Builds the package once in `beforeAll`, then spawns the bundled
 * `dist/cli.js` through `spawnSync(process.execPath, ...)` to drive the
 * full extraction pipeline against local HTML fixtures — no network, no
 * mocking. Assertions focus on:
 *
 *   - Format dispatch (json | css | js | md) via stdout shape
 *   - `--out <path>` writing to disk with empty stdout
 *   - Exit-code contract for invalid invocations (neither URL nor --file,
 *     disallowed scheme, missing file)
 *   - `--min-confidence` filtering reducing the token count
 *
 * Each extraction launches a real headless Chromium through Playwright, so
 * the describe block carries a 120s timeout to absorb browser startup cost
 * on slower machines / CI.
 */

import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(THIS_DIR, '..', '..');
const DIST_CLI = resolve(PACKAGE_DIR, 'dist', 'cli.js');
const FIXTURE_DIR = resolve(PACKAGE_DIR, 'tests', 'fixtures');

const fixturePath = (name: string): string => resolve(FIXTURE_DIR, name);

type RunResult = {
  status: number;
  stdout: string;
  stderr: string;
};

type RunOptions = {
  cwd?: string;
};

const runCli = (args: readonly string[], opts: RunOptions = {}): RunResult => {
  const result = spawnSync(process.execPath, [DIST_CLI, ...args], {
    cwd: opts.cwd ?? PACKAGE_DIR,
    encoding: 'utf8',
    // Design-token JSON can get large; reserve 32MB.
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
};

const countTokens = (json: Record<string, unknown>): number => {
  // DTCG: a token is any node with a `$value` property. Walk the tree and
  // count every leaf token — metadata ($schema, $metadata) is skipped
  // because it has no `$value`.
  let total = 0;
  const visit = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(record, '$value')) {
      total += 1;
      return;
    }
    for (const key of Object.keys(record)) {
      if (key.startsWith('$')) continue;
      visit(record[key]);
    }
  };
  visit(json);
  return total;
};

describe(
  'cli — e2e smoke',
  () => {
    beforeAll(() => {
      execSync('npm run build', { cwd: PACKAGE_DIR, stdio: 'pipe' });
    }, 120_000);

    it('extract --format json emits valid DTCG JSON on stdout', () => {
      const { status, stdout } = runCli([
        'extract',
        '--file',
        fixturePath('simple.html'),
        '--format',
        'json',
      ]);

      expect(status).toBe(0);
      const parsed = JSON.parse(stdout) as Record<string, unknown>;
      expect(parsed.$schema).toBe(
        'https://design-tokens.github.io/community-group/format/',
      );
      expect(parsed.$metadata).toBeDefined();
      expect(
        (parsed.$metadata as Record<string, unknown>).extractor,
      ).toBe('design-token-extractor');
    });

    it('extract --format css emits a :root block', () => {
      const { status, stdout } = runCli([
        'extract',
        '--file',
        fixturePath('simple.html'),
        '--format',
        'css',
      ]);

      expect(status).toBe(0);
      expect(stdout.startsWith(':root {')).toBe(true);
    });

    it('extract --format js emits an `export default` module', () => {
      const { status, stdout } = runCli([
        'extract',
        '--file',
        fixturePath('simple.html'),
        '--format',
        'js',
      ]);

      expect(status).toBe(0);
      expect(stdout.startsWith('export default {')).toBe(true);
    });

    it('extract --format md emits a "# Design Tokens" header', () => {
      const { status, stdout } = runCli([
        'extract',
        '--file',
        fixturePath('simple.html'),
        '--format',
        'md',
      ]);

      expect(status).toBe(0);
      expect(stdout.startsWith('# Design Tokens')).toBe(true);
    });

    it('extract --out <tmpfile> writes JSON to disk with empty stdout', () => {
      const tempDir = mkdtempSync(resolve(tmpdir(), 'dte-e2e-'));
      const outPath = resolve(tempDir, 'tokens.json');
      try {
        const { status, stdout } = runCli([
          'extract',
          '--file',
          fixturePath('simple.html'),
          '--format',
          'json',
          '--out',
          outPath,
        ]);

        expect(status).toBe(0);
        expect(stdout).toBe('');

        const written = readFileSync(outPath, 'utf8');
        const parsed = JSON.parse(written) as Record<string, unknown>;
        expect(parsed.$schema).toBe(
          'https://design-tokens.github.io/community-group/format/',
        );
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('exits 1 when neither URL nor --file is given', () => {
      const { status, stderr } = runCli(['extract']);
      expect(status).toBe(1);
      expect(stderr.length).toBeGreaterThan(0);
    });

    it('exits 1 on a non-http(s) scheme', () => {
      const { status, stderr } = runCli(['extract', 'ftp://x']);
      expect(status).toBe(1);
      expect(stderr.length).toBeGreaterThan(0);
    });

    it('exits 1 when --file points at a non-existent path', () => {
      const { status, stderr } = runCli([
        'extract',
        '--file',
        '/does/not/exist.html',
      ]);
      expect(status).toBe(1);
      expect(stderr.length).toBeGreaterThan(0);
    });

    it('--min-confidence 0.9 filters out low-confidence tokens', () => {
      const baseline = runCli([
        'extract',
        '--file',
        fixturePath('simple.html'),
        '--format',
        'json',
      ]);
      expect(baseline.status).toBe(0);
      const baselineJson = JSON.parse(baseline.stdout) as Record<
        string,
        unknown
      >;

      const filtered = runCli([
        'extract',
        '--file',
        fixturePath('simple.html'),
        '--format',
        'json',
        '--min-confidence',
        '0.9',
      ]);
      expect(filtered.status).toBe(0);
      const filteredJson = JSON.parse(filtered.stdout) as Record<
        string,
        unknown
      >;

      const baselineCount = countTokens(baselineJson);
      const filteredCount = countTokens(filteredJson);

      // High threshold must drop at least one token from the unfiltered set.
      expect(baselineCount).toBeGreaterThan(0);
      expect(filteredCount).toBeLessThan(baselineCount);
    });
  },
  { timeout: 120_000 },
);
