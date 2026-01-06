import type { EnvironmentStore } from './environment-store';
import { buildUpstreamWebSocketUrl, buildWebSocketForwardHeaders, getActiveEnvironmentBase } from './proxy-shared';

interface ProxyWebSocketData {
  upstreamUrl: string;
  headers: Record<string, string>;
  upstream?: WebSocket;
}

type BunServer = {
  upgrade: (req: Request, options: { data: ProxyWebSocketData }) => boolean;
};

type BunWebSocket = {
  data: ProxyWebSocketData;
  readyState: number;
  OPEN: number;
  CLOSING: number;
  send: (data: unknown) => void;
  close: (code?: number, reason?: string) => void;
};

type BunWebSocketHandler = {
  open?: (ws: BunWebSocket) => void;
  message?: (ws: BunWebSocket, message: unknown) => void;
  close?: (ws: BunWebSocket, code?: number, reason?: string) => void;
  error?: (ws: BunWebSocket) => void;
};

export function handleWebSocketProxy(
  req: Request,
  server: BunServer,
  store: EnvironmentStore,
): Response | null {
  const environmentBase = getActiveEnvironmentBase(store);
  if (!environmentBase) {
    return new Response('No environment selected. Visit /__/ to configure.', { status: 503 });
  }

  const incomingUrl = new URL(req.url);
  const upstreamUrl = buildUpstreamWebSocketUrl(environmentBase, incomingUrl);
  const headers = buildWebSocketForwardHeaders(req.headers, environmentBase);

  const upgraded = server.upgrade(req, {
    data: {
      upstreamUrl,
      headers,
    } satisfies ProxyWebSocketData,
  });

  if (!upgraded) {
    return new Response('WebSocket upgrade failed.', { status: 500 });
  }

  return null;
}

export const websocketBridgeHandler: BunWebSocketHandler = {
  open(ws) {
    const { upstreamUrl, headers } = ws.data;
    try {
      const upstream = new WebSocket(upstreamUrl, { headers });
      upstream.binaryType = 'arraybuffer';
      ws.data.upstream = upstream;

      upstream.addEventListener('message', (event) => {
        try {
          ws.send(event.data);
        } catch (error) {
          console.error('[proxy][ws] send to client failed', error);
          ws.close(1011, 'proxy send error');
        }
      });

      upstream.addEventListener('close', (event) => {
        if (ws.readyState === ws.OPEN) {
          ws.close(event.code ?? 1000, event.reason || 'upstream closed');
        }
      });

      upstream.addEventListener('error', (event) => {
        console.error('[proxy][ws] upstream error', event);
        if (ws.readyState === ws.OPEN) {
          ws.close(1011, 'upstream error');
        }
      });
    } catch (error) {
      console.error('[proxy][ws] upstream connect failed', error);
      ws.close(1011, 'upstream connect failed');
    }
  },
  message(ws, message) {
    const upstream = ws.data.upstream;
    if (!upstream || upstream.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      upstream.send(message);
    } catch (error) {
      console.error('[proxy][ws] send to upstream failed', error);
      ws.close(1011, 'proxy error');
    }
  },
  close(ws, code, reason) {
    if (ws.data.upstream && ws.data.upstream.readyState <= WebSocket.CLOSING) {
      try {
        ws.data.upstream.close(code, reason);
      } catch (error) {
        console.error('[proxy][ws] upstream close failed', error);
      }
    }
  },
  error(ws) {
    try {
      ws.data.upstream?.close(1011, 'proxy error');
    } catch (error) {
      console.error('[proxy][ws] upstream close on error failed', error);
    }
  },
};
