/**
 * Atomic file writer.
 *
 * Guarantees per PRD Feature 8 AC: on any failure the target file is either
 * the previous content or absent — never partially written.
 *
 * Strategy:
 *   1. Write the payload to a temp file inside the SAME directory as the
 *      target (so `rename` stays intra-device on Windows/NTFS).
 *   2. Rename the temp file over the target — `rename` is atomic on POSIX
 *      and on NTFS when source and destination share a volume.
 *   3. On any error, best-effort unlink the temp file and rethrow the
 *      original cause.
 *
 * When `outPath` is undefined or the literal '-' the payload is streamed to
 * `process.stdout` instead of being persisted to disk.
 */

import { rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';
import { randomBytes } from 'node:crypto';

export async function writeAtomic(
  content: string,
  outPath?: string,
): Promise<void> {
  if (outPath === undefined || outPath === '-') {
    process.stdout.write(content);
    return;
  }

  const absolute = resolve(outPath);
  const targetDir = dirname(absolute);
  const targetName = basename(absolute);
  const suffix = randomBytes(8).toString('hex');
  const tempPath = resolve(targetDir, `.${targetName}.tmp-${suffix}`);

  try {
    await writeFile(tempPath, content, 'utf8');
    await rename(tempPath, absolute);
  } catch (error) {
    // Best-effort cleanup. The temp file may not exist (e.g. the directory
    // itself was invalid) — swallow unlink errors so the original failure
    // reason is the one the caller sees.
    try {
      await unlink(tempPath);
    } catch {
      // intentional: cleanup is best-effort
    }
    throw error;
  }
}
