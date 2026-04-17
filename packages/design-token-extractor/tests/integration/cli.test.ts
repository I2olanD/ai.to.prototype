/**
 * Integration tests for the commander CLI shell (spec 001, T8.2).
 *
 * Each test case spawns the built `dist/cli.js` as a child process via
 * `spawnSync(process.execPath, ...)` and asserts on exit code + stdout/stderr.
 * The suite pre-builds the package in `beforeAll` so the tests always run
 * against the freshest bundle.
 *
 * Extraction-success cases drive real Chromium via Playwright through the
 * pipeline, so a generous describe-level timeout (180s) covers CI latency.
 *
 * Per the task brief we stick to `--file` for success-path tests and keep
 * URL coverage limited to validation (don't hit the network).
 */

import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(THIS_DIR, '..', '..');
const CLI_PATH = resolve(PACKAGE_DIR, 'dist', 'cli.js');
const FIXTURES_DIR = resolve(PACKAGE_DIR, 'tests', 'fixtures');

const fixturePath = (name: string): string => resolve(FIXTURES_DIR, name);

type RunResult = {
  status: number;
  stdout: string;
  stderr: string;
};

const runCli = (args: readonly string[]): RunResult => {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: PACKAGE_DIR,
    encoding: 'utf8',
    // Large buffer for JSON output.
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
};

describe(
  'cli — commander shell',
  () => {
    beforeAll(() => {
      execSync('npm run build', { cwd: PACKAGE_DIR, stdio: 'pipe' });
    }, 120_000);

    it('--help exits 0 with usage text', () => {
      const { status, stdout } = runCli(['--help']);
      expect(status).toBe(0);
      expect(stdout).toContain('design-token-extractor');
      expect(stdout).toContain('extract');
    });

    it('--version exits 0 with a version string', () => {
      const { status, stdout } = runCli(['--version']);
      expect(status).toBe(0);
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('extract with a missing file exits 1 with "File not found"', () => {
      const { status, stderr } = runCli([
        'extract',
        '--file',
        fixturePath('does-not-exist.html'),
      ]);
      expect(status).toBe(1);
      expect(stderr).toContain('File not found');
    });

    it('extract with both URL and --file exits 1 with "not both"', () => {
      const { status, stderr } = runCli([
        'extract',
        'http://example.com',
        '--file',
        fixturePath('simple.html'),
      ]);
      expect(status).toBe(1);
      expect(stderr).toContain('not both');
    });

    it('extract with a non-http(s) scheme exits 1 with "Only http"', () => {
      const { status, stderr } = runCli(['extract', 'ftp://example.com']);
      expect(status).toBe(1);
      expect(stderr).toContain('Only http');
    });

    it('extract with neither URL nor --file exits 1', () => {
      const { status, stderr } = runCli(['extract']);
      expect(status).toBe(1);
      expect(stderr).toContain('Must specify');
    });

    it('extract --file simple.html --format json writes valid JSON to stdout', () => {
      const { status, stdout } = runCli([
        'extract',
        '--file',
        fixturePath('simple.html'),
        '--format',
        'json',
      ]);
      expect(status).toBe(0);

      const parsed = JSON.parse(stdout);
      expect(parsed.$schema).toBe(
        'https://design-tokens.github.io/community-group/format/',
      );
      expect(parsed.$metadata.extractor).toBe('design-token-extractor');
      expect(parsed.color).toBeDefined();
      expect(parsed.typography).toBeDefined();
    });

    it('extract --file simple.html --out <tmpfile> writes JSON to disk', () => {
      const tempDir = mkdtempSync(resolve(tmpdir(), 'dte-cli-'));
      const outPath = resolve(tempDir, 'tokens.json');
      try {
        const { status } = runCli([
          'extract',
          '--file',
          fixturePath('simple.html'),
          '--format',
          'json',
          '--out',
          outPath,
        ]);
        expect(status).toBe(0);

        const written = readFileSync(outPath, 'utf8');
        const parsed = JSON.parse(written);
        expect(parsed.$schema).toBe(
          'https://design-tokens.github.io/community-group/format/',
        );
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('extract --file simple.html --format css emits a :root block', () => {
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

    it('extract --file simple.html --format md emits a "# Design Tokens" header', () => {
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
  },
  { timeout: 180_000 },
);
