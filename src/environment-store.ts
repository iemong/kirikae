import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';

/** A persisted environment entry representing a proxy upstream target. */
export interface EnvironmentRecord {
  /** Unique identifier. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Upstream base URL (http or https). */
  url: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-update timestamp. */
  updatedAt: string;
}

interface PersistedData {
  environments: EnvironmentRecord[];
  activeEnvironmentId: string | null;
  activeEnvironmentUrl: string | null;
}

interface LegacyPersistedData {
  targets: EnvironmentRecord[];
  activeTargetId: string | null;
  activeTargetUrl: string | null;
}

/** The currently active environment selection. */
export interface ActiveEnvironmentSelection {
  /** Active upstream URL, or `null` if none is selected. */
  url: string | null;
  /** ID of the selected environment record, or `null` for ad-hoc URLs. */
  environmentId: string | null;
}

function createEmptyData(): PersistedData {
  return {
    environments: [],
    activeEnvironmentId: null,
    activeEnvironmentUrl: null,
  };
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

/** Manages environment records and persists them to a JSON file on disk. */
export class EnvironmentStore {
  private data: PersistedData = createEmptyData();
  private initPromise: Promise<void> | null = null;
  private persistQueue: Promise<void> = Promise.resolve();

  /** Create a store backed by the given file path. */
  constructor(private readonly filePath: string) {}

  /** Initialise the store by loading persisted data from disk. */
  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.loadFromDisk();
    }
    return this.initPromise;
  }

  /** Return a shallow copy of all registered environments. */
  getEnvironments(): EnvironmentRecord[] {
    return [...this.data.environments];
  }

  /** Look up an environment by its ID. */
  getEnvironment(id: string): EnvironmentRecord | undefined {
    return this.data.environments.find((item) => item.id === id);
  }

  /** Return the currently active environment selection. */
  getActiveSelection(): ActiveEnvironmentSelection {
    return {
      url: this.data.activeEnvironmentUrl,
      environmentId: this.data.activeEnvironmentId,
    };
  }

  /** Set the active environment by record ID. */
  async setActiveEnvironmentById(id: string): Promise<EnvironmentRecord> {
    const environment = this.getEnvironment(id);
    if (!environment) {
      throw new Error('The specified environment does not exist.');
    }
    this.data.activeEnvironmentId = id;
    this.data.activeEnvironmentUrl = environment.url;
    await this.persist();
    return environment;
  }

  /** Set the active environment by an ad-hoc URL (not tied to a record). */
  async setActiveEnvironmentUrl(url: string): Promise<void> {
    const normalized = normalizeEnvironmentUrl(url);
    this.data.activeEnvironmentId = null;
    this.data.activeEnvironmentUrl = normalized;
    await this.persist();
  }

  /** Register a new environment and persist it. */
  async addEnvironment(input: { label: string; url: string }): Promise<EnvironmentRecord> {
    const now = new Date().toISOString();
    const normalizedUrl = normalizeEnvironmentUrl(input.url);
    const record: EnvironmentRecord = {
      id: crypto.randomUUID(),
      label: input.label,
      url: normalizedUrl,
      createdAt: now,
      updatedAt: now,
    };
    this.data.environments.push(record);
    await this.persist();
    return record;
  }

  /** Update an existing environment's label and URL. */
  async updateEnvironment(id: string, update: { label: string; url: string }): Promise<EnvironmentRecord> {
    const environment = this.getEnvironment(id);
    if (!environment) {
      throw new Error('The specified environment does not exist.');
    }
    const normalizedUrl = normalizeEnvironmentUrl(update.url);
    environment.label = update.label;
    environment.url = normalizedUrl;
    environment.updatedAt = new Date().toISOString();
    if (this.data.activeEnvironmentId === id) {
      this.data.activeEnvironmentUrl = environment.url;
    }
    await this.persist();
    return environment;
  }

  /** Delete an environment by ID. Clears active selection if it was the active one. */
  async deleteEnvironment(id: string): Promise<void> {
    const before = this.data.environments.length;
    this.data.environments = this.data.environments.filter((t) => t.id !== id);
    if (before === this.data.environments.length) {
      throw new Error('The specified environment does not exist.');
    }
    if (this.data.activeEnvironmentId === id) {
      this.data.activeEnvironmentId = null;
      this.data.activeEnvironmentUrl = null;
    }
    await this.persist();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      if (!existsSync(this.filePath)) {
        await this.persist();
        return;
      }
      const content = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(content) as Partial<PersistedData & LegacyPersistedData> | null;
      const environments = Array.isArray(parsed?.environments)
        ? (parsed.environments as EnvironmentRecord[])
        : Array.isArray(parsed?.targets)
          ? (parsed.targets as EnvironmentRecord[])
          : [];
      this.data = {
        environments,
        activeEnvironmentId: parsed?.activeEnvironmentId ?? parsed?.activeTargetId ?? null,
        activeEnvironmentUrl: parsed?.activeEnvironmentUrl ?? parsed?.activeTargetUrl ?? null,
      };
    } catch (error) {
      console.error('[EnvironmentStore] Failed to load data. Reinitializing with empty state.', error);
      this.data = createEmptyData();
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    this.persistQueue = this.persistQueue.then(
      () => this.flushToDisk(),
      () => this.flushToDisk(),
    );
    return this.persistQueue;
  }

  private async flushToDisk(): Promise<void> {
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true });
    const payload: PersistedData & LegacyPersistedData = {
      environments: this.data.environments,
      activeEnvironmentId: this.data.activeEnvironmentId,
      activeEnvironmentUrl: this.data.activeEnvironmentUrl,
      targets: this.data.environments,
      activeTargetId: this.data.activeEnvironmentId,
      activeTargetUrl: this.data.activeEnvironmentUrl,
    };
    const nonce = Math.random().toString(16).slice(2);
    const tmpPath = `${this.filePath}.${Date.now()}.${nonce}.tmp`;
    await writeFile(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
    await rename(tmpPath, this.filePath);
  }
}
