import type { Context } from 'hono';

export const ADMIN_BASE_PATH = '';

export function prefersHtml(c: Context): boolean {
  const accept = c.req.header('accept') ?? '';
  return accept.includes('text/html');
}

export type BodyPayload = Record<string, unknown>;

export async function readBody(c: Context): Promise<BodyPayload> {
  const contentType = (c.req.header('content-type') ?? '').toLowerCase();
  if (contentType.includes('application/json')) {
    try {
      const json = await c.req.json();
      return typeof json === 'object' && json !== null ? (json as BodyPayload) : {};
    } catch {
      return {};
    }
  }
  const form = await c.req.parseBody();
  return form as BodyPayload;
}

export function valueToString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (Array.isArray(value) && value.length > 0) {
    return valueToString(value[0]);
  }
  return null;
}

export function combinePaths(basePath: string, requestPath: string): string {
  if (!basePath || basePath === '/') {
    return normalizePath(requestPath);
  }
  return `${normalizeBase(basePath)}${normalizePath(requestPath)}`;
}

function normalizeBase(pathname: string): string {
  if (pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function normalizePath(pathname: string): string {
  if (!pathname) return '/';
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export function redirectToAdmin(c: Context, params: Record<string, string> = {}): Response {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      search.set(key, value);
    }
  });
  const suffix = search.size > 0 ? `?${search.toString()}` : '';
  const base = ADMIN_BASE_PATH || '';
  const destination = base ? `${base}/${suffix}` : `/${suffix}`;
  return c.redirect(destination);
}
