import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeAtomic } from '../../src/io/write.ts';

/**
 * Atomic file-writer tests.
 *
 * Each test allocates its own isolated directory under os.tmpdir() so that
 * leftover temp artifacts can be asserted on without cross-test interference.
 */
describe('writeAtomic', () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'dte-test-'));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('writes the given string to the given path exactly', async () => {
    const target = join(workDir, 'out.json');
    const content = '{"hello":"world"}';

    await writeAtomic(content, target);

    const actual = await readFile(target, 'utf8');
    expect(actual).toBe(content);
  });

  it('leaves no .tmp sibling file behind on success', async () => {
    const target = join(workDir, 'out.json');

    await writeAtomic('payload', target);

    const entries = await readdir(workDir);
    const tmpLeftovers = entries.filter((name) => name.includes('.tmp'));
    expect(tmpLeftovers).toEqual([]);
  });

  it('writes to process.stdout when outPath is undefined', async () => {
    const spy = vi
      .spyOn(process.stdout, 'write')
      // Satisfy the overloaded signature without triggering real IO.
      .mockImplementation(() => true);

    try {
      await expect(writeAtomic('stdout payload')).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('stdout payload');
    } finally {
      spy.mockRestore();
    }
  });

  it('writes to process.stdout when outPath is "-"', async () => {
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    try {
      await writeAtomic('dash payload', '-');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('dash payload');
    } finally {
      spy.mockRestore();
    }
  });

  it('throws when the target directory does not exist and leaves no residue', async () => {
    const impossible = '/nonexistent/nope/out.json';

    await expect(writeAtomic('oops', impossible)).rejects.toBeInstanceOf(Error);

    // The cleanup attempt may itself fail (because /nonexistent has no tmp),
    // but the function must still surface the original error. Assert nothing
    // was silently written under workDir either.
    const entries = await readdir(workDir);
    expect(entries.filter((name) => name.includes('.tmp'))).toEqual([]);
  });

  it('overwrites an existing file atomically', async () => {
    const target = join(workDir, 'existing.json');
    await writeFile(target, 'original', 'utf8');

    await writeAtomic('replacement', target);

    const actual = await readFile(target, 'utf8');
    expect(actual).toBe('replacement');

    const entries = await readdir(workDir);
    expect(entries.filter((name) => name.includes('.tmp'))).toEqual([]);
  });

  it('keeps writes coherent when two parallel calls target the same file', async () => {
    const target = join(workDir, 'race.json');
    const a = 'A'.repeat(256);
    const b = 'B'.repeat(256);

    await Promise.all([writeAtomic(a, target), writeAtomic(b, target)]);

    const actual = await readFile(target, 'utf8');
    expect([a, b]).toContain(actual);

    const entries = await readdir(workDir);
    expect(entries.filter((name) => name.includes('.tmp'))).toEqual([]);
  });
});
