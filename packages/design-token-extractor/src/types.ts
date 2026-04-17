// Domain type definitions for the design-token-extractor pipeline.
// Compile-time only: no runtime code, no imports from other src/ files.
// Shapes mirror SDD §"Application Data Models" (spec 001).

declare global {
  // Injected by tsup at build time from package.json#version.
  // Tests use a fallback via `typeof` check.
  const __DTE_VERSION__: string;
}

export type Input =
  | { kind: 'url'; url: string }
  | { kind: 'file'; path: string };

export type OutputFormat = 'json' | 'css' | 'js' | 'md';

export type Theme = 'auto' | 'light' | 'dark';

export type CliOptions = {
  input: Input;
  format: OutputFormat;
  out?: string;
  timeoutMs: number;
  minConfidence: number;
  theme: Theme;
  fast: boolean;
};

export type StyleSource = 'stylesheet' | 'inline';

export type ThemeTag = 'light' | 'dark';

export type RawStyleRecord = {
  selector: string;
  property: string;
  value: string;
  source: StyleSource;
  theme: ThemeTag;
  scope: string;
  originalVar?: string;
};

export type TokenType =
  | 'color'
  | 'dimension'
  | 'fontFamily'
  | 'fontWeight'
  | 'duration'
  | 'cubicBezier'
  | 'shadow'
  | 'number'
  | 'other';

export type TokenExtensions = {
  'com.dte.usage': { selectors: string[]; count: number };
  'com.dte.confidence': number;
  'com.dte.source'?: StyleSource;
  'com.dte.unresolvedVar'?: string;
  'com.dte.theme'?: ThemeTag;
};

export type Token = {
  $value: string | number | Record<string, unknown>;
  $type: TokenType;
  $description?: string;
  $extensions: TokenExtensions;
};

export type TokenSetMetadata = {
  extractor: 'design-token-extractor';
  version: string;
  extractedAt: string;
  source: { kind: 'url' | 'file'; value: string };
};

export type TokenCollection = Record<string, Token>;

export type SubcategoryCollection = Record<string, TokenCollection>;

export type TokenSet = {
  $schema: 'https://design-tokens.github.io/community-group/format/';
  $metadata: TokenSetMetadata;
  color: TokenCollection;
  typography: SubcategoryCollection;
  spacing: TokenCollection;
  radius: TokenCollection;
  shadow: TokenCollection;
  zIndex: TokenCollection;
  breakpoint: TokenCollection;
  motion: SubcategoryCollection;
};
