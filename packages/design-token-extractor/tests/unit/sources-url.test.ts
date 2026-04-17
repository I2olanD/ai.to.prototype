import { describe, expect, it } from 'vitest';
import { parseUrl } from '../../src/sources/url.ts';
import { UserError } from '../../src/errors.ts';

/**
 * URL source validator tests.
 *
 * Enforces the scheme allowlist defined in SDD §"System-Wide Patterns → Security":
 * only `http:` and `https:` are accepted; `file:`, `data:`, `javascript:`, and any
 * other scheme must be rejected with a `UserError` (exit code 1) to mitigate SSRF
 * and local-file disclosure.
 */
describe('parseUrl', () => {
  describe('accepts http(s) URLs', () => {
    it('returns a URL object for http://example.com with href preserved', () => {
      const url = parseUrl('http://example.com');
      expect(url).toBeInstanceOf(URL);
      expect(url.href).toBe('http://example.com/');
      expect(url.protocol).toBe('http:');
    });

    it('returns a URL object for https://example.com/path?q=1 with href preserved', () => {
      const input = 'https://example.com/path?q=1';
      const url = parseUrl(input);
      expect(url).toBeInstanceOf(URL);
      expect(url.href).toBe(input);
      expect(url.protocol).toBe('https:');
    });

    it('trims surrounding whitespace before parsing', () => {
      const url = parseUrl('  https://example.com  ');
      expect(url).toBeInstanceOf(URL);
      expect(url.href).toBe('https://example.com/');
      expect(url.protocol).toBe('https:');
    });

    it('normalizes scheme case via WHATWG URL — protocol is lowercase https:', () => {
      const url = parseUrl('HTTPS://EXAMPLE.COM');
      expect(url).toBeInstanceOf(URL);
      expect(url.protocol).toBe('https:');
    });
  });

  describe('rejects disallowed schemes with UserError', () => {
    it('rejects file:// URLs', () => {
      expect(() => parseUrl('file:///etc/passwd')).toThrow(UserError);
      try {
        parseUrl('file:///etc/passwd');
      } catch (error) {
        expect(error).toBeInstanceOf(UserError);
        expect((error as UserError).message).toMatch(/http/);
        expect((error as UserError).exitCode).toBe(1);
      }
    });

    it('rejects data: URLs', () => {
      expect(() => parseUrl('data:text/html,<h1>x</h1>')).toThrow(UserError);
      try {
        parseUrl('data:text/html,<h1>x</h1>');
      } catch (error) {
        expect(error).toBeInstanceOf(UserError);
        expect((error as UserError).exitCode).toBe(1);
      }
    });

    it('rejects javascript: URLs', () => {
      expect(() => parseUrl('javascript:alert(1)')).toThrow(UserError);
      try {
        parseUrl('javascript:alert(1)');
      } catch (error) {
        expect(error).toBeInstanceOf(UserError);
        expect((error as UserError).exitCode).toBe(1);
      }
    });

    it('rejects ftp:// URLs', () => {
      expect(() => parseUrl('ftp://example.com')).toThrow(UserError);
      try {
        parseUrl('ftp://example.com');
      } catch (error) {
        expect(error).toBeInstanceOf(UserError);
        expect((error as UserError).exitCode).toBe(1);
      }
    });
  });

  describe('rejects invalid or empty input with UserError', () => {
    it('rejects a non-URL string with "Invalid URL" message', () => {
      expect(() => parseUrl('not-a-url')).toThrow(UserError);
      try {
        parseUrl('not-a-url');
      } catch (error) {
        expect(error).toBeInstanceOf(UserError);
        expect((error as UserError).message).toMatch(/Invalid URL/);
        expect((error as UserError).exitCode).toBe(1);
      }
    });

    it('rejects an empty string', () => {
      expect(() => parseUrl('')).toThrow(UserError);
      try {
        parseUrl('');
      } catch (error) {
        expect(error).toBeInstanceOf(UserError);
        expect((error as UserError).exitCode).toBe(1);
      }
    });

    it('rejects a whitespace-only string', () => {
      expect(() => parseUrl('   ')).toThrow(UserError);
      try {
        parseUrl('   ');
      } catch (error) {
        expect(error).toBeInstanceOf(UserError);
        expect((error as UserError).exitCode).toBe(1);
      }
    });
  });
});
