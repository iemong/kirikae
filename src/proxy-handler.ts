import type { Context } from 'hono';
import type { EnvironmentStore } from './environment-store';
import { buildHttpForwardHeaders, buildUpstreamHttpUrl, getActiveEnvironmentBase } from './proxy-shared';

export async function proxyRequest(c: Context, store: EnvironmentStore): Promise<Response> {
  const environmentBase = getActiveEnvironmentBase(store);
  if (!environmentBase) {
    return c.text('エンバイロメントが未設定です /__/ にアクセスして設定してください', 503);
  }

  const incomingUrl = new URL(c.req.url);
  const upstreamUrl = buildUpstreamHttpUrl(environmentBase, incomingUrl);
  const headers = buildHttpForwardHeaders(c.req.raw.headers, incomingUrl, environmentBase);

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
