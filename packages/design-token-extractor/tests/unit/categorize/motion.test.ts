import { describe, expect, it } from 'vitest';
import { categorizeMotion, type MotionBuckets } from '../../../src/categorize/motion.ts';
import type { RawStyleRecord, Token } from '../../../src/types.ts';

/**
 * Tests for src/categorize/motion.ts (spec 001 T5.8, research §3.8).
 *
 * `categorizeMotion(records)` splits motion-related RawStyleRecords into two
 * DTCG buckets:
 *
 *   { duration: Token[], easing: Token[] }
 *
 * Duration properties     : transition-duration, animation-duration
 * Easing properties       : transition-timing-function, animation-timing-function
 *
 * Easing $type mapping:
 *   - Named keyword (ease, ease-in, ease-out, ease-in-out, linear,
 *     step-start, step-end) → $type = 'other'
 *   - `cubic-bezier(...)`                                  → $type = 'cubicBezier'
 *   - `steps(...)`                                          → $type = 'other'
 *
 * Durations always use $type = 'duration', with the original unit preserved
 * verbatim (e.g. '300ms' stays '300ms', '0.3s' stays '0.3s'). `0s` is kept;
 * `none`, `initial`, `inherit` are skipped. Identical (property-bucket,
 * value) pairs across multiple selectors collapse into a single Token, with
 * all source selectors recorded under `$extensions['com.dte.usage']`.
 */

function makeRecord(
  overrides: Partial<RawStyleRecord> & Pick<RawStyleRecord, 'property' | 'value'>,
): RawStyleRecord {
  return {
    selector: overrides.selector ?? '.x',
    property: overrides.property,
    value: overrides.value,
    source: overrides.source ?? 'stylesheet',
    theme: overrides.theme ?? 'light',
    scope: overrides.scope ?? ':root',
    originalVar: overrides.originalVar,
  };
}

describe('categorizeMotion — empty input', () => {
  it('returns empty buckets for an empty record list', () => {
    const result: MotionBuckets = categorizeMotion([]);
    expect(result).toEqual({ duration: [], easing: [] });
  });
});

describe('categorizeMotion — duration bucket', () => {
  it('categorizes transition-duration `300ms` as a duration token', () => {
    const result = categorizeMotion([
      makeRecord({ property: 'transition-duration', value: '300ms', selector: '.btn' }),
    ]);

    expect(result.easing).toEqual([]);
    expect(result.duration).toHaveLength(1);
    const [token] = result.duration;
    expect(token.$type).toBe('duration');
    expect(token.$value).toBe('300ms');
  });

  it('preserves the `s` unit verbatim for animation-duration `0.3s`', () => {
    const result = categorizeMotion([
      makeRecord({ property: 'animation-duration', value: '0.3s', selector: '.fade' }),
    ]);

    expect(result.duration).toHaveLength(1);
    const [token] = result.duration;
    expect(token.$type).toBe('duration');
    expect(token.$value).toBe('0.3s');
  });

  it('keeps 0s durations (they are valid motion tokens, not skipped)', () => {
    const result = categorizeMotion([
      makeRecord({ property: 'transition-duration', value: '0s', selector: '.instant' }),
    ]);

    expect(result.duration).toHaveLength(1);
    expect(result.duration[0].$value).toBe('0s');
  });

  it('deduplicates the same duration across multiple selectors into one Token', () => {
    const result = categorizeMotion([
      makeRecord({ property: 'transition-duration', value: '200ms', selector: '.a' }),
      makeRecord({ property: 'transition-duration', value: '200ms', selector: '.b' }),
      makeRecord({ property: 'animation-duration', value: '200ms', selector: '.c' }),
    ]);

    expect(result.duration).toHaveLength(1);
    const [token] = result.duration;
    expect(token.$value).toBe('200ms');
    const usage = token.$extensions['com.dte.usage'];
    expect(usage.count).toBe(3);
    expect(usage.selectors).toEqual(expect.arrayContaining(['.a', '.b', '.c']));
    expect(usage.selectors).toHaveLength(3);
  });

  it('keeps different duration values as distinct tokens', () => {
    const result = categorizeMotion([
      makeRecord({ property: 'transition-duration', value: '150ms' }),
      makeRecord({ property: 'transition-duration', value: '300ms' }),
    ]);

    expect(result.duration).toHaveLength(2);
    const values = result.duration.map((t: Token) => t.$value).sort();
    expect(values).toEqual(['150ms', '300ms']);
  });
});

describe('categorizeMotion — easing bucket', () => {
  it('categorizes the keyword `ease-in-out` as $type=other', () => {
    const result = categorizeMotion([
      makeRecord({
        property: 'transition-timing-function',
        value: 'ease-in-out',
        selector: '.btn',
      }),
    ]);

    expect(result.duration).toEqual([]);
    expect(result.easing).toHaveLength(1);
    const [token] = result.easing;
    expect(token.$type).toBe('other');
    expect(token.$value).toBe('ease-in-out');
  });

  it.each([
    ['ease'],
    ['ease-in'],
    ['ease-out'],
    ['linear'],
    ['step-start'],
    ['step-end'],
  ])('maps keyword `%s` to $type=other', (keyword: string) => {
    const result = categorizeMotion([
      makeRecord({ property: 'transition-timing-function', value: keyword }),
    ]);
    expect(result.easing).toHaveLength(1);
    expect(result.easing[0].$type).toBe('other');
    expect(result.easing[0].$value).toBe(keyword);
  });

  it('categorizes `cubic-bezier(0.4, 0, 0.2, 1)` as $type=cubicBezier with verbatim string $value', () => {
    const cb = 'cubic-bezier(0.4, 0, 0.2, 1)';
    const result = categorizeMotion([
      makeRecord({
        property: 'animation-timing-function',
        value: cb,
        selector: '.anim',
      }),
    ]);

    expect(result.easing).toHaveLength(1);
    const [token] = result.easing;
    expect(token.$type).toBe('cubicBezier');
    expect(token.$value).toBe(cb);
  });

  it('categorizes `steps(4, end)` as $type=other with verbatim value', () => {
    const result = categorizeMotion([
      makeRecord({
        property: 'animation-timing-function',
        value: 'steps(4, end)',
      }),
    ]);

    expect(result.easing).toHaveLength(1);
    expect(result.easing[0].$type).toBe('other');
    expect(result.easing[0].$value).toBe('steps(4, end)');
  });

  it('deduplicates the same easing string across selectors into one Token', () => {
    const cb = 'cubic-bezier(0.4, 0, 0.2, 1)';
    const result = categorizeMotion([
      makeRecord({ property: 'transition-timing-function', value: cb, selector: '.a' }),
      makeRecord({ property: 'transition-timing-function', value: cb, selector: '.b' }),
      makeRecord({ property: 'animation-timing-function', value: cb, selector: '.c' }),
    ]);

    expect(result.easing).toHaveLength(1);
    const usage = result.easing[0].$extensions['com.dte.usage'];
    expect(usage.count).toBe(3);
    expect(usage.selectors).toEqual(expect.arrayContaining(['.a', '.b', '.c']));
    expect(usage.selectors).toHaveLength(3);
  });

  it('keeps different easing strings as distinct tokens', () => {
    const result = categorizeMotion([
      makeRecord({ property: 'transition-timing-function', value: 'ease-in-out' }),
      makeRecord({
        property: 'animation-timing-function',
        value: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }),
    ]);

    expect(result.easing).toHaveLength(2);
  });
});

describe('categorizeMotion — skipped values', () => {
  it.each([['none'], ['initial'], ['inherit']])(
    'skips duration value `%s`',
    (skipped: string) => {
      const result = categorizeMotion([
        makeRecord({ property: 'transition-duration', value: skipped }),
      ]);
      expect(result.duration).toEqual([]);
      expect(result.easing).toEqual([]);
    },
  );

  it.each([['none'], ['initial'], ['inherit']])(
    'skips easing value `%s`',
    (skipped: string) => {
      const result = categorizeMotion([
        makeRecord({ property: 'transition-timing-function', value: skipped }),
      ]);
      expect(result.duration).toEqual([]);
      expect(result.easing).toEqual([]);
    },
  );

  it('ignores non-motion records entirely', () => {
    const result = categorizeMotion([
      makeRecord({ property: 'color', value: '#000' }),
      makeRecord({ property: 'padding', value: '8px' }),
    ]);
    expect(result).toEqual({ duration: [], easing: [] });
  });
});

describe('categorizeMotion — mixed input', () => {
  it('splits a mixed record list into duration and easing buckets', () => {
    const result = categorizeMotion([
      makeRecord({ property: 'transition-duration', value: '300ms', selector: '.a' }),
      makeRecord({
        property: 'transition-timing-function',
        value: 'ease-in-out',
        selector: '.a',
      }),
      makeRecord({ property: 'animation-duration', value: '0.3s', selector: '.b' }),
      makeRecord({
        property: 'animation-timing-function',
        value: 'cubic-bezier(0.4, 0, 0.2, 1)',
        selector: '.b',
      }),
    ]);

    expect(result.duration).toHaveLength(2);
    expect(result.easing).toHaveLength(2);
    expect(result.duration.every((t: Token) => t.$type === 'duration')).toBe(true);

    const easingByValue = new Map(result.easing.map((t: Token) => [t.$value as string, t]));
    expect(easingByValue.get('ease-in-out')?.$type).toBe('other');
    expect(easingByValue.get('cubic-bezier(0.4, 0, 0.2, 1)')?.$type).toBe('cubicBezier');
  });
});
