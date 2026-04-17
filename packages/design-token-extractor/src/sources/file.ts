/**
 * Local-file source loader.
 *
 * Contract (PRD Feature 2 AC / SDD §"Error Handling"):
 *   - Resolve the input path to absolute (trimmed).
 *   - ENOENT                  → UserError("File not found: <absPath>")
 *   - Directory entry          → UserError("Not a file: <absPath>")
 *   - Symlink                  → warn to stderr, continue.
 *   - Extension ≠ .html        → warn to stderr, continue.
 *   - Otherwise                → read UTF-8 content and return { absPath, html }.
 *
 * `lstat` is used (not `stat`) so symlinks can be detected before their
 * targets are followed — the warning is a defense-in-depth cue per SDD
 * §"System-Wide Patterns → Security".
 */

import { lstat, readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { UserError } from '../errors';

export async function loadFile(
  inputPath: string,
): Promise<{ absPath: string; html: string }> {
  const absPath = resolve(inputPath.trim());

  const stats = await statOrThrow(absPath);

  if (stats.isDirectory()) {
    throw new UserError(`Not a file: ${absPath}`);
  }

  if (stats.isSymbolicLink()) {
    process.stderr.write(`warning: ${absPath} is a symlink\n`);
  }

  if (extname(absPath).toLowerCase() !== '.html') {
    process.stderr.write(
      `warning: ${absPath} does not have a .html extension\n`,
    );
  }

  const html = await readFile(absPath, 'utf8');
  return { absPath, html };
}

async function statOrThrow(
  absPath: string,
): Promise<Awaited<ReturnType<typeof lstat>>> {
  try {
    return await lstat(absPath);
  } catch (error) {
    if (isNodeErrnoException(error) && error.code === 'ENOENT') {
      throw new UserError(`File not found: ${absPath}`, { cause: error });
    }
    throw error;
  }
}

function isNodeErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    typeof (error as NodeJS.ErrnoException).code === 'string'
  );
}
