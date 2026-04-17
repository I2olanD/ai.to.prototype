import { describe, expect, it } from 'vitest';
import {
  resolveValue,
  resolveRecords,
  type ScopeMap,
} from '../../src/resolve/css-vars.ts';
import type { RawStyleRecord } from '../../src/types.ts';

/**
 * Tests for src/resolve/css-vars.ts (SDD §"Implementation Examples → resolveVar",
 * §"Implementation Gotchas → CSS variable scope", spec 001 T4.1).
 *
 * Two public surfaces:
 *
 *   resolveValue(value, scopeMap, scope) → { resolved, originalVar? }
 *   resolveRecords(records, scopeMap) → RawStyleRecord[]
 *
 * Resolution rules:
 *   - Non-var strings pass through unchanged.
 *   - `var(--name)` resolves through scopeMap[scope], falling back to
 *     scopeMap[':root'] when the current scope does not define the name.
 *   - `var(--name, fallback)` uses the fallback when the name is missing;
 *     the fallback itself may contain nested var() references.
 *   - Circular chains and unresolvable names without a usable fallback
 *     return { resolved: 'unresolved', originalVar: <topmost var name> }.
 *   - A single value may embed a var() inside a larger expression
 *     (e.g. "1px solid var(--c)"); the substitution is partial.
 */

describe('resolveValue — non-var passthrough', () => {
  it('returns plain color values untouched', () => {
    expect(resolveValue('#000', {}, ':root')).toEqual({ resolved: '#000' });
  });

  it('returns plain keyword values untouched', () => {
    expect(resolveValue('red', {}, ':root')).toEqual({ resolved: 'red' });
  });

  it('returns compound values with no var() untouched', () => {
    expect(resolveValue('1px solid #ccc', {}, ':root')).toEqual({
      resolved: '1px solid #ccc',
    });
  });
});

describe('resolveValue — simple var lookup', () => {
  it('resolves a direct var reference from :root', () => {
    const scopeMap: ScopeMap = { ':root': { '--a': '#0066cc' } };
    expect(resolveValue('var(--a)', scopeMap, ':root')).toEqual({
      resolved: '#0066cc',
    });
  });

  it('resolves a nested chain (primary → brand → literal)', () => {
    const scopeMap: ScopeMap = {
      ':root': {
        '--primary': 'var(--brand)',
        '--brand': '#ff0000',
      },
    };
    expect(resolveValue('var(--primary)', scopeMap, ':root')).toEqual({
      resolved: '#ff0000',
    });
  });

  it('resolves a deep chain (3+ levels)', () => {
    const scopeMap: ScopeMap = {
      ':root': {
        '--a': 'var(--b)',
        '--b': 'var(--c)',
        '--c': 'var(--d)',
        '--d': '#111111',
      },
    };
    expect(resolveValue('var(--a)', scopeMap, ':root')).toEqual({
      resolved: '#111111',
    });
  });
});

describe('resolveValue — var embedded in larger value', () => {
  it('substitutes a var() inside a compound value', () => {
    const scopeMap: ScopeMap = { ':root': { '--c': '#ccc' } };
    expect(resolveValue('1px solid var(--c)', scopeMap, ':root')).toEqual({
      resolved: '1px solid #ccc',
    });
  });

  it('substitutes multiple var() occurrences inside one value', () => {
    const scopeMap: ScopeMap = {
      ':root': { '--width': '1px', '--color': '#ccc' },
    };
    expect(
      resolveValue('var(--width) solid var(--color)', scopeMap, ':root'),
    ).toEqual({ resolved: '1px solid #ccc' });
  });
});

describe('resolveValue — cycles', () => {
  it('returns unresolved with originalVar for a direct cycle', () => {
    const scopeMap: ScopeMap = {
      ':root': {
        '--a': 'var(--b)',
        '--b': 'var(--a)',
      },
    };
    expect(resolveValue('var(--a)', scopeMap, ':root')).toEqual({
      resolved: 'unresolved',
      originalVar: '--a',
    });
  });

  it('returns unresolved with originalVar for a self-referencing cycle', () => {
    const scopeMap: ScopeMap = { ':root': { '--loop': 'var(--loop)' } };
    expect(resolveValue('var(--loop)', scopeMap, ':root')).toEqual({
      resolved: 'unresolved',
      originalVar: '--loop',
    });
  });
});

describe('resolveValue — missing variables', () => {
  it('returns unresolved with originalVar when var is missing and no fallback', () => {
    expect(resolveValue('var(--nope)', {}, ':root')).toEqual({
      resolved: 'unresolved',
      originalVar: '--nope',
    });
  });

  it('uses the literal fallback when var is missing', () => {
    expect(resolveValue('var(--nope, blue)', {}, ':root')).toEqual({
      resolved: 'blue',
    });
  });

  it('resolves a nested-var fallback chain to its deepest literal', () => {
    expect(
      resolveValue('var(--nope, var(--also-nope, #fff))', {}, ':root'),
    ).toEqual({ resolved: '#fff' });
  });

  it('uses fallback when the primary var is absent even if ancestors exist in other scopes', () => {
    const scopeMap: ScopeMap = { '.dark': { '--other': 'blue' } };
    expect(resolveValue('var(--nope, green)', scopeMap, ':root')).toEqual({
      resolved: 'green',
    });
  });
});

describe('resolveValue — scope override', () => {
  const scopeMap: ScopeMap = {
    ':root': { '--a': 'red' },
    '.dark': { '--a': 'blue' },
  };

  it('prefers the current scope when it defines the var', () => {
    expect(resolveValue('var(--a)', scopeMap, '.dark')).toEqual({
      resolved: 'blue',
    });
  });

  it('uses :root when the current scope is :root', () => {
    expect(resolveValue('var(--a)', scopeMap, ':root')).toEqual({
      resolved: 'red',
    });
  });

  it('falls back to :root when the current scope is absent from scopeMap', () => {
    expect(resolveValue('var(--a)', scopeMap, '.light')).toEqual({
      resolved: 'red',
    });
  });

  it('falls back to :root when the current scope has no entry for the var', () => {
    const partial: ScopeMap = {
      ':root': { '--a': 'red' },
      '.dark': { '--other': 'purple' },
    };
    expect(resolveValue('var(--a)', partial, '.dark')).toEqual({
      resolved: 'red',
    });
  });
});

describe('resolveRecords — wrapper over RawStyleRecord[]', () => {
  it('resolves each record value per its own scope', () => {
    const scopeMap: ScopeMap = {
      ':root': { '--a': 'red' },
      '.dark': { '--a': 'blue' },
    };
    const records: RawStyleRecord[] = [
      {
        selector: 'body',
        property: 'color',
        value: 'var(--a)',
        source: 'stylesheet',
        theme: 'light',
        scope: ':root',
      },
      {
        selector: '.dark body',
        property: 'color',
        value: 'var(--a)',
        source: 'stylesheet',
        theme: 'dark',
        scope: '.dark',
      },
    ];
    const result = resolveRecords(records, scopeMap);
    expect(result[0].value).toBe('red');
    expect(result[0].originalVar).toBeUndefined();
    expect(result[1].value).toBe('blue');
    expect(result[1].originalVar).toBeUndefined();
  });

  it('marks unresolved records with originalVar and keeps the "unresolved" sentinel value', () => {
    const scopeMap: ScopeMap = {
      ':root': { '--a': 'var(--b)', '--b': 'var(--a)' },
    };
    const records: RawStyleRecord[] = [
      {
        selector: '.x',
        property: 'color',
        value: 'var(--a)',
        source: 'stylesheet',
        theme: 'light',
        scope: ':root',
      },
    ];
    const [record] = resolveRecords(records, scopeMap);
    expect(record.value).toBe('unresolved');
    expect(record.originalVar).toBe('--a');
  });

  it('leaves non-var records unchanged and without originalVar', () => {
    const records: RawStyleRecord[] = [
      {
        selector: 'button',
        property: 'background-color',
        value: '#ff0000',
        source: 'inline',
        theme: 'light',
        scope: ':root',
      },
    ];
    const [record] = resolveRecords(records, {});
    expect(record.value).toBe('#ff0000');
    expect(record.originalVar).toBeUndefined();
  });

  it('does not set originalVar when a fallback chain successfully resolves', () => {
    const records: RawStyleRecord[] = [
      {
        selector: 'a',
        property: 'color',
        value: 'var(--nope, var(--also-nope, #fff))',
        source: 'stylesheet',
        theme: 'light',
        scope: ':root',
      },
    ];
    const [record] = resolveRecords(records, {});
    expect(record.value).toBe('#fff');
    expect(record.originalVar).toBeUndefined();
  });

  it('preserves untouched fields (selector, property, source, theme, scope)', () => {
    const scopeMap: ScopeMap = { ':root': { '--a': '#abc' } };
    const input: RawStyleRecord = {
      selector: '.widget',
      property: 'border-color',
      value: 'var(--a)',
      source: 'stylesheet',
      theme: 'dark',
      scope: ':root',
    };
    const [record] = resolveRecords([input], scopeMap);
    expect(record).toEqual({
      selector: '.widget',
      property: 'border-color',
      value: '#abc',
      source: 'stylesheet',
      theme: 'dark',
      scope: ':root',
    });
  });
});
