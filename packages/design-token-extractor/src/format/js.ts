// T7.3 — ES module formatter for TokenSet.
//
// Emits a JS source string of the form:
//   export default { ... };
//
// The object body is produced with JSON.stringify(tokenSet, null, 2). JSON
// output is a strict subset of ECMAScript object-literal syntax for the value
// types this pipeline emits (strings, numbers, booleans, null, arrays, plain
// objects). The DTCG $metadata.extractedAt is an ISO-8601 string, which is
// also a plain JS string literal. Therefore the resulting source is a valid
// ES module with an object-literal default export.

import type { TokenSet } from '../types.ts';

const INDENT = 2;

export function formatJs(tokenSet: TokenSet): string {
  const body = JSON.stringify(tokenSet, null, INDENT);
  return `export default ${body};\n`;
}
