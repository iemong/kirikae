import type { EnvironmentStore } from './environment-store';
import { buildUpstreamWebSocketUrl, buildWebSocketForwardHeaders, getActiveEnvironmentBase } from './proxy-shared';

type DenoLike = {
  upgradeWebSocket?: (req: Request) => { socket: WebSocket; response: Response };
  connectWebSocket?: (
    url: string | URL,
    options?: { headers?: HeadersInit; protocol?: string | string[] },
  ) => { socket: WebSocket };
};

function getDeno(): DenoLike | undefined {
  return (globalThis as { Deno?: DenoLike }).Deno;
}

function connectUpstreamWebSocket(url: string, headers: Record<string, string>): WebSocket {
  const deno = getDeno();
  if (deno?.connectWebSocket) {
    const { socket } = deno.connectWebSocket(url, { headers });
    return socket;
  }

  if (Object.keys(headers).length > 0) {
    console.warn('[proxy][ws] Deno WebSocket does not support custom headers; upstream headers skipped.');
  }
  return new WebSocket(url);
}

export function handleDenoWebSocketProxy(req: Request, store: EnvironmentStore): Response {
  const deno = getDeno();
  if (!deno?.upgradeWebSocket) {
    return new Response('WebSocket upgrade is not supported in this runtime.', { status: 500 });
  }

  const environmentBase = getActiveEnvironmentBase(store);
  if (!environmentBase) {
    return new Response('No environment selected. Visit /__/ to configure.', { status: 503 });
  }

  const incomingUrl = new URL(req.url);
  const upstreamUrl = buildUpstreamWebSocketUrl(environmentBase, incomingUrl);
  const headers = buildWebSocketForwardHeaders(req.headers, environmentBase);

  const { socket: clientSocket, response } = deno.upgradeWebSocket(req);
  const upstream = connectUpstreamWebSocket(upstreamUrl, headers);
  clientSocket.binaryType = 'arraybuffer';
  upstream.binaryType = 'arraybuffer';

  clientSocket.addEventListener('message', (event) => {
    if (upstream.readyState !== WebSocket.OPEN) return;
    try {
      upstream.send(event.data);
    } catch (error) {
      console.error('[proxy][ws] send to upstream failed', error);
      clientSocket.close(1011, 'proxy error');
    }
  });

  upstream.addEventListener('message', (event) => {
    if (clientSocket.readyState !== WebSocket.OPEN) return;
    try {
      clientSocket.send(event.data);
    } catch (error) {
      console.error('[proxy][ws] send to client failed', error);
      clientSocket.close(1011, 'proxy error');
    }
  });

  clientSocket.addEventListener('close', (event) => {
    if (upstream.readyState <= WebSocket.CLOSING) {
      try {
        upstream.close(event.code, event.reason);
      } catch (error) {
        console.error('[proxy][ws] upstream close failed', error);
      }
    }
  });

  upstream.addEventListener('close', (event) => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close(event.code ?? 1000, event.reason || 'upstream closed');
    }
  });

  clientSocket.addEventListener('error', () => {
    try {
      upstream.close(1011, 'proxy error');
    } catch (error) {
      console.error('[proxy][ws] upstream close on error failed', error);
    }
  });

  upstream.addEventListener('error', (event) => {
    console.error('[proxy][ws] upstream error', event);
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close(1011, 'upstream error');
    }
  });

  return response;
}
