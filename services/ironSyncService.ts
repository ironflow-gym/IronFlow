import { storage } from './storageService';

const CLIENT_ID   = '567778782957-6qknv8pq07lb8j4m15sb3nu161bn1hpp.apps.googleusercontent.com';
const SCOPES      = 'https://www.googleapis.com/auth/drive.appdata';

// File naming: one file per instance, named by instance ID.
// Old single-file name left untouched for backward compatibility with
// any imported .json backups — it is never written by the new code.
const MIRROR_FILE_PREFIX = 'ironflow_mirror_';

// ─── localStorage keys ────────────────────────────────────────────────────────
const LS_TOKEN_KEY        = 'ironflow_sync_token';
const LS_TOKEN_EXPIRY_KEY = 'ironflow_sync_token_expiry';
const LS_EMAIL_HINT_KEY   = 'ironflow_sync_email_hint';
const LS_PENDING_AUTH_KEY = 'ironflow_oauth_pending';

// Instance identity — stored in localStorage so they survive IndexedDB restores.
// instanceId: short random string, generated once, never changes.
// instanceName: human-readable label the user can edit (e.g. "iPhone", "Desktop").
const LS_INSTANCE_ID_KEY   = 'ironflow_instance_id';
const LS_INSTANCE_NAME_KEY = 'ironflow_instance_name';

// ─── Instance identity helpers ────────────────────────────────────────────────

function generateInstanceId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function deriveDefaultInstanceName(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad/.test(ua))                return 'iPad';
  if (/iphone/.test(ua))             return 'iPhone';
  if (/android.*mobile/.test(ua))    return 'Android Phone';
  if (/android/.test(ua))            return 'Android Tablet';
  if (/macintosh|mac os x/.test(ua)) return 'Mac';
  if (/windows/.test(ua))            return 'Windows PC';
  if (/linux/.test(ua))              return 'Linux';
  return 'My Device';
}

export function getInstanceId(): string {
  let id = localStorage.getItem(LS_INSTANCE_ID_KEY);
  if (!id) {
    id = generateInstanceId();
    localStorage.setItem(LS_INSTANCE_ID_KEY, id);
  }
  return id;
}

export function getInstanceName(): string {
  let name = localStorage.getItem(LS_INSTANCE_NAME_KEY);
  if (!name) {
    name = deriveDefaultInstanceName();
    localStorage.setItem(LS_INSTANCE_NAME_KEY, name);
  }
  return name;
}

export function setInstanceName(name: string): void {
  localStorage.setItem(LS_INSTANCE_NAME_KEY, name.trim() || deriveDefaultInstanceName());
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function appBaseUrl(): string {
  return window.location.origin + window.location.pathname;
}

function buildAuthUrl(prompt: string = ''): string {
  const params = new URLSearchParams({
    client_id:              CLIENT_ID,
    redirect_uri:           appBaseUrl(),
    response_type:          'token',
    scope:                  SCOPES,
    include_granted_scopes: 'true',
    ...(prompt ? { prompt } : {}),
    ...(localStorage.getItem(LS_EMAIL_HINT_KEY)
      ? { login_hint: localStorage.getItem(LS_EMAIL_HINT_KEY)! }
      : {}),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ─── Token extraction ─────────────────────────────────────────────────────────

export function extractTokenFromHash(): { token: string; expiresIn: number } | null {
  const hash = window.location.hash;
  if (!hash.includes('access_token=')) return null;

  const params    = new URLSearchParams(hash.slice(1));
  const token     = params.get('access_token');
  const expiresIn = parseInt(params.get('expires_in') || '3600', 10);

  if (!token) return null;

  history.replaceState(null, '', window.location.pathname + window.location.search);

  return { token, expiresIn };
}

// ─── Mirror file descriptor ────────────────────────────────────────────────────

export interface MirrorFileMeta {
  driveFileId:     string;
  instanceId:      string;
  instanceName:    string;
  lastUpdated:     number;
  isCurrentDevice: boolean;
  historyCount:    number;
  templateCount:   number;
  biometricCount:  number;
  fuelCount:       number;
  pantryCount:     number;
  morphologyCount: number;
  libraryCount:    number;
  summaryCount:    number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class IronSyncService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    const stored = localStorage.getItem(LS_TOKEN_KEY);
    const expiry = parseInt(localStorage.getItem(LS_TOKEN_EXPIRY_KEY) || '0', 10);
    if (stored && Date.now() < expiry) {
      this.accessToken = stored;
      this.tokenExpiry = expiry;
    }
  }

  hasValidToken(): boolean {
    return !!(this.accessToken && Date.now() < this.tokenExpiry);
  }

  consumeRedirectToken(token: string, expiresIn: number): void {
    this._storeToken(token, expiresIn);
  }

  hasPendingAuth(): boolean {
    return localStorage.getItem(LS_PENDING_AUTH_KEY) === 'true';
  }

  clearPendingAuth(): void {
    localStorage.removeItem(LS_PENDING_AUTH_KEY);
  }

  startAuthRedirect(): void {
    localStorage.setItem(LS_PENDING_AUTH_KEY, 'true');
    window.location.href = buildAuthUrl();
  }

  async trySilentRefresh(): Promise<boolean> {
    if (this.hasValidToken()) return true;

    return new Promise(resolve => {
      const TIMEOUT_MS = 8000;
      let settled = false;

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const cleanup = () => {
        if (settled) return;
        settled = true;
        try { document.body.removeChild(iframe); } catch {}
      };

      const timeoutId = setTimeout(() => { cleanup(); resolve(false); }, TIMEOUT_MS);

      iframe.onload = () => {
        try {
          const hash = iframe.contentWindow?.location.hash || '';
          if (hash.includes('access_token=')) {
            const params    = new URLSearchParams(hash.slice(1));
            const token     = params.get('access_token');
            const expiresIn = parseInt(params.get('expires_in') || '3600', 10);
            if (token) {
              this._storeToken(token, expiresIn);
              clearTimeout(timeoutId);
              cleanup();
              resolve(true);
              return;
            }
          }
        } catch {}
        clearTimeout(timeoutId);
        cleanup();
        resolve(false);
      };

      iframe.src = buildAuthUrl('none');
    });
  }

  getToken(): string {
    if (!this.hasValidToken()) {
      throw new Error('no_token: Token missing or expired. Re-auth required.');
    }
    return this.accessToken!;
  }

  private _storeToken(token: string, expiresInSeconds: number): void {
    this.accessToken  = token;
    this.tokenExpiry  = Date.now() + expiresInSeconds * 1000;
    localStorage.setItem(LS_TOKEN_KEY,        this.accessToken);
    localStorage.setItem(LS_TOKEN_EXPIRY_KEY, String(this.tokenExpiry));
  }

  // ─── Drive operations ────────────────────────────────────────────────────────

  private mirrorFileName(): string {
    return `${MIRROR_FILE_PREFIX}${getInstanceId()}.json`;
  }

  async findMirrorFile(token: string, fileName: string): Promise<string | null> {
    const query = encodeURIComponent(`name = '${fileName}'`);
    const res   = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`Drive file list failed: ${res.status}`);
    const data = await res.json();
    return data.files?.length > 0 ? data.files[0].id : null;
  }

  /**
   * Lists all IronFlow mirror files across all instances.
   * Fetches each file's content to read metadata.
   * Returns them sorted: this device first, then newest first.
   */
  async listAllMirrorFiles(token: string): Promise<MirrorFileMeta[]> {
    const query = encodeURIComponent(`name contains '${MIRROR_FILE_PREFIX}'`);
    const res   = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`Drive file list failed: ${res.status}`);
    const data  = await res.json();
    const files: { id: string; name: string }[] = data.files || [];

    const currentId = getInstanceId();

    const results = await Promise.allSettled(
      files.map(async (f) => {
        const mediaRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!mediaRes.ok) return null;
        const payload = await mediaRes.json();

        // Derive instanceId from filename as fallback for older files
        const derivedId = f.name.replace(MIRROR_FILE_PREFIX, '').replace('.json', '');
        const instanceId = payload.instanceId || derivedId;

        const d = payload.data || {};
        return {
          driveFileId:     f.id,
          instanceId,
          instanceName:    payload.instanceName || 'Unknown Device',
          lastUpdated:     payload.lastUpdated  || 0,
          isCurrentDevice: instanceId === currentId,
          historyCount:    d.ironflow_history?.length                         || 0,
          templateCount:   d.ironflow_templates?.length                       || 0,
          biometricCount:  d.ironflow_biometrics?.length                      || 0,
          fuelCount:       d.ironflow_fuel?.length                            || 0,
          pantryCount:     d.ironflow_pantry?.length                          || 0,
          morphologyCount: d.ironflow_morphology?.length                      || 0,
          libraryCount:    d.ironflow_library?.length                         || 0,
          summaryCount:    Object.keys(d.ironflow_narrative_vault || {}).length,
        } as MirrorFileMeta;
      })
    );

    const metas = results
      .filter((r): r is PromiseFulfilledResult<MirrorFileMeta> =>
        r.status === 'fulfilled' && r.value !== null
      )
      .map(r => r.value);

    return metas.sort((a, b) => {
      if (a.isCurrentDevice && !b.isCurrentDevice) return -1;
      if (!a.isCurrentDevice && b.isCurrentDevice) return 1;
      return b.lastUpdated - a.lastUpdated;
    });
  }

  async uploadMirror(): Promise<number> {
    const token       = this.getToken();
    const fileName    = this.mirrorFileName();
    const fileId      = await this.findMirrorFile(token, fileName);
    const everything  = await storage.getEverything();
    const lastUpdated = Date.now();

    const metadata: Record<string, any> = { name: fileName };
    if (!fileId) metadata.parents = ['appDataFolder'];

    const boundary = 'ironflow_mp_boundary';
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\n` +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify({
        version:      '2.0',
        lastUpdated,
        instanceId:   getInstanceId(),
        instanceName: getInstanceName(),
        data:         everything,
      }) +
      `\r\n--${boundary}--`;

    const res = await fetch(
      fileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
        : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`,
      {
        method:  fileId ? 'PATCH' : 'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Upload failed (${res.status}): ${err}`);
    }

    return lastUpdated;
  }

  /**
   * Downloads a specific mirror file by Drive file ID.
   * Used by BackupManager after the user selects which instance to restore from.
   */
  async downloadMirrorById(driveFileId: string): Promise<{ lastUpdated: number; instanceId: string; instanceName: string; data: any } | null> {
    const token = this.getToken();
    const res   = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    return res.json();
  }

  /**
   * Downloads this device's own mirror file.
   * Used by App.tsx on startup to check for a newer cloud copy.
   */
  async downloadMirror(): Promise<{ lastUpdated: number; data: any } | null> {
    const token    = this.getToken();
    const fileName = this.mirrorFileName();
    const fileId   = await this.findMirrorFile(token, fileName);
    if (!fileId) return null;

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) return null;
    return res.json();
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.tokenExpiry = 0;
    localStorage.removeItem(LS_TOKEN_KEY);
    localStorage.removeItem(LS_TOKEN_EXPIRY_KEY);
    localStorage.removeItem(LS_EMAIL_HINT_KEY);
    localStorage.removeItem(LS_PENDING_AUTH_KEY);
    // instanceId and instanceName intentionally preserved on disconnect —
    // same file is reused if the user reconnects the same device.
  }
}

export const ironSync = new IronSyncService();
