import { storage } from './storageService';

const CLIENT_ID = '567778782957-6qknv8pq07lb8j4m15sb3nu161bn1hpp.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const SYNC_FILE_NAME = 'ironflow_vault_mirror.json';

// localStorage keys for token persistence across page reloads
const LS_TOKEN_KEY = 'ironflow_sync_token';
const LS_TOKEN_EXPIRY_KEY = 'ironflow_sync_token_expiry';
const LS_EMAIL_HINT_KEY = 'ironflow_sync_email_hint';

export class IronSyncService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    // Rehydrate token from localStorage on instantiation so page reloads
    // don't require re-auth within the token's 1-hour lifetime.
    const stored = localStorage.getItem(LS_TOKEN_KEY);
    const expiry = parseInt(localStorage.getItem(LS_TOKEN_EXPIRY_KEY) || '0');
    if (stored && Date.now() < expiry) {
      this.accessToken = stored;
      this.tokenExpiry = expiry;
    }
  }

  hasValidToken(): boolean {
    return !!(this.accessToken && Date.now() < this.tokenExpiry);
  }

  /**
   * Ensures a valid access token exists.
   *
   * Strategy:
   *   1. Return cached token if still valid.
   *   2. Try silent re-auth (prompt: 'none') — works when Google session cookies
   *      are available (same-origin or third-party cookies allowed).
   *   3. If silent fails AND interactive is true, fall back to a popup.
   *   4. If silent fails AND interactive is false, throw — caller decides what to do.
   *
   * IMPORTANT: To keep the popup tied to a direct user gesture (required by
   * browsers to allow popups), callers that may need interactive auth should
   * call ensureToken(true) at the very top of their click handler, before any
   * other awaits. This file enforces that by keeping the popup path here.
   */
  async ensureToken(interactive: boolean = false): Promise<string> {
    if (this.hasValidToken()) {
      return this.accessToken!;
    }

    // Try silent first — this works within the same browser session even when
    // third-party cookies are blocked, because the GIS library uses a
    // postMessage-based refresh internally for recently-granted tokens.
    try {
      return await this._requestToken(false);
    } catch (silentErr) {
      if (!interactive) {
        throw silentErr;
      }
      // Silent failed — try interactive popup.
      // This must be called as close to the original user gesture as possible.
      return await this._requestToken(true);
    }
  }

  /** @deprecated Use ensureToken() instead */
  async authorize(interactive: boolean = true): Promise<string> {
    return this.ensureToken(interactive);
  }

  private _requestToken(interactive: boolean): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          login_hint: localStorage.getItem(LS_EMAIL_HINT_KEY) || undefined,
          callback: (response: any) => {
            if (response.error) {
              reject(new Error(`OAuth error: ${response.error} — ${response.error_description || ''}`));
            } else {
              this._storeToken(response.access_token, response.expires_in);
              resolve(this.accessToken!);
            }
          },
        });
        client.requestAccessToken({ prompt: interactive ? '' : 'none' });
      } catch (e) {
        reject(e);
      }
    });
  }

  private _storeToken(token: string, expiresInSeconds: number): void {
    this.accessToken = token;
    this.tokenExpiry = Date.now() + (expiresInSeconds * 1000);
    // Persist so the token survives page reloads within its 1-hour lifetime
    localStorage.setItem(LS_TOKEN_KEY, token);
    localStorage.setItem(LS_TOKEN_EXPIRY_KEY, String(this.tokenExpiry));
  }

  /**
   * Finds the Drive appDataFolder file ID, reusing an already-obtained token.
   * Token is passed in to avoid a second independent auth attempt.
   */
  async findMirrorFile(token: string): Promise<string | null> {
    const query = encodeURIComponent(`name = '${SYNC_FILE_NAME}' and spaces = 'appDataFolder'`);
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) {
      throw new Error(`Drive file list failed: ${response.status}`);
    }
    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  }

  /**
   * Upload all local data to Drive.
   * Requires a valid token — call ensureToken(true) in the click handler first.
   */
  async uploadMirror(): Promise<number> {
    const token = await this.ensureToken(false);
    const fileId = await this.findMirrorFile(token);
    const everything = await storage.getEverything();
    const lastUpdated = Date.now();
    const payload = {
      version: '2.0',
      lastUpdated,
      data: everything
    };

    const metadata: any = { name: SYNC_FILE_NAME };
    if (!fileId) {
      metadata.parents = ['appDataFolder'];
    }

    const boundary = 'ironflow_mp_boundary';
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\n` +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(payload) +
      `\r\n--${boundary}--`;

    const url = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const res = await fetch(url, {
      method: fileId ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("IronSync upload failed:", errorText);
      throw new Error(`Upload failed (${res.status}): ${errorText}`);
    }

    return lastUpdated;
  }

  /**
   * Download the Drive mirror.
   * Requires a valid token — call ensureToken(true) in the click handler first.
   */
  async downloadMirror(): Promise<{ lastUpdated: number; data: any } | null> {
    const token = await this.ensureToken(false);
    const fileId = await this.findMirrorFile(token);
    if (!fileId) return null;

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) return null;
    return await response.json();
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.tokenExpiry = 0;
    localStorage.removeItem(LS_TOKEN_KEY);
    localStorage.removeItem(LS_TOKEN_EXPIRY_KEY);
    localStorage.removeItem(LS_EMAIL_HINT_KEY);
  }
}

export const ironSync = new IronSyncService();
