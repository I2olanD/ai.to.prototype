/**
 * Commander CLI shell for the design-token-extractor (spec 001, T8.2).
 *
 * Wires the `extract` subcommand to the pipeline orchestrator. Responsibilities
 * are intentionally thin — this file only:
 *
 *   1. Parses CLI flags via commander.
 *   2. Resolves/validates the input source (URL vs file mutex).
 *   3. Zod-parses the resulting `CliOptions` (ADR-5 boundary validation).
 *   4. Runs the `extract()` orchestrator under an optional ora spinner.
 *   5. Filters tokens by `--min-confidence` post-extract.
 *   6. Serializes via the requested formatter (json | css | js | md).
 *   7. Writes the payload through `writeAtomic` (stdout or disk).
 *   8. Maps every thrown error to a deterministic exit code per SDD
 *      §"Error Handling":
 *        UserError       → 1
 *        z.ZodError      → 1 (flag validation drift)
 *        ExtractionError → 2
 *        Unknown         → 3
 *
 * The shebang is emitted by tsup's banner config at build time — do NOT
 * add one here. The `--fast` flag is accepted but ignored in v1 (emit a
 * warning and proceed with the headless renderer). `--user-agent` is
 * silently accepted for forward compatibility.
 */

import { Command } from 'commander';
import ora, { type Ora } from 'ora';
import { z } from 'zod';

import { DteError, ExtractionError, UserError } from './errors';
import { extract } from './extract';
import { formatCss } from './format/css';
import { formatJs } from './format/js';
import { formatJson } from './format/json';
import { formatMarkdown } from './format/md';
import { writeAtomic } from './io/write';
import { loadFile } from './sources/file';
import { parseUrl } from './sources/url';
import type {
  CliOptions,
  Input,
  OutputFormat,
  Theme,
  Token,
  TokenSet,
} from './types';

const CLI_VERSION = typeof __DTE_VERSION__ !== 'undefined' ? __DTE_VERSION__ : '0.0.0-dev';

// --------------------------------------------------------------------------
// Schemas
// --------------------------------------------------------------------------

const inputSchema = z.union([
  z.object({ kind: z.literal('url'), url: z.string().url() }),
  z.object({ kind: z.literal('file'), path: z.string().min(1) }),
]);

const cliOptionsSchema = z.object({
  input: inputSchema,
  format: z.enum(['json', 'css', 'js', 'md']),
  out: z.string().min(1).optional(),
  timeoutMs: z.number().int().positive(),
  minConfidence: z.number().min(0).max(1),
  theme: z.enum(['auto', 'light', 'dark']),
  fast: z.boolean(),
});

// --------------------------------------------------------------------------
// Raw flag shape coming out of commander. All string-typed because commander
// does not run our custom coercion by default.
// --------------------------------------------------------------------------

type RawExtractFlags = {
  file?: string;
  format?: string;
  out?: string;
  timeout?: string;
  minConfidence?: string;
  theme?: string;
  fast?: boolean;
  userAgent?: string;
};

// --------------------------------------------------------------------------
// Input resolution (URL vs file mutex)
// --------------------------------------------------------------------------

/**
 * Resolves the raw CLI positional + `--file` flag into a validated `Input`.
 *
 * Rules (SDD §"Error Handling"):
 *   - Both URL and --file → UserError("...not both")
 *   - Neither            → UserError("Must specify a URL or --file <path>")
 *   - URL                → parseUrl (scheme allowlist) → { kind: 'url' }
 *   - File               → loadFile (ENOENT / dir / symlink / ext) → { kind: 'file' }
 */
async function resolveInput(
  urlArg: string | undefined,
  fileFlag: string | undefined,
): Promise<Input> {
  if (urlArg !== undefined && fileFlag !== undefined) {
    throw new UserError('Specify either a URL or --file, not both');
  }
  if (urlArg === undefined && fileFlag === undefined) {
    throw new UserError('Must specify a URL or --file <path>');
  }

  if (urlArg !== undefined) {
    const parsed = parseUrl(urlArg);
    return { kind: 'url', url: parsed.toString() };
  }

  // `fileFlag` is defined here — the mutex above guarantees it.
  const { absPath } = await loadFile(fileFlag as string);
  return { kind: 'file', path: absPath };
}

// --------------------------------------------------------------------------
// Flag coercion
// --------------------------------------------------------------------------

function parseTimeoutMs(raw: string | undefined, fallbackMs: number): number {
  if (raw === undefined) return fallbackMs;
  const seconds = Number.parseFloat(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new UserError(`--timeout must be a positive number, got: ${raw}`);
  }
  return Math.round(seconds * 1000);
}

function parseMinConfidence(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new UserError(
      `--min-confidence must be between 0 and 1, got: ${raw}`,
    );
  }
  return value;
}

function parseFormatFlag(raw: string | undefined): OutputFormat {
  const value = raw ?? 'json';
  if (value !== 'json' && value !== 'css' && value !== 'js' && value !== 'md') {
    throw new UserError(
      `--format must be one of json|css|js|md, got: ${value}`,
    );
  }
  return value;
}

function parseThemeFlag(raw: string | undefined): Theme {
  const value = raw ?? 'auto';
  if (value !== 'auto' && value !== 'light' && value !== 'dark') {
    throw new UserError(
      `--theme must be one of auto|light|dark, got: ${value}`,
    );
  }
  return value;
}

// --------------------------------------------------------------------------
// Post-extract confidence filter
// --------------------------------------------------------------------------

/**
 * Drops tokens whose `com.dte.confidence` is strictly below `threshold`.
 * Operates only on leaf Token records — metadata keys ($schema, $metadata)
 * and empty category buckets are preserved verbatim.
 */
function filterByConfidence(tokenSet: TokenSet, threshold: number): TokenSet {
  if (threshold <= 0) return tokenSet;

  const filterCollection = (
    collection: Record<string, Token>,
  ): Record<string, Token> => {
    const out: Record<string, Token> = {};
    for (const [key, token] of Object.entries(collection)) {
      if (token.$extensions['com.dte.confidence'] >= threshold) {
        out[key] = token;
      }
    }
    return out;
  };

  const filterSubcollection = (
    subcollection: Record<string, Record<string, Token>>,
  ): Record<string, Record<string, Token>> => {
    const out: Record<string, Record<string, Token>> = {};
    for (const [subKey, collection] of Object.entries(subcollection)) {
      out[subKey] = filterCollection(collection);
    }
    return out;
  };

  return {
    ...tokenSet,
    color: filterCollection(tokenSet.color),
    typography: filterSubcollection(tokenSet.typography),
    spacing: filterCollection(tokenSet.spacing),
    radius: filterCollection(tokenSet.radius),
    shadow: filterCollection(tokenSet.shadow),
    zIndex: filterCollection(tokenSet.zIndex),
    breakpoint: filterCollection(tokenSet.breakpoint),
    motion: filterSubcollection(tokenSet.motion),
  };
}

// --------------------------------------------------------------------------
// Formatter dispatch
// --------------------------------------------------------------------------

function serialize(tokenSet: TokenSet, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return formatJson(tokenSet);
    case 'css':
      return formatCss(tokenSet);
    case 'js':
      return formatJs(tokenSet);
    case 'md':
      return formatMarkdown(tokenSet);
  }
}

// --------------------------------------------------------------------------
// Spinner
// --------------------------------------------------------------------------

/**
 * Creates an ora spinner only when stdout is a TTY — piped / redirected
 * stdout (or CI) suppresses the animation but still lets the payload flow
 * through. Returns `null` when no spinner should be shown.
 */
function createSpinner(text: string): Ora | null {
  if (!process.stdout.isTTY) return null;
  return ora({ text, stream: process.stderr }).start();
}

// --------------------------------------------------------------------------
// Extract subcommand action
// --------------------------------------------------------------------------

async function runExtract(
  urlArg: string | undefined,
  flags: RawExtractFlags,
): Promise<void> {
  let spinner: Ora | null = null;
  try {
    const input = await resolveInput(urlArg, flags.file);

    const rawOpts = {
      input,
      format: parseFormatFlag(flags.format),
      out: flags.out,
      timeoutMs: parseTimeoutMs(flags.timeout, 60_000),
      minConfidence: parseMinConfidence(flags.minConfidence, 0),
      theme: parseThemeFlag(flags.theme),
      fast: flags.fast === true,
    };

    const parsedOpts: CliOptions = cliOptionsSchema.parse(rawOpts);

    if (parsedOpts.fast) {
      process.stderr.write(
        'warning: --fast is not implemented in v1; proceeding with headless renderer\n',
      );
    }

    spinner = createSpinner('Extracting design tokens...');

    const tokenSet = await extract(parsedOpts);
    const filtered = filterByConfidence(tokenSet, parsedOpts.minConfidence);
    const serialized = serialize(filtered, parsedOpts.format);

    await writeAtomic(serialized, parsedOpts.out);

    if (spinner !== null) spinner.succeed('Done');
  } catch (err: unknown) {
    if (spinner !== null) spinner.fail();
    handleError(err);
  }
}

// --------------------------------------------------------------------------
// Error → exit-code mapping
// --------------------------------------------------------------------------

function handleError(err: unknown): never {
  if (err instanceof z.ZodError) {
    const messages = err.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    process.stderr.write(`Invalid options: ${messages}\n`);
    process.exit(1);
  }

  if (err instanceof ExtractionError) {
    process.stderr.write(`${err.message}\n`);
    process.exit(err.exitCode);
  }

  if (err instanceof UserError) {
    process.stderr.write(`${err.message}\n`);
    process.exit(err.exitCode);
  }

  if (err instanceof DteError) {
    process.stderr.write(`${err.message}\n`);
    process.exit(err.exitCode);
  }

  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Internal error: ${message}\n`);
  process.exit(3);
}

// --------------------------------------------------------------------------
// Program wiring
// --------------------------------------------------------------------------

function buildProgram(): Command {
  const program = new Command();

  program
    .name('design-token-extractor')
    .description('Extract design tokens from any website into W3C DTCG JSON')
    .version(CLI_VERSION, '-V, --version', 'Print version');

  program
    .command('extract')
    .description('Extract tokens from a URL or local HTML file')
    .argument(
      '[url]',
      'Target URL (http/https). Mutually exclusive with --file.',
    )
    .option('--file <path>', 'Extract from local HTML file')
    .option('-f, --format <fmt>', 'Output format: json | css | js | md', 'json')
    .option('-o, --out <path>', 'Output file path (default: stdout)')
    .option('--timeout <seconds>', 'Extraction timeout', '60')
    .option(
      '--min-confidence <num>',
      'Filter tokens below this confidence',
      '0',
    )
    .option(
      '--theme <mode>',
      'Theme emulation: auto | light | dark',
      'auto',
    )
    .option('--fast', 'Skip headless browser; static HTML only (v2)')
    .option('--user-agent <string>', 'Override User-Agent (reserved for v2)')
    .action(async (urlArg: string | undefined, flags: RawExtractFlags) => {
      await runExtract(urlArg, flags);
    });

  // Commander defaults to exit 1 on parse errors (unknown options, missing
  // required arguments). That matches the SDD table for "Invalid CLI flag"
  // so we leave the default behavior in place.
  program.exitOverride((err) => {
    // Allow help / version to exit normally.
    if (
      err.code === 'commander.helpDisplayed' ||
      err.code === 'commander.version'
    ) {
      process.exit(0);
    }
    process.exit(1);
  });

  return program;
}

// --------------------------------------------------------------------------
// Entry point
// --------------------------------------------------------------------------

async function main(): Promise<void> {
  const program = buildProgram();
  try {
    await program.parseAsync(process.argv);
  } catch (err: unknown) {
    handleError(err);
  }
}

void main();
