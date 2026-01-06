import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { getProxyPort, getAdminPort, getDataDir, getDataFilePath } from '../src/config';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const testHome = resolve(process.cwd(), '.test-home');
const originalHome = process.env.HOME;
const originalBunHome = Bun.env.HOME;

beforeEach(() => {
  if (existsSync(testHome)) {
    rmSync(testHome, { recursive: true, force: true });
  }
  mkdirSync(testHome, { recursive: true });
  process.env.HOME = testHome;
  Bun.env.HOME = testHome;
});

afterEach(() => {
  if (originalHome !== undefined) {
    process.env.HOME = originalHome;
  } else {
    delete process.env.HOME;
  }
  if (originalBunHome !== undefined) {
    Bun.env.HOME = originalBunHome;
  } else {
    delete Bun.env.HOME;
  }
  if (existsSync(testHome)) {
    rmSync(testHome, { recursive: true, force: true });
  }
});

describe('getProxyPort', () => {
  const originalEnv = Bun.env.PROXY_PORT;

  afterEach(() => {
    if (originalEnv !== undefined) {
      Bun.env.PROXY_PORT = originalEnv;
    } else {
      delete Bun.env.PROXY_PORT;
    }
  });

  it('returns default port when env var is not set', () => {
    delete Bun.env.PROXY_PORT;
    expect(getProxyPort()).toBe(3200);
  });

  it('returns parsed port when env var is valid', () => {
    Bun.env.PROXY_PORT = '8080';
    expect(getProxyPort()).toBe(8080);
  });

  it('returns default port when env var is invalid', () => {
    Bun.env.PROXY_PORT = 'invalid';
    expect(getProxyPort()).toBe(3200);
  });
});

describe('getAdminPort', () => {
  const originalEnv = Bun.env.PROXY_ADMIN_PORT;

  afterEach(() => {
    if (originalEnv !== undefined) {
      Bun.env.PROXY_ADMIN_PORT = originalEnv;
    } else {
      delete Bun.env.PROXY_ADMIN_PORT;
    }
  });

  it('returns default port when env var is not set', () => {
    delete Bun.env.PROXY_ADMIN_PORT;
    expect(getAdminPort()).toBe(4000);
  });

  it('returns parsed port when env var is valid', () => {
    Bun.env.PROXY_ADMIN_PORT = '9090';
    expect(getAdminPort()).toBe(9090);
  });

  it('returns default port when env var is invalid', () => {
    Bun.env.PROXY_ADMIN_PORT = 'invalid';
    expect(getAdminPort()).toBe(4000);
  });
});

describe('getDataDir', () => {
  const originalEnv = Bun.env.PROXY_DATA_DIR;

  afterEach(() => {
    if (originalEnv !== undefined) {
      Bun.env.PROXY_DATA_DIR = originalEnv;
    } else {
      delete Bun.env.PROXY_DATA_DIR;
    }
  });

  it('returns home directory default when no override', () => {
    delete Bun.env.PROXY_DATA_DIR;
    expect(getDataDir()).toBe(resolve(testHome, '.kirikae'));
  });

  it('returns override directory when env var is set', () => {
    Bun.env.PROXY_DATA_DIR = '/custom/path';
    expect(getDataDir()).toBe(resolve('/custom/path'));
  });

  it('ignores empty override', () => {
    Bun.env.PROXY_DATA_DIR = '  ';
    expect(getDataDir()).toBe(resolve(testHome, '.kirikae'));
  });
});

describe('getDataFilePath', () => {
  const originalEnv = Bun.env.PROXY_DATA_DIR;
  const testDir = resolve(process.cwd(), '.test-data');
  const homeDataDir = resolve(testHome, '.kirikae');
  const legacyDataDir = resolve('.proxy-data');

  beforeEach(() => {
    // Clean up test directories
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    if (existsSync(legacyDataDir)) {
      rmSync(legacyDataDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      Bun.env.PROXY_DATA_DIR = originalEnv;
    } else {
      delete Bun.env.PROXY_DATA_DIR;
    }
    // Clean up
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    if (existsSync(legacyDataDir)) {
      rmSync(legacyDataDir, { recursive: true, force: true });
    }
  });

  it('returns primary file path when no legacy files exist', () => {
    delete Bun.env.PROXY_DATA_DIR;
    expect(getDataFilePath()).toBe(join(homeDataDir, 'environments.json'));
  });

  it('returns legacy file path when only legacy file exists in data dir', () => {
    Bun.env.PROXY_DATA_DIR = testDir;
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'targets.json'), '{}');
    expect(getDataFilePath()).toBe(join(testDir, 'targets.json'));
  });

  it('returns primary file path when both exist in data dir', () => {
    Bun.env.PROXY_DATA_DIR = testDir;
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'targets.json'), '{}');
    writeFileSync(join(testDir, 'environments.json'), '{}');
    expect(getDataFilePath()).toBe(join(testDir, 'environments.json'));
  });

  it('returns legacy default dir legacy file when exists and no primary', () => {
    delete Bun.env.PROXY_DATA_DIR;
    mkdirSync(legacyDataDir, { recursive: true });
    writeFileSync(join(legacyDataDir, 'targets.json'), '{}');
    expect(getDataFilePath()).toBe(join(legacyDataDir, 'targets.json'));
  });

  it('returns legacy default dir primary file when exists and no home primary', () => {
    delete Bun.env.PROXY_DATA_DIR;
    mkdirSync(legacyDataDir, { recursive: true });
    writeFileSync(join(legacyDataDir, 'environments.json'), '{}');
    expect(getDataFilePath()).toBe(join(legacyDataDir, 'environments.json'));
  });
});
