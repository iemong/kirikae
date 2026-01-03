import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';

const DEFAULT_PROXY_PORT = 3200;
const DEFAULT_ADMIN_PORT = 4000;
const DEFAULT_DATA_DIR = '.proxy-data';
const DATA_FILE_NAME = 'environments.json';
const LEGACY_DATA_FILE_NAME = 'targets.json';
export const ADMIN_BASE_PATH = '';

export function getProxyPort(): number {
  const raw = Bun.env.PROXY_PORT;
  if (!raw) return DEFAULT_PROXY_PORT;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_PROXY_PORT;
}

export function getAdminPort(): number {
  const raw = Bun.env.PROXY_ADMIN_PORT;
  if (!raw) return DEFAULT_ADMIN_PORT;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_ADMIN_PORT;
}

export function getDataDir(): string {
  const override = Bun.env.PROXY_DATA_DIR?.trim();
  if (override && override.length > 0) {
    return resolve(override);
  }
  return resolve(DEFAULT_DATA_DIR);
}

export function getDataFilePath(): string {
  const dataDir = getDataDir();
  const primary = join(dataDir, DATA_FILE_NAME);
  const legacy = join(dataDir, LEGACY_DATA_FILE_NAME);
  if (existsSync(legacy) && !existsSync(primary)) {
    return legacy;
  }
  return primary;
}
