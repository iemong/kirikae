import type { Context } from 'hono';
import type { EnvironmentStore } from './environment-store';
import { combinePaths } from './utils';

export async function proxyRequest(c: Context, store: EnvironmentStore): Promise<Response> {
  const selection = store.getActiveSelection();
  if (!selection.url) {
    return c.text('エンバイロメントが未設定です /__/ にアクセスして設定してください', 503);
  }

  const incomingUrl = new URL(c.req.url);
  const environmentBase = new URL(selection.url);
  const upstreamUrl = buildUpstreamUrl(environmentBase, incomingUrl);

  const headers = cloneHeaders(c.req.raw.headers);
  headers.set('host', environmentBase.host);
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
    return rewriteResponse(upstreamResponse, incomingUrl, environmentBase);
  } catch (error) {
    console.error('[proxy] upstream fetch failed', error);
    return c.text('アップストリームへの接続に失敗しました', 502);
  }
}

function buildUpstreamUrl(environment: URL, incoming: URL): string {
  const url = new URL(environment.toString());
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

function rewriteResponse(response: Response, proxyUrl: URL, environmentUrl: URL): Response {
  const location = response.headers.get('location');
  if (!location) {
    return response;
  }
  const rewritten = rewriteLocation(location, proxyUrl, environmentUrl);
  if (!rewritten) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set('location', rewritten);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function rewriteLocation(location: string, proxyUrl: URL, environmentUrl: URL): string | null {
  try {
    const parsed = new URL(location, environmentUrl);
    if (parsed.origin !== environmentUrl.origin) {
      return location;
    }
    const proxy = new URL(proxyUrl.origin);
    const normalizedBase = normalizeBasePath(environmentUrl.pathname);
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
