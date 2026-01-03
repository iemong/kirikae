export const ADMIN_STYLES = `
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
  .environment-card { border: 1px solid #233040; border-radius: 12px; padding: 16px; background: #121922; }
  .environment-card.active { border-color: #3b82f6; }
  .environment-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
  .environment-label { font-size: 1rem; font-weight: 600; }
  .environment-url { font-size: 0.9rem; color: #97a6ba; word-break: break-all; }
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
`;
