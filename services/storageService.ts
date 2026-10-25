const DB_NAME = 'IronFlow_NeuralCore';
const STORE_NAME = 'vault';
const BACKUP_META = '__ironflow_backup_state';

export interface BackupMetadata { revision: string; pending: boolean; lastBackupAt?: number; }
export interface SaveStatus { state: 'saving' | 'saved' | 'error'; error?: string; }

/** Writes resolve after commit. Failed values are retained for an explicit retry. */
export class StorageService {
  private db: IDBDatabase | null = null;
  private opening: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  private pending = 0;
  private sequence = 0;
  private versions = new Map<string, number>();
  private failed = new Map<string, { value: unknown; remove: boolean }>();
  private status: SaveStatus = { state: 'saved' };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getStatus = (): SaveStatus => this.status;
  private publish() {
    this.status = this.failed.size
      ? { state: 'error', error: 'Changes could not be saved on this device.' }
      : { state: this.pending ? 'saving' : 'saved' };
    this.listeners.forEach(listener => listener());
  }

  async init(): Promise<void> {
    if (this.db) return;
    if (this.opening) return this.opening;
    this.opening = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        this.db.onversionchange = () => {
          this.db?.close(); this.db = null; this.opening = null;
          window.location.reload();
        };
        if (typeof navigator !== 'undefined') navigator.storage?.persist?.().catch(() => {});
        resolve();
      };
      request.onerror = () => reject(request.error || new Error('Could not open local storage.'));
      request.onblocked = () => reject(new Error('Close other IronFlow tabs, then retry.'));
    });
    try { await this.opening; } catch (error) { this.opening = null; throw error; }
  }

  async get<T>(id: string): Promise<T | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(id);
      tx.oncomplete = () => resolve(request.result ? request.result.value : null);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Could not read local storage.'));
    });
  }
  async getAllKeys(): Promise<string[]> { return Object.keys(await this.getEverything()); }
  set<T>(id: string, value: T): Promise<void> { return this.setBulk({ [id]: value }); }
  remove(id: string): Promise<void> { return this.setBulk({}, [id]); }

  /** Related records, deletions and the durable backup marker commit atomically. */
  async setBulk(items: Record<string, unknown>, remove: string[] = []): Promise<void> {
    const version = ++this.sequence;
    const changes = new Map(Object.entries(items).map(([id, value]) => [id, { value, remove: false }]));
    remove.forEach(id => changes.set(id, { value: undefined, remove: true }));
    changes.forEach((_, id) => { this.versions.set(id, version); this.failed.delete(id); });
    this.pending++;
    this.publish();
    try {
      await this.init();
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error || new Error('Local save was interrupted.'));
        try {
          changes.forEach((change, id) => change.remove ? store.delete(id) : store.put({ id, value: change.value }));
          const metadata = store.get(BACKUP_META);
          metadata.onsuccess = () => store.put({ id: BACKUP_META, value: {
            ...metadata.result?.value, revision: crypto.randomUUID(), pending: true,
          } });
        } catch (error) { tx.abort(); reject(error); }
      });
      changes.forEach((_, id) => { if (this.versions.get(id) === version) this.failed.delete(id); });
    } catch (error) {
      changes.forEach((change, id) => { if (this.versions.get(id) === version) this.failed.set(id, change); });
      throw error;
    } finally { this.pending--; this.publish(); }
  }

  async retryFailedWrites(): Promise<void> {
    const items: Record<string, unknown> = {};
    const remove: string[] = [];
    this.failed.forEach((change, id) => change.remove ? remove.push(id) : items[id] = change.value);
    if (this.failed.size) await this.setBulk(items, remove);
  }

  /** A single read transaction prevents backups mixing different revisions. */
  async getEverything(): Promise<Record<string, any>> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      tx.oncomplete = () => resolve(Object.fromEntries(request.result
        .filter(record => record.id !== BACKUP_META).map(record => [record.id, record.value])));
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Could not read the vault.'));
    });
  }
  getBackupMetadata(): Promise<BackupMetadata | null> { return this.get(BACKUP_META); }

  /** An upload cannot clear changes committed while it was in flight. */
  async acknowledgeBackup(revision: string, lastBackupAt: number): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(BACKUP_META);
      request.onsuccess = () => {
        const current = request.result?.value as BackupMetadata | undefined;
        if (current) store.put({ id: BACKUP_META, value: {
          ...current, pending: current.revision !== revision, lastBackupAt,
        } });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Could not record backup status.'));
    });
  }

  async clearAll(): Promise<void> {
    this.db?.close(); this.db = null; this.opening = null;
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => { this.failed.clear(); this.publish(); resolve(); };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Close other IronFlow tabs before clearing storage.'));
    });
  }

  async overwriteEverything(data: Record<string, unknown>): Promise<void> {
    await this.init();
    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Restore was interrupted.'));
      try {
        store.clear();
        Object.entries(data).filter(([id]) => id !== BACKUP_META).forEach(([id, value]) => store.put({ id, value }));
      } catch (error) { tx.abort(); reject(error); }
    });
    this.failed.clear(); this.publish();
  }
}
export const storage = new StorageService();
