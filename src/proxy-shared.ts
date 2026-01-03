import type { EnvironmentStore } from './environment-store';
import { combinePaths } from './utils';

const hopByHopWebSocketHeaders = new Set([
  'connection',
  'upgrade',
  'sec-websocket-key',
  'sec-websocket-version',
  'sec-websocket-extensions',
]);

export function getActiveEnvironmentBase(store: EnvironmentStore): URL | null {
  const selection = store.getActiveSelection();
  return selection.url ? new URL(selection.url) : null;
}

export function buildUpstreamHttpUrl(base: URL, incoming: URL): string {
  return buildUpstreamUrl(base, incoming, { includeHash: true });
}

export function buildUpstreamWebSocketUrl(base: URL, incoming: URL): string {
  const protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  return buildUpstreamUrl(base, incoming, { protocol, includeHash: false });
}

export function buildHttpForwardHeaders(
  requestHeaders: Headers,
  incomingUrl: URL,
  environmentBase: URL,
): Headers {
  const headers = cloneHeaders(requestHeaders);
  headers.set('host', environmentBase.host);
  headers.set('x-forwarded-host', incomingUrl.host);
  headers.set('x-forwarded-proto', incomingUrl.protocol.replace(':', ''));
  const forwardedFor = requestHeaders.get('x-forwarded-for');
  headers.set('x-forwarded-for', forwardedFor ?? '127.0.0.1');
  return headers;
}

export function buildWebSocketForwardHeaders(headers: Headers, environmentBase: URL): Record<string, string> {
  const forwarded: Record<string, string> = {
    host: environmentBase.host,
  };
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (hopByHopWebSocketHeaders.has(lower)) {
      return;
    }
    forwarded[lower] = value;
  });
  if (!forwarded.origin) {
    forwarded.origin = `${environmentBase.protocol}//${environmentBase.host}`;
  }
  return forwarded;
}

function buildUpstreamUrl(
  base: URL,
  incoming: URL,
  options: { protocol?: string; includeHash: boolean },
): string {
  const url = new URL(base.toString());
  if (options.protocol) {
    url.protocol = options.protocol;
  }
  url.pathname = combinePaths(url.pathname, incoming.pathname);
  url.search = incoming.search;
  url.hash = options.includeHash ? incoming.hash : '';
  return url.toString();
}

function cloneHeaders(source: Headers): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    headers.set(key, value);
  });
  return headers;
}
