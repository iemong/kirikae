import { Hono } from 'hono';
import type { Context } from 'hono';
import type { TargetRecord, TargetStore } from './store';
import { ADMIN_BASE_PATH, escapeHtml, prefersHtml, readBody, redirectToAdmin, valueToString } from './utils';

interface AdminOptions {
  dataFilePath: string;
}

export function buildAdminRouter(store: TargetStore, options: AdminOptions): Hono {
  const admin = new Hono();

  admin.get('/', (c) => {
    const selection = store.getActiveSelection();
    const targets = store.getTargets();
    const error = c.req.query('error');
    const notice = c.req.query('notice');
    const html = renderAdminPage({
      selection,
      targets,
      dataFilePath: options.dataFilePath,
      notice: notice ?? null,
      error: error ?? null,
    });
    return c.html(html);
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
        const target = await store.setActiveTargetById(id);
        console.log(`[proxy] active target switched to ${target.url} (${target.label})`);
      } else if (url) {
        const sanitized = normalizeTargetUrl(url);
        await store.setActiveTargetUrl(sanitized);
        console.log(`[proxy] active target switched to ${sanitized}`);
      } else {
        return respondError(c, preferHtml, 'Please provide an environment URL or environment ID.');
      }
    } catch (error) {
      return respondError(c, preferHtml, error instanceof Error ? error.message : 'Failed to switch environment.');
    }

    return respondSuccess(c, preferHtml, { target: store.getActiveSelection().url }, 'Environment switched.');
  });

  admin.get('/targets', (c) => {
    return c.json({ targets: store.getTargets() });
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
      const record = await store.addTarget({ label, url: normalizeTargetUrl(url) });
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
      const record = await store.updateTarget(id, { label, url: normalizeTargetUrl(url) });
      return respondSuccess(c, preferHtml, { target: record }, 'Environment updated.');
    } catch (error) {
      return respondError(c, preferHtml, error instanceof Error ? error.message : 'Failed to update environment.');
    }
  });

  admin.delete('/targets/:id', async (c) => {
    const preferHtml = prefersHtml(c);
    const id = c.req.param('id');
    try {
      await store.deleteTarget(id);
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
      await store.updateTarget(id, { label, url: normalizeTargetUrl(url) });
      return redirectToAdmin(c, { notice: 'Environment updated.' });
    } catch (error) {
      return redirectToAdmin(c, { error: error instanceof Error ? error.message : 'Failed to update.' });
    }
  });

  admin.post('/targets/:id/delete', async (c) => {
    const id = c.req.param('id');
    try {
      await store.deleteTarget(id);
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

function normalizeTargetUrl(url: string): string {
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
  selection: ReturnType<TargetStore['getActiveSelection']>;
  targets: TargetRecord[];
  dataFilePath: string;
  notice: string | null;
  error: string | null;
}

function renderAdminPage(state: PageState): string {
  const active = state.selection.url;
  const activeLabel = state.selection.targetId
    ? state.targets.find((target) => target.id === state.selection.targetId)?.label ?? null
    : null;
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>KIRIKAE</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 24px; background: #101418; color: #f4f6fb; }
      h1 { font-size: 1.5rem; margin-bottom: 16px; }
      .layout { display: grid; gap: 24px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); margin-top: 24px; }
      section { background: #18202a; border-radius: 12px; padding: 20px; box-shadow: 0 4px 24px rgba(0,0,0,0.25); }
      label { display: block; font-size: 0.85rem; color: #9fb3c8; margin-bottom: 4px; }
      input[type="text"], input[type="url"] { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid #2a3948; background: #0f141b; color: #f4f6fb; margin-bottom: 12px; }
      button { padding: 8px 16px; border: none; border-radius: 999px; background: #3b82f6; color: #fff; font-weight: 600; cursor: pointer; font-size: 0.9rem; }
      button.secondary { background: #2a3948; }
      button.danger { background: #ef4444; }
      code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; }
      ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 16px; }
      .target-card { border: 1px solid #233040; border-radius: 12px; padding: 16px; background: #121922; }
      .target-card.active { border-color: #3b82f6; }
      .target-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
      .target-label { font-size: 1rem; font-weight: 600; }
      .target-url { font-size: 0.9rem; color: #97a6ba; word-break: break-all; }
      .forms { display: flex; flex-direction: column; gap: 8px; }
      .forms form { display: flex; flex-direction: column; gap: 4px; }
      .forms .button-row { display: flex; gap: 8px; }
      .card-actions { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
      .card-actions form { margin: 0; }
      .action-save { margin-left: auto; }
      .status { margin-bottom: 8px; }
      .muted { color: #7c8ca3; }
      .notice { padding: 10px 14px; margin-bottom: 16px; border-radius: 8px; }
      .notice.success { background: rgba(34,197,94,0.15); color: #86efac; border: 1px solid rgba(34,197,94,0.3); }
      .notice.error { background: rgba(248,113,113,0.15); color: #fecaca; border: 1px solid rgba(248,113,113,0.3); }
      small { color: #6e7e92; }
      .stack { display: flex; flex-direction: column; gap: 12px; }
      a { color: #7dd3fc; }
      .button-link { display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 999px; background: #2a3948; color: #fff; font-weight: 600; text-decoration: none; font-size: 0.9rem; border: 1px solid transparent; }
      .button-link.secondary-blue { background: transparent; border-color: #3b82f6; color: #93c5fd; }
      .button-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    </style>
  </head>
  <body>
    <h1>KIRIKAE</h1>
    ${state.notice ? `<div class="notice success">${escapeHtml(state.notice)}</div>` : ''}
    ${state.error ? `<div class="notice error">${escapeHtml(state.error)}</div>` : ''}
    <section>
      <h2 class="status">Current Environment</h2>
      ${active ? `<p><code>${escapeHtml(active)}</code></p>` : '<p class="muted">Not set</p>'}
      ${activeLabel ? `<p class="muted">Name: ${escapeHtml(activeLabel)}</p>` : ''}
      ${active ? `<div class="button-row" style="margin-top:12px;">
        <a class="button-link" href="${escapeHtml(active)}" target="_blank" rel="noopener noreferrer">Open Environment</a>
      </div>` : ''}
    </section>
    <div class="layout">
      <section>
        <h2>Add Environment</h2>
        <form method="post" action="${ADMIN_BASE_PATH}/targets" class="stack">
          <div>
            <label for="label-input">Name</label>
            <input id="label-input" type="text" name="label" placeholder="feature/login" required />
          </div>
          <div>
            <label for="url-input">URL <span class="muted">required</span></label>
            <input id="url-input" type="url" name="url" placeholder="http://localhost:4002" required />
          </div>
          <button type="submit">Add</button>
        </form>
      </section>
      <section>
        <h2>Saved Environments</h2>
        ${state.targets.length === 0 ? '<p class="muted">No environments yet</p>' : `<ul>${state.targets
          .map((target) => renderTargetCard(target, state.selection))
          .join('')}</ul>`}
      </section>
    </div>
    <p class="muted" style="margin-top:24px;">Data file: <code>${escapeHtml(state.dataFilePath)}</code></p>
  </body>
</html>`;
}

function renderTargetCard(target: TargetRecord, selection: ReturnType<TargetStore['getActiveSelection']>): string {
  const isActive = selection.targetId === target.id;
  const updateFormId = `update-${target.id}`;
  return `<li class="target-card${isActive ? ' active' : ''}">
    <div class="target-head">
      <div>
        <div class="target-label">${escapeHtml(target.label)}</div>
        <div class="target-url">${escapeHtml(target.url)}</div>
        <small>Updated: ${escapeHtml(formatTimestamp(target.updatedAt))}</small>
      </div>
      <form method="post" action="${ADMIN_BASE_PATH}/switch">
        <input type="hidden" name="targetId" value="${escapeHtml(target.id)}" />
        <button type="submit" class="secondary">Activate</button>
      </form>
    </div>
    <div class="forms">
      <form id="${escapeHtml(updateFormId)}" method="post" action="${ADMIN_BASE_PATH}/targets/${escapeHtml(target.id)}/update">
        <label>Name<input type="text" name="label" value="${escapeHtml(target.label)}" required /></label>
        <label>URL<input type="url" name="url" value="${escapeHtml(target.url)}" required /></label>
      </form>
      <div class="card-actions">
        <form method="post" action="${ADMIN_BASE_PATH}/targets/${escapeHtml(target.id)}/delete" onsubmit="return confirm('Delete this environment?');">
          <button type="submit" class="danger">Delete</button>
        </form>
        <button type="submit" class="action-save" form="${escapeHtml(updateFormId)}">Save</button>
        <a class="button-link secondary-blue" href="${escapeHtml(target.url)}" target="_blank" rel="noopener noreferrer">Open</a>
      </div>
    </div>
  </li>`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}
