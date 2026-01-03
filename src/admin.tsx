import { Hono } from 'hono';
import type { Context } from 'hono';
import type { EnvironmentRecord, EnvironmentStore } from './environment-store';
import { ADMIN_STYLES } from './admin-styles';
import { ADMIN_BASE_PATH, prefersHtml, readBody, redirectToAdmin, valueToString } from './utils';

interface AdminOptions {
  dataFilePath: string;
}

export function buildAdminRouter(store: EnvironmentStore, options: AdminOptions): Hono {
  const admin = new Hono();

  admin.get('/', (c) => {
    const selection = store.getActiveSelection();
    const environments = store.getEnvironments();
    const error = c.req.query('error');
    const notice = c.req.query('notice');
    const pageState = {
      selection,
      environments,
      dataFilePath: options.dataFilePath,
      notice: notice ?? null,
      error: error ?? null,
    };
    return c.html(<AdminPage {...pageState} />);
  });

  admin.get('/status', (c) => {
    const selection = store.getActiveSelection();
    return c.json({ target: selection.url });
  });

  admin.post('/switch', async (c) => {
    const preferHtml = prefersHtml(c);
    const body = await readBody(c);
    const id = valueToString(body.targetId ?? body.id);
    const url = valueToString(body.target ?? body.url);

    try {
      if (id) {
        const environment = await store.setActiveEnvironmentById(id);
        console.log(`[proxy] active environment switched to ${environment.url} (${environment.label})`);
      } else if (url) {
        const sanitized = normalizeEnvironmentUrl(url);
        await store.setActiveEnvironmentUrl(sanitized);
        console.log(`[proxy] active environment switched to ${sanitized}`);
      } else {
        return respondError(c, preferHtml, 'Please provide an environment URL or environment ID.');
      }
    } catch (error) {
      return respondError(c, preferHtml, error instanceof Error ? error.message : 'Failed to switch environment.');
    }

    return respondSuccess(c, preferHtml, { target: store.getActiveSelection().url }, 'Environment switched.');
  });

  admin.get('/targets', (c) => {
    const environments = store.getEnvironments();
    return c.json({ targets: environments, environments });
  });

  admin.post('/targets', async (c) => {
    const preferHtml = prefersHtml(c);
    const body = await readBody(c);
    const label = valueToString(body.label);
    const url = valueToString(body.url);

    if (!label || !url) {
      return respondError(c, preferHtml, 'Name and URL are required.');
    }

    try {
      const record = await store.addEnvironment({ label, url: normalizeEnvironmentUrl(url) });
      return respondSuccess(c, preferHtml, { target: record }, 'Environment added.');
    } catch (error) {
      return respondError(c, preferHtml, error instanceof Error ? error.message : 'Failed to add environment.');
    }
  });

  admin.put('/targets/:id', async (c) => {
    const preferHtml = prefersHtml(c);
    const id = c.req.param('id');
    const body = await readBody(c);
    const label = valueToString(body.label);
    const url = valueToString(body.url);

    if (!label || !url) {
      return respondError(c, preferHtml, 'Name and URL are required.');
    }

    try {
      const record = await store.updateEnvironment(id, { label, url: normalizeEnvironmentUrl(url) });
      return respondSuccess(c, preferHtml, { target: record }, 'Environment updated.');
    } catch (error) {
      return respondError(c, preferHtml, error instanceof Error ? error.message : 'Failed to update environment.');
    }
  });

  admin.delete('/targets/:id', async (c) => {
    const preferHtml = prefersHtml(c);
    const id = c.req.param('id');
    try {
      await store.deleteEnvironment(id);
      return respondSuccess(c, preferHtml, { ok: true }, 'Environment deleted.');
    } catch (error) {
      return respondError(c, preferHtml, error instanceof Error ? error.message : 'Failed to delete environment.');
    }
  });

  admin.post('/targets/:id/update', async (c) => {
    const id = c.req.param('id');
    const body = await readBody(c);
    const label = valueToString(body.label);
    const url = valueToString(body.url);
    if (!label || !url) {
      return redirectToAdmin(c, { error: 'Name and URL are required.' });
    }
    try {
      await store.updateEnvironment(id, { label, url: normalizeEnvironmentUrl(url) });
      return redirectToAdmin(c, { notice: 'Environment updated.' });
    } catch (error) {
      return redirectToAdmin(c, { error: error instanceof Error ? error.message : 'Failed to update.' });
    }
  });

  admin.post('/targets/:id/delete', async (c) => {
    const id = c.req.param('id');
    try {
      await store.deleteEnvironment(id);
      return redirectToAdmin(c, { notice: 'Environment deleted.' });
    } catch (error) {
      return redirectToAdmin(c, { error: error instanceof Error ? error.message : 'Failed to delete.' });
    }
  });

  return admin;
}

function respondSuccess(c: Context, preferHtml: boolean, payload: Record<string, unknown>, notice?: string): Response {
  if (preferHtml) {
    return redirectToAdmin(c, notice ? { notice } : {});
  }
  return c.json(payload);
}

function respondError(c: Context, preferHtml: boolean, message: string, status = 400): Response {
  c.status(status);
  if (preferHtml) {
    return redirectToAdmin(c, { error: message });
  }
  return c.json({ error: message });
}

function normalizeEnvironmentUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('URL is required.');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https are supported.');
  }
  if (parsed.pathname === '/' && !parsed.search && !parsed.hash) {
    return parsed.origin;
  }
  return parsed.toString();
}

interface PageState {
  selection: ReturnType<EnvironmentStore['getActiveSelection']>;
  environments: EnvironmentRecord[];
  dataFilePath: string;
  notice: string | null;
  error: string | null;
}

function AdminPage(state: PageState) {
  const active = state.selection.url;
  const activeLabel = state.selection.environmentId
    ? state.environments.find((environment) => environment.id === state.selection.environmentId)?.label ?? null
    : null;
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>KIRIKAE</title>
        <style>{ADMIN_STYLES}</style>
      </head>
      <body>
        <h1>KIRIKAE</h1>
        <NoticeBanner notice={state.notice} error={state.error} />
        <CurrentEnvironmentSection activeUrl={active} activeLabel={activeLabel} />
        <div class="layout">
          <AddEnvironmentSection />
          <SavedEnvironmentsSection
            environments={state.environments}
            selection={state.selection}
          />
        </div>
        <DataFileFooter path={state.dataFilePath} />
        <ConfirmScript />
      </body>
    </html>
  );
}

function NoticeBanner({ notice, error }: { notice: string | null; error: string | null }) {
  return (
    <>
      {notice ? <div class="notice success">{notice}</div> : null}
      {error ? <div class="notice error">{error}</div> : null}
    </>
  );
}

function CurrentEnvironmentSection({
  activeUrl,
  activeLabel,
}: {
  activeUrl: string | null;
  activeLabel: string | null;
}) {
  return (
    <section>
      <h2 class="status">Current Environment</h2>
      {activeUrl ? (
        <p>
          <code>{activeUrl}</code>
        </p>
      ) : (
        <p class="muted">Not set</p>
      )}
      {activeLabel ? <p class="muted">Name: {activeLabel}</p> : null}
      {activeUrl ? (
        <div class="button-row" style="margin-top:12px;">
          <a class="button-link" href={activeUrl} target="_blank" rel="noopener noreferrer">
            Open Environment
          </a>
        </div>
      ) : null}
    </section>
  );
}

function AddEnvironmentSection() {
  return (
    <section>
      <h2>Add Environment</h2>
      <form method="post" action={`${ADMIN_BASE_PATH}/targets`} class="stack">
        <div>
          <label for="label-input">Name</label>
          <input id="label-input" type="text" name="label" placeholder="feature/login" required />
        </div>
        <div>
          <label for="url-input">
            URL <span class="muted">required</span>
          </label>
          <input id="url-input" type="url" name="url" placeholder="http://localhost:4002" required />
        </div>
        <button type="submit">Add</button>
      </form>
    </section>
  );
}

function SavedEnvironmentsSection({
  environments,
  selection,
}: {
  environments: EnvironmentRecord[];
  selection: ReturnType<EnvironmentStore['getActiveSelection']>;
}) {
  return (
    <section>
      <h2>Saved Environments</h2>
      {environments.length === 0 ? (
        <p class="muted">No environments yet</p>
      ) : (
        <ul>
          {environments.map((environment) => (
            <EnvironmentCard environment={environment} selection={selection} key={environment.id} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DataFileFooter({ path }: { path: string }) {
  return (
    <p class="muted" style="margin-top:24px;">
      Data file: <code>{path}</code>
    </p>
  );
}

function ConfirmScript() {
  return (
    <script>
      {`document.addEventListener('submit', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) return;
  const message = target.getAttribute('data-confirm');
  if (message && !confirm(message)) {
    event.preventDefault();
  }
});`}
    </script>
  );
}

function EnvironmentCard({
  environment,
  selection,
}: {
  environment: EnvironmentRecord;
  selection: ReturnType<EnvironmentStore['getActiveSelection']>;
}) {
  const isActive = selection.environmentId === environment.id;
  const updateFormId = `update-${environment.id}`;
  return (
    <li class={`environment-card${isActive ? ' active' : ''}`}>
      <div class="environment-head">
        <div>
          <div class="environment-label">{environment.label}</div>
          <div class="environment-url">{environment.url}</div>
          <small>Updated: {formatTimestamp(environment.updatedAt)}</small>
        </div>
        <form method="post" action={`${ADMIN_BASE_PATH}/switch`}>
          <input type="hidden" name="targetId" value={environment.id} />
          <button type="submit" class="secondary">
            Activate
          </button>
        </form>
      </div>
      <div class="forms">
        <form id={updateFormId} method="post" action={`${ADMIN_BASE_PATH}/targets/${environment.id}/update`}>
          <label>
            Name<input type="text" name="label" value={environment.label} required />
          </label>
          <label>
            URL<input type="url" name="url" value={environment.url} required />
          </label>
        </form>
        <div class="card-actions">
          <form
            method="post"
            action={`${ADMIN_BASE_PATH}/targets/${environment.id}/delete`}
            data-confirm="Delete this environment?"
          >
            <button type="submit" class="danger">
              Delete
            </button>
          </form>
          <button type="submit" class="action-save" form={updateFormId}>
            Save
          </button>
          <a class="button-link secondary-blue" href={environment.url} target="_blank" rel="noopener noreferrer">
            Open
          </a>
        </div>
      </div>
    </li>
  );
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}
