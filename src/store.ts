import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';

export interface TargetRecord {
  id: string;
  label: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

interface PersistedData {
  targets: TargetRecord[];
  activeTargetId: string | null;
  activeTargetUrl: string | null;
}

export interface ActiveSelection {
  url: string | null;
  targetId: string | null;
}

function createEmptyData(): PersistedData {
  return {
    targets: [],
    activeTargetId: null,
    activeTargetUrl: null,
  };
}

export class TargetStore {
  private data: PersistedData = createEmptyData();
  private initPromise: Promise<void> | null = null;

  constructor(private readonly filePath: string) {}

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.loadFromDisk();
    }
    return this.initPromise;
  }

  getTargets(): TargetRecord[] {
    return [...this.data.targets];
  }

  getTarget(id: string): TargetRecord | undefined {
    return this.data.targets.find((item) => item.id === id);
  }

  getActiveSelection(): ActiveSelection {
    return {
      url: this.data.activeTargetUrl,
      targetId: this.data.activeTargetId,
    };
  }

  async setActiveTargetById(id: string): Promise<TargetRecord> {
    const target = this.getTarget(id);
    if (!target) {
      throw new Error('指定されたターゲットが存在しません');
    }
    this.data.activeTargetId = id;
    this.data.activeTargetUrl = target.url;
    await this.persist();
    return target;
  }

  async setActiveTargetUrl(url: string): Promise<void> {
    this.data.activeTargetId = null;
    this.data.activeTargetUrl = url;
    await this.persist();
  }

  async addTarget(input: { label: string; url: string }): Promise<TargetRecord> {
    const now = new Date().toISOString();
    const record: TargetRecord = {
      id: crypto.randomUUID(),
      label: input.label,
      url: input.url,
      createdAt: now,
      updatedAt: now,
    };
    this.data.targets.push(record);
    await this.persist();
    return record;
  }

  async updateTarget(id: string, update: { label: string; url: string }): Promise<TargetRecord> {
    const target = this.getTarget(id);
    if (!target) {
      throw new Error('指定されたターゲットが存在しません');
    }
    target.label = update.label;
    target.url = update.url;
    target.updatedAt = new Date().toISOString();
    if (this.data.activeTargetId === id) {
      this.data.activeTargetUrl = target.url;
    }
    await this.persist();
    return target;
  }

  async deleteTarget(id: string): Promise<void> {
    const before = this.data.targets.length;
    this.data.targets = this.data.targets.filter((t) => t.id !== id);
    if (before === this.data.targets.length) {
      throw new Error('指定されたターゲットが存在しません');
    }
    if (this.data.activeTargetId === id) {
      this.data.activeTargetId = null;
      this.data.activeTargetUrl = null;
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
      const parsed = JSON.parse(content) as Partial<PersistedData> | null;
      this.data = {
        targets: Array.isArray(parsed?.targets) ? (parsed.targets as TargetRecord[]) : [],
        activeTargetId: parsed?.activeTargetId ?? null,
        activeTargetUrl: parsed?.activeTargetUrl ?? null,
      };
    } catch (error) {
      console.error('[TargetStore] データ読み込みに失敗しました。空の状態で再初期化します', error);
      this.data = createEmptyData();
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }
}
