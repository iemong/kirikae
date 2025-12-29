import { resolve, join } from 'node:path';

const DEFAULT_PROXY_PORT = 3200;
const DEFAULT_DATA_DIR = '.proxy-data';
const DATA_FILE_NAME = 'targets.json';

export function getProxyPort(): number {
  const raw = Bun.env.PROXY_PORT;
  if (!raw) return DEFAULT_PROXY_PORT;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_PROXY_PORT;
}

export function getDataDir(): string {
  const override = Bun.env.PROXY_DATA_DIR?.trim();
  if (override && override.length > 0) {
    return resolve(override);
  }
  return resolve(DEFAULT_DATA_DIR);
}

export function getDataFilePath(): string {
  return join(getDataDir(), DATA_FILE_NAME);
}
