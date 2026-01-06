import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';

const DEFAULT_PROXY_PORT = 3200;
const DEFAULT_ADMIN_PORT = 4000;
const DEFAULT_DATA_DIR = '.proxy-data';
const DEFAULT_HOME_DATA_DIR = '.kirikae';
const DATA_FILE_NAME = 'environments.json';
const LEGACY_DATA_FILE_NAME = 'targets.json';
export const ADMIN_BASE_PATH = '';

function getEnvValue(key: string): string | undefined {
  const bun = (globalThis as { Bun?: { env?: Record<string, string> } }).Bun;
  const deno = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno;
  const nodeProcess = (globalThis as { process?: { env?: Record<string, string> } }).process;
  const bunValue = bun?.env?.[key];
  const denoValue = deno?.env?.get?.(key);
  const nodeValue = nodeProcess?.env?.[key];
  return bunValue ?? denoValue ?? nodeValue;
}

function getHomeDir(): string {
  return getEnvValue('HOME') ?? getEnvValue('USERPROFILE') ?? homedir();
}

export function getProxyPort(): number {
  const raw = getEnvValue('PROXY_PORT');
  if (!raw) return DEFAULT_PROXY_PORT;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_PROXY_PORT;
}

export function getAdminPort(): number {
  const raw = getEnvValue('PROXY_ADMIN_PORT');
  if (!raw) return DEFAULT_ADMIN_PORT;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_ADMIN_PORT;
}

function getDataDirOverride(): string | null {
  const override = getEnvValue('PROXY_DATA_DIR')?.trim();
  if (override && override.length > 0) {
    return resolve(override);
  }
  return null;
}

export function getDataDir(): string {
  const override = getDataDirOverride();
  if (override) {
    return override;
  }
  return resolve(getHomeDir(), DEFAULT_HOME_DATA_DIR);
}

export function getDataFilePath(): string {
  const override = getDataDirOverride();
  const dataDir = getDataDir();
  const primary = join(dataDir, DATA_FILE_NAME);
  const legacy = join(dataDir, LEGACY_DATA_FILE_NAME);
  if (existsSync(legacy) && !existsSync(primary)) {
    return legacy;
  }
  if (!override) {
    const legacyDir = resolve(DEFAULT_DATA_DIR);
    const legacyDefault = join(legacyDir, LEGACY_DATA_FILE_NAME);
    const legacyDefaultPrimary = join(legacyDir, DATA_FILE_NAME);
    if (existsSync(legacyDefault) && !existsSync(primary)) {
      return legacyDefault;
    }
    if (existsSync(legacyDefaultPrimary) && !existsSync(primary)) {
      return legacyDefaultPrimary;
    }
  }
  return primary;
}
