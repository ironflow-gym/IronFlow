import type { StorageService } from './storageService';

export interface BackupStatus {
  state: 'disconnected' | 'pending' | 'transmitting' | 'connected' | 'error';
  lastBackupAt?: number;
  needsAuth?: boolean;
}

/** One upload at a time, always after local commit. Dirty state lives in IndexedDB. */
export class BackupQueue {
  private enabled = false;
  private online = false;
  private paused = true;
  private running = false;
  private rerun = false;
  private forced = false;
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private status: BackupStatus = { state: 'disconnected' };
  private unsubscribe: () => void;

  constructor(private store: StorageService, private remote: {
    hasValidToken: () => boolean;
    refreshToken: () => Promise<boolean>;
    upload: () => Promise<number>;
  }, private delay = 350) {
    this.unsubscribe = store.subscribe(() => {
      if (store.getStatus().state !== 'saved') {
        if (this.enabled && !this.running) this.publish({ state: 'pending' });
        return;
      }
      this.attempts = 0;
      if (this.running) this.rerun = true;
      this.schedule();
    });
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getStatus = (): BackupStatus => this.status;
  private publish(status: Partial<BackupStatus>) {
    this.status = { ...this.status, needsAuth: false, ...status };
    this.listeners.forEach(listener => listener());
  }

  configure(enabled: boolean, online: boolean, paused: boolean) {
    this.enabled = enabled; this.online = online; this.paused = paused;
    clearTimeout(this.timer);
    if (!enabled) this.publish({ state: 'disconnected' });
    else if (!online) this.publish({ state: 'pending' });
    this.attempts = 0;
    if (this.running) this.rerun = true;
    this.schedule();
  }

  request() { this.forced = true; this.attempts = 0; this.schedule(); }

  private schedule(delay = this.delay) {
    clearTimeout(this.timer);
    if (!this.enabled || !this.online || this.paused || this.running) return;
    this.timer = setTimeout(() => { void this.flush(); }, delay);
  }

  async flush(): Promise<void> {
    if (this.running || !this.enabled || !this.online || this.paused) return;
    if (this.store.getStatus().state !== 'saved') { this.publish({ state: 'pending' }); return; }
    this.running = true;
    let again = false;
    let retryDelay: number | undefined;
    try {
      const metadata = await this.store.getBackupMetadata();
      if (!metadata?.pending && !this.forced) {
        this.publish({ state: 'connected', lastBackupAt: metadata?.lastBackupAt ?? this.status.lastBackupAt });
        return;
      }
      if (!this.remote.hasValidToken() && !await this.remote.refreshToken()) {
        this.publish({ state: 'pending', needsAuth: true });
        return;
      }
      if (!this.enabled || !this.online || this.paused || this.store.getStatus().state !== 'saved') return;
      this.publish({ state: 'transmitting' });
      this.forced = false;
      const uploadedAt = await this.remote.upload();
      await this.store.acknowledgeBackup(metadata?.revision || '', uploadedAt);
      const current = await this.store.getBackupMetadata();
      again = !!current?.pending || this.forced;
      this.attempts = 0;
      this.publish({ state: !this.enabled ? 'disconnected' : again || !this.online || this.paused ? 'pending' : 'connected', lastBackupAt: uploadedAt });
    } catch (error) {
      this.forced = true;
      if (error instanceof Error && /\b401\b|no_token/.test(error.message)) {
        this.publish({ state: this.enabled ? 'pending' : 'disconnected', needsAuth: this.enabled });
        return;
      }
      this.publish({ state: this.enabled ? 'error' : 'disconnected' });
      if (++this.attempts <= 3) retryDelay = Math.min(60000, 5000 * 2 ** (this.attempts - 1));
    } finally {
      this.running = false;
      const rerun = this.rerun;
      this.rerun = false;
      if (again || rerun) this.schedule();
      else if (retryDelay !== undefined) this.schedule(retryDelay);
    }
  }

  dispose() { clearTimeout(this.timer); this.unsubscribe(); this.listeners.clear(); }
}
