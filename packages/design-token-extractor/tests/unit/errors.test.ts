import { describe, expect, it } from 'vitest';
import {
  DteError,
  ExtractionError,
  InternalError,
  UserError,
} from '../../src/errors.ts';

describe('DteError base class', () => {
  it('is a subclass of Error', () => {
    // UserError is a concrete subclass of DteError used to verify base behavior.
    const instance = new UserError('probe');
    expect(instance).toBeInstanceOf(DteError);
    expect(instance).toBeInstanceOf(Error);
  });
});

describe('UserError', () => {
  it('is instanceof Error and DteError', () => {
    const error = new UserError('bad input');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DteError);
    expect(error).toBeInstanceOf(UserError);
  });

  it('has exitCode === 1', () => {
    const error = new UserError('bad input');
    expect(error.exitCode).toBe(1);
  });

  it('has name === "UserError"', () => {
    const error = new UserError('bad input');
    expect(error.name).toBe('UserError');
  });

  it('preserves the message', () => {
    const error = new UserError('specific user message');
    expect(error.message).toBe('specific user message');
  });

  it('preserves optional cause', () => {
    const inner = new Error('root cause');
    const error = new UserError('wrapper', { cause: inner });
    expect(error.cause).toBe(inner);
  });
});

describe('ExtractionError', () => {
  it('is instanceof Error and DteError', () => {
    const error = new ExtractionError('extraction failed');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DteError);
    expect(error).toBeInstanceOf(ExtractionError);
  });

  it('has exitCode === 2', () => {
    const error = new ExtractionError('extraction failed');
    expect(error.exitCode).toBe(2);
  });

  it('has name === "ExtractionError"', () => {
    const error = new ExtractionError('extraction failed');
    expect(error.name).toBe('ExtractionError');
  });

  it('preserves the message', () => {
    const error = new ExtractionError('timeout after 60s');
    expect(error.message).toBe('timeout after 60s');
  });

  it('preserves optional cause', () => {
    const inner = new Error('network down');
    const error = new ExtractionError('could not reach target', { cause: inner });
    expect(error.cause).toBe(inner);
  });
});

describe('InternalError', () => {
  it('is instanceof Error and DteError', () => {
    const error = new InternalError('invariant violated');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DteError);
    expect(error).toBeInstanceOf(InternalError);
  });

  it('has exitCode === 3', () => {
    const error = new InternalError('invariant violated');
    expect(error.exitCode).toBe(3);
  });

  it('has name === "InternalError"', () => {
    const error = new InternalError('invariant violated');
    expect(error.name).toBe('InternalError');
  });

  it('preserves the message', () => {
    const error = new InternalError('unexpected null token');
    expect(error.message).toBe('unexpected null token');
  });

  it('preserves optional cause', () => {
    const inner = new Error('fs write failed');
    const error = new InternalError('could not write output', { cause: inner });
    expect(error.cause).toBe(inner);
  });
});
