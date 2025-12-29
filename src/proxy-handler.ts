import type { Context } from 'hono';
import type { TargetStore } from './store';
import { combinePaths } from './utils';

export async function proxyRequest(c: Context, store: TargetStore): Promise<Response> {
  const selection = store.getActiveSelection();
  if (!selection.url) {
    return c.text('ターゲットが未設定です /__/ にアクセスして設定してください', 503);
  }

  const incomingUrl = new URL(c.req.url);
  const targetBase = new URL(selection.url);
  const upstreamUrl = buildUpstreamUrl(targetBase, incomingUrl);

  const headers = cloneHeaders(c.req.raw.headers);
  headers.set('host', targetBase.host);
  headers.set('x-forwarded-host', incomingUrl.host);
  headers.set('x-forwarded-proto', incomingUrl.protocol.replace(':', ''));
  const forwardedFor = c.req.header('x-forwarded-for');
  headers.set('x-forwarded-for', forwardedFor ?? '127.0.0.1');

  const method = c.req.method.toUpperCase();
  const requestInit: RequestInit = {
    method,
    headers,
    redirect: 'manual',
  };

  if (shouldHaveBody(method) && c.req.raw.body) {
    requestInit.body = c.req.raw.body;
    (requestInit as RequestInit & { duplex: 'half' }).duplex = 'half';
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, requestInit);
    if (isWebSocketUpgrade(upstreamResponse)) {
      return upstreamResponse;
    }
    return rewriteResponse(upstreamResponse, incomingUrl, targetBase);
  } catch (error) {
    console.error('[proxy] upstream fetch failed', error);
    return c.text('アップストリームへの接続に失敗しました', 502);
  }
}

function buildUpstreamUrl(target: URL, incoming: URL): string {
  const url = new URL(target.toString());
  url.pathname = combinePaths(url.pathname, incoming.pathname);
  url.search = incoming.search;
  url.hash = incoming.hash;
  return url.toString();
}

function shouldHaveBody(method: string): boolean {
  return !['GET', 'HEAD'].includes(method);
}

function isWebSocketUpgrade(response: Response): boolean {
  if (response.status === 101) return true;
  const upgrade = response.headers.get('upgrade');
  return upgrade !== null && upgrade.toLowerCase() === 'websocket';
}

function rewriteResponse(response: Response, proxyUrl: URL, targetUrl: URL): Response {
  const headers = new Headers(response.headers);
  const location = headers.get('location');
  if (location) {
    const rewritten = rewriteLocation(location, proxyUrl, targetUrl);
    if (rewritten) {
      headers.set('location', rewritten);
    }
  }
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function rewriteLocation(location: string, proxyUrl: URL, targetUrl: URL): string | null {
  try {
    const parsed = new URL(location, targetUrl);
    if (parsed.origin !== targetUrl.origin) {
      return location;
    }
    const proxy = new URL(proxyUrl.origin);
    const normalizedBase = normalizeBasePath(targetUrl.pathname);
    const withoutBase = stripBasePath(parsed.pathname, normalizedBase);
    proxy.pathname = withoutBase;
    proxy.search = parsed.search;
    proxy.hash = parsed.hash;
    return proxy.toString();
  } catch {
    return location;
  }
}

function normalizeBasePath(pathname: string): string {
  if (!pathname || pathname === '/') return '';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function stripBasePath(pathname: string, basePath: string): string {
  if (!basePath) return pathname;
  if (pathname.startsWith(basePath)) {
    const stripped = pathname.slice(basePath.length);
    return stripped.startsWith('/') ? stripped : `/${stripped}`;
  }
  return pathname;
}

function cloneHeaders(source: Headers): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    headers.set(key, value);
  });
  return headers;
}
