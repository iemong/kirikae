import { Hono } from 'hono';
import { buildAdminRouter } from './src/admin';
import { getDataFilePath, getProxyPort } from './src/config';
import { proxyRequest } from './src/proxy-handler';
import { TargetStore } from './src/store';
import { ADMIN_BASE_PATH } from './src/utils';

const dataFilePath = getDataFilePath();
const store = new TargetStore(dataFilePath);
await store.init();

const app = new Hono();
const adminApp = buildAdminRouter(store, { dataFilePath });
app.route(ADMIN_BASE_PATH, adminApp);
app.all('*', (c) => proxyRequest(c, store));

if (import.meta.main) {
  const port = getProxyPort();
  Bun.serve({
    port,
    fetch: app.fetch,
    error(error) {
      console.error('[proxy] unexpected error', error);
      return new Response('Internal Server Error', { status: 500 });
    },
  });
  console.log(`[proxy] listening on http://localhost:${port}`);
  console.log(`[proxy] 管理画面: http://localhost:${port}${ADMIN_BASE_PATH}/`);
}

export { app };
