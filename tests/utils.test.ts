import { describe, expect, it } from 'bun:test';
import { combinePaths, prefersHtml, readBody, valueToString, redirectToAdmin } from '../src/utils';
import type { Context } from 'hono';

describe('combinePaths', () => {
  it('joins base and request paths', () => {
    expect(combinePaths('/base', '/api')).toBe('/base/api');
  });

  it('handles empty base', () => {
    expect(combinePaths('', '/api')).toBe('/api');
  });

  it('normalizes missing leading slash', () => {
    expect(combinePaths('/base', 'api')).toBe('/base/api');
  });

  it('handles base with trailing slash', () => {
    expect(combinePaths('/base/', '/api')).toBe('/base/api');
  });

  it('handles slash base', () => {
    expect(combinePaths('/', '/api')).toBe('/api');
  });
});

describe('prefersHtml', () => {
  it('returns true when accept header includes text/html', () => {
    const c = {
      req: {
        header: (name: string) => 'text/html,application/xhtml+xml',
      },
    } as Context;
    expect(prefersHtml(c)).toBe(true);
  });

  it('returns false when accept header does not include text/html', () => {
    const c = {
      req: {
        header: (name: string) => 'application/json',
      },
    } as Context;
    expect(prefersHtml(c)).toBe(false);
  });

  it('returns false when accept header is missing', () => {
    const c = {
      req: {
        header: (name: string) => null,
      },
    } as Context;
    expect(prefersHtml(c)).toBe(false);
  });
});

describe('readBody', () => {
  it('parses JSON body when content-type is application/json', async () => {
    const c = {
      req: {
        header: (name: string) => 'application/json',
        json: async () => ({ key: 'value' }),
        parseBody: async () => ({}),
      },
    } as Context;
    const result = await readBody(c);
    expect(result).toEqual({ key: 'value' });
  });

  it('returns empty object for invalid JSON', async () => {
    const c = {
      req: {
        header: (name: string) => 'application/json',
        json: async () => {
          throw new Error('Invalid JSON');
        },
        parseBody: async () => ({}),
      },
    } as Context;
    const result = await readBody(c);
    expect(result).toEqual({});
  });

  it('returns empty object for non-object JSON', async () => {
    const c = {
      req: {
        header: (name: string) => 'application/json',
        json: async () => 'string',
        parseBody: async () => ({}),
      },
    } as Context;
    const result = await readBody(c);
    expect(result).toEqual({});
  });

  it('parses form body when content-type is not JSON', async () => {
    const c = {
      req: {
        header: (name: string) => 'application/x-www-form-urlencoded',
        json: async () => ({}),
        parseBody: async () => ({ field: 'value' }),
      },
    } as Context;
    const result = await readBody(c);
    expect(result).toEqual({ field: 'value' });
  });

  it('handles missing content-type header', async () => {
    const c = {
      req: {
        header: (name: string) => null,
        json: async () => ({}),
        parseBody: async () => ({ field: 'value' }),
      },
    } as Context;
    const result = await readBody(c);
    expect(result).toEqual({ field: 'value' });
  });
});

describe('valueToString', () => {
  it('returns trimmed string for string input', () => {
    expect(valueToString('  hello  ')).toBe('hello');
  });

  it('returns null for empty string', () => {
    expect(valueToString('   ')).toBeNull();
  });

  it('returns null for empty string after trim', () => {
    expect(valueToString('')).toBeNull();
  });

  it('returns first element for array', () => {
    expect(valueToString(['first', 'second'])).toBe('first');
  });

  it('returns null for empty array', () => {
    expect(valueToString([])).toBeNull();
  });

  it('returns null for non-string non-array', () => {
    expect(valueToString(123)).toBeNull();
  });

  it('recursively processes array elements', () => {
    expect(valueToString(['  hello  '])).toBe('hello');
  });
});

describe('redirectToAdmin', () => {
  it('redirects to root with no params', () => {
    const c = {
      redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
    } as Context;
    const response = redirectToAdmin(c);
    expect(response.headers.get('Location')).toBe('/');
  });

  it('redirects with query params', () => {
    const c = {
      redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
    } as Context;
    const response = redirectToAdmin(c, { foo: 'bar', baz: 'qux' });
    expect(response.headers.get('Location')).toBe('/?foo=bar&baz=qux');
  });

  it('filters out empty param values', () => {
    const c = {
      redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
    } as Context;
    const response = redirectToAdmin(c, { foo: 'bar', empty: '' });
    expect(response.headers.get('Location')).toBe('/?foo=bar');
  });
});
