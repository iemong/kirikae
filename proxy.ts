#!/usr/bin/env bun
import { Hono } from 'hono';
import { buildAdminRouter } from './src/admin';
import { getAdminPort, getDataFilePath, getProxyPort } from './src/config';
import { proxyRequest } from './src/proxy-handler';
import { EnvironmentStore } from './src/environment-store';
import { handleWebSocketProxy, websocketBridgeHandler } from './src/websocket-proxy';
import { handleDenoWebSocketProxy } from './src/websocket-proxy-deno';

const dataFilePath = getDataFilePath();
const store = new EnvironmentStore(dataFilePath);
await store.init();

const proxyApp: Hono = new Hono();
const adminApp = buildAdminRouter(store, { dataFilePath });
proxyApp.all('*', (c) => proxyRequest(c, store));

if (import.meta.main) {
  const port = getProxyPort();
  const adminPort = getAdminPort();
  const bun = (globalThis as { Bun?: { serve: (options: any) => void } }).Bun;
  const deno = (globalThis as { Deno?: { serve: (options: any, handler?: (req: Request) => Response | Promise<Response>) => void } }).Deno;

  if (bun) {
    bun.serve({
      port,
      fetch: (req: Request, server: any) => {
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

    bun.serve({
      port: adminPort,
      fetch: adminApp.fetch,
      error(error) {
        console.error('[admin] unexpected error', error);
        return new Response('Internal Server Error', { status: 500 });
      },
    });
  } else if (deno?.serve) {
    deno.serve({ port }, (req: Request) => {
      try {
        const upgradeHeader = req.headers.get('upgrade')?.toLowerCase();
        if (upgradeHeader === 'websocket') {
          return handleDenoWebSocketProxy(req, store);
        }
        return proxyApp.fetch(req);
      } catch (error) {
        console.error('[proxy] unexpected error', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    });

    deno.serve({ port: adminPort }, (req: Request) => {
      try {
        return adminApp.fetch(req);
      } catch (error) {
        console.error('[admin] unexpected error', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    });
  } else {
    throw new Error('Unsupported runtime: expected Bun or Deno.');
  }

  console.log(`[proxy] listening on http://localhost:${port}`);
  console.log(`[admin] UI/API available at http://localhost:${adminPort}/`);
}

export { proxyApp };
