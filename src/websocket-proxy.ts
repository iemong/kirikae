import type { Server, ServerWebSocket, WebSocketHandler } from 'bun';
import { combinePaths } from './utils';
import type { EnvironmentStore } from './environment-store';

interface ProxyWebSocketData {
  upstreamUrl: string;
  headers: Record<string, string>;
  upstream?: WebSocket;
}

const hopByHopWebSocketHeaders = new Set([
  'connection',
  'upgrade',
  'sec-websocket-key',
  'sec-websocket-version',
  'sec-websocket-extensions',
]);

export function handleWebSocketProxy(
  req: Request,
  server: Server,
  store: EnvironmentStore,
): Response | null {
  const selection = store.getActiveSelection();
  if (!selection.url) {
    return new Response('エンバイロメントが未設定です /__/ で設定してください', { status: 503 });
  }

  const incomingUrl = new URL(req.url);
  const environmentBase = new URL(selection.url);
  const upstreamUrl = buildUpstreamWebSocketUrl(environmentBase, incomingUrl);
  const headers = extractForwardHeaders(req.headers, environmentBase);

  const upgraded = server.upgrade(req, {
    data: {
      upstreamUrl,
      headers,
    } satisfies ProxyWebSocketData,
  });

  if (!upgraded) {
    return new Response('WebSocket upgrade に失敗しました', { status: 500 });
  }

  return null;
}

export const websocketBridgeHandler: WebSocketHandler<ProxyWebSocketData> = {
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

function buildUpstreamWebSocketUrl(environment: URL, incoming: URL): string {
  const protocol = environment.protocol === 'https:' ? 'wss:' : 'ws:';
  const base = new URL(environment.toString());
  base.protocol = protocol;
  base.pathname = combinePaths(base.pathname, incoming.pathname);
  base.search = incoming.search;
  base.hash = '';
  return base.toString();
}

function extractForwardHeaders(headers: Headers, environment: URL): Record<string, string> {
  const forwarded: Record<string, string> = {
    host: environment.host,
  };
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (hopByHopWebSocketHeaders.has(lower)) {
      return;
    }
    forwarded[lower] = value;
  });
  if (!forwarded.origin) {
    forwarded.origin = `${environment.protocol}//${environment.host}`;
  }
  return forwarded;
}
