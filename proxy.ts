#!/usr/bin/env bun
import { Hono } from 'hono';
import { buildAdminRouter } from './src/admin';
import { getAdminPort, getDataFilePath, getProxyPort } from './src/config';
import { proxyRequest } from './src/proxy-handler';
import { EnvironmentStore } from './src/environment-store';
import { handleWebSocketProxy, websocketBridgeHandler } from './src/websocket-proxy';

const dataFilePath = getDataFilePath();
const store = new EnvironmentStore(dataFilePath);
await store.init();

const proxyApp: Hono = new Hono();
const adminApp = buildAdminRouter(store, { dataFilePath });
proxyApp.all('*', (c) => proxyRequest(c, store));

if (import.meta.main) {
  const port = getProxyPort();
  const adminPort = getAdminPort();

  Bun.serve({
    port,
    fetch: (req, server) => {
      const upgradeHeader = req.headers.get('upgrade')?.toLowerCase();
      if (upgradeHeader === 'websocket') {
        const response = handleWebSocketProxy(req, server, store);
        if (response) {
          return response;
        }
        return undefined as unknown as Response;
      }
      return proxyApp.fetch(req);
    },
    websocket: websocketBridgeHandler,
    error(error) {
      console.error('[proxy] unexpected error', error);
      return new Response('Internal Server Error', { status: 500 });
    },
  });

  Bun.serve({
    port: adminPort,
    fetch: adminApp.fetch,
    error(error) {
      console.error('[admin] unexpected error', error);
      return new Response('Internal Server Error', { status: 500 });
    },
  });

  console.log(`[proxy] listening on http://localhost:${port}`);
  console.log(`[admin] UI/API available at http://localhost:${adminPort}/`);
}

export { proxyApp };
