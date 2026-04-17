/**
 * Error hierarchy for the design-token-extractor CLI.
 *
 * Exit codes map to the SDD §"Error Handling" table:
 *   - UserError       → 1  (invalid input / flag usage)
 *   - ExtractionError → 2  (render or network failure)
 *   - InternalError   → 3  (invariant violated / IO crash)
 *
 * Each subclass uses the ES2022 `Error` `cause` option to preserve the
 * originating error without losing the user-facing message.
 */

export class DteError extends Error {
  public readonly exitCode: number;

  protected constructor(
    message: string,
    exitCode: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.exitCode = exitCode;
    this.name = 'DteError';
  }
}

export class UserError extends DteError {
  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, 1, options);
    this.name = 'UserError';
  }
}

export class ExtractionError extends DteError {
  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, 2, options);
    this.name = 'ExtractionError';
  }
}

export class InternalError extends DteError {
  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, 3, options);
    this.name = 'InternalError';
  }
}
