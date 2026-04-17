/**
 * DTCG JSON formatter (spec 001, task T7.1).
 *
 * Canonical output serializer for the design-token-extractor pipeline.
 * Validates the incoming TokenSet via Zod at the write boundary
 * (ADR-5: "Validate CliOptions + TokenSet before write; catches internal
 * drift") and renders it as pretty-printed JSON (2-space indent) conforming
 * to the W3C DTCG community-group draft.
 *
 * The Zod schemas (`tokenSchema`, `tokenSetSchema`) are exported so other
 * modules — notably `io/write` — can compose validation without
 * re-deriving the shape.
 *
 * Pure: no I/O, no mutation, no network.
 */

import { z } from 'zod';
import type { Token, TokenSet } from '../types.ts';

const DTCG_SCHEMA_URL = 'https://design-tokens.github.io/community-group/format/';

const tokenTypeSchema = z.enum([
  'color',
  'dimension',
  'fontFamily',
  'fontWeight',
  'duration',
  'cubicBezier',
  'shadow',
  'number',
  'other',
]);

const tokenValueSchema = z.union([
  z.string(),
  z.number(),
  z.record(z.string(), z.unknown()),
]);

const tokenUsageSchema = z.object({
  selectors: z.array(z.string()),
  count: z.number().int().min(0),
});

const tokenExtensionsSchema = z.object({
  'com.dte.usage': tokenUsageSchema,
  'com.dte.confidence': z.number().min(0).max(1),
  'com.dte.source': z.enum(['stylesheet', 'inline']).optional(),
  'com.dte.unresolvedVar': z.string().optional(),
  'com.dte.theme': z.enum(['light', 'dark']).optional(),
});

/**
 * Zod schema for a single DTCG-compatible Token. Mirrors the `Token` type
 * in `../types.ts`. Strict about shape — unknown `$type` values and
 * out-of-range confidence are rejected.
 */
export const tokenSchema: z.ZodType<Token> = z.object({
  $value: tokenValueSchema,
  $type: tokenTypeSchema,
  $description: z.string().optional(),
  $extensions: tokenExtensionsSchema,
}) as z.ZodType<Token>;

const tokenCollectionSchema = z.record(z.string(), tokenSchema);
const subcategoryCollectionSchema = z.record(z.string(), tokenCollectionSchema);

const tokenSetMetadataSchema = z.object({
  extractor: z.literal('design-token-extractor'),
  version: z.string(),
  extractedAt: z.string(),
  source: z.object({
    kind: z.enum(['url', 'file']),
    value: z.string(),
  }),
});

/**
 * Zod schema for the canonical TokenSet. Used by `formatJson` at the write
 * boundary per ADR-5. Enforces the exact DTCG `$schema` literal, the
 * extractor metadata, and the full 8-category shape.
 */
export const tokenSetSchema: z.ZodType<TokenSet> = z.object({
  $schema: z.literal(DTCG_SCHEMA_URL),
  $metadata: tokenSetMetadataSchema,
  color: tokenCollectionSchema,
  typography: subcategoryCollectionSchema,
  spacing: tokenCollectionSchema,
  radius: tokenCollectionSchema,
  shadow: tokenCollectionSchema,
  zIndex: tokenCollectionSchema,
  breakpoint: tokenCollectionSchema,
  motion: subcategoryCollectionSchema,
}) as z.ZodType<TokenSet>;

/**
 * Serializes a `TokenSet` to canonical DTCG JSON (pretty-printed, 2-space
 * indent). Throws a `ZodError` if `tokenSet` fails schema validation —
 * callers (typically `io/write`) are responsible for surfacing the error
 * with remediation context.
 */
export function formatJson(tokenSet: TokenSet): string {
  const validated = tokenSetSchema.parse(tokenSet);
  return JSON.stringify(validated, null, 2);
}
