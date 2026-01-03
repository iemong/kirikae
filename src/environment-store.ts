import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';

export interface EnvironmentRecord {
  id: string;
  label: string;
  url: string;
  createdAt: string;
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

export interface ActiveEnvironmentSelection {
  url: string | null;
  environmentId: string | null;
}

function createEmptyData(): PersistedData {
  return {
    environments: [],
    activeEnvironmentId: null,
    activeEnvironmentUrl: null,
  };
}

export class EnvironmentStore {
  private data: PersistedData = createEmptyData();
  private initPromise: Promise<void> | null = null;

  constructor(private readonly filePath: string) {}

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.loadFromDisk();
    }
    return this.initPromise;
  }

  getEnvironments(): EnvironmentRecord[] {
    return [...this.data.environments];
  }

  getEnvironment(id: string): EnvironmentRecord | undefined {
    return this.data.environments.find((item) => item.id === id);
  }

  getActiveSelection(): ActiveEnvironmentSelection {
    return {
      url: this.data.activeEnvironmentUrl,
      environmentId: this.data.activeEnvironmentId,
    };
  }

  async setActiveEnvironmentById(id: string): Promise<EnvironmentRecord> {
    const environment = this.getEnvironment(id);
    if (!environment) {
      throw new Error('指定されたエンバイロメントが存在しません');
    }
    this.data.activeEnvironmentId = id;
    this.data.activeEnvironmentUrl = environment.url;
    await this.persist();
    return environment;
  }

  async setActiveEnvironmentUrl(url: string): Promise<void> {
    this.data.activeEnvironmentId = null;
    this.data.activeEnvironmentUrl = url;
    await this.persist();
  }

  async addEnvironment(input: { label: string; url: string }): Promise<EnvironmentRecord> {
    const now = new Date().toISOString();
    const record: EnvironmentRecord = {
      id: crypto.randomUUID(),
      label: input.label,
      url: input.url,
      createdAt: now,
      updatedAt: now,
    };
    this.data.environments.push(record);
    await this.persist();
    return record;
  }

  async updateEnvironment(id: string, update: { label: string; url: string }): Promise<EnvironmentRecord> {
    const environment = this.getEnvironment(id);
    if (!environment) {
      throw new Error('指定されたエンバイロメントが存在しません');
    }
    environment.label = update.label;
    environment.url = update.url;
    environment.updatedAt = new Date().toISOString();
    if (this.data.activeEnvironmentId === id) {
      this.data.activeEnvironmentUrl = environment.url;
    }
    await this.persist();
    return environment;
  }

  async deleteEnvironment(id: string): Promise<void> {
    const before = this.data.environments.length;
    this.data.environments = this.data.environments.filter((t) => t.id !== id);
    if (before === this.data.environments.length) {
      throw new Error('指定されたエンバイロメントが存在しません');
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
      console.error('[EnvironmentStore] データ読み込みに失敗しました。空の状態で再初期化します', error);
      this.data = createEmptyData();
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
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
    await writeFile(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
  }
}
