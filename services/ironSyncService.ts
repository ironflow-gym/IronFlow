import { storage } from './storageService';

const CLIENT_ID   = '567778782957-6qknv8pq07lb8j4m15sb3nu161bn1hpp.apps.googleusercontent.com';
const SCOPES      = 'https://www.googleapis.com/auth/drive.appdata';
const SYNC_FILE_NAME = 'ironflow_vault_mirror.json';

// ─── localStorage keys ────────────────────────────────────────────────────────
const LS_TOKEN_KEY        = 'ironflow_sync_token';
const LS_TOKEN_EXPIRY_KEY = 'ironflow_sync_token_expiry';
const LS_EMAIL_HINT_KEY   = 'ironflow_sync_email_hint';
// Written before redirect so the app knows to complete connection on return
const LS_PENDING_AUTH_KEY = 'ironflow_oauth_pending';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the app's base URL — origin + pathname, no hash, no query */
function appBaseUrl(): string {
  return window.location.origin + window.location.pathname;
}

/** Builds the Google OAuth implicit-grant URL */
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

/**
 * Reads an OAuth implicit-grant token from the current URL hash.
 * Returns null if the hash does not contain a token.
 * Cleans the hash from the URL so the token is not exposed in browser history.
 */
export function extractTokenFromHash(): { token: string; expiresIn: number } | null {
  const hash = window.location.hash;
  if (!hash.includes('access_token=')) return null;

  const params    = new URLSearchParams(hash.slice(1));
  const token     = params.get('access_token');
  const expiresIn = parseInt(params.get('expires_in') || '3600', 10);

  if (!token) return null;

  // Remove the token from the URL immediately — security hygiene
  history.replaceState(null, '', window.location.pathname + window.location.search);

  return { token, expiresIn };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class IronSyncService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    // Rehydrate persisted token so the app works for up to 1 hour after the
    // last auth without requiring another redirect.
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

  /**
   * Stores a token received from an OAuth redirect.
   * Called by App.tsx after extractTokenFromHash() returns a result.
   */
  consumeRedirectToken(token: string, expiresIn: number): void {
    this._storeToken(token, expiresIn);
  }

  /**
   * True if a pending auth redirect was initiated (i.e. the user clicked
   * "Initialize Cloud Vault" and was sent to Google). App.tsx checks this
   * on startup to know whether to complete the connection flow.
   */
  hasPendingAuth(): boolean {
    return localStorage.getItem(LS_PENDING_AUTH_KEY) === 'true';
  }

  clearPendingAuth(): void {
    localStorage.removeItem(LS_PENDING_AUTH_KEY);
  }

  // ─── Interactive auth ───────────────────────────────────────────────────────
  //
  // Full-page redirect to Google's OAuth consent screen.
  // This is the ONLY reliable auth method across all PWA contexts and desktop
  // browsers — no popup involved, no gesture-trust issues.
  //
  // The app redirects away, Google authenticates the user, then redirects back
  // to the app URL with the token in the URL hash. App.tsx reads the hash on
  // startup and calls consumeRedirectToken() to complete the flow.
  //
  // This function never returns — it navigates away.
  // ───────────────────────────────────────────────────────────────────────────
  startAuthRedirect(): void {
    localStorage.setItem(LS_PENDING_AUTH_KEY, 'true');
    window.location.href = buildAuthUrl();
  }

  // ─── Silent token refresh ───────────────────────────────────────────────────
  //
  // Uses a hidden iframe with prompt=select_account suppressed (prompt=none).
  // Google explicitly supports this pattern for single-page apps to refresh
  // tokens without user interaction when a valid Google session exists.
  //
  // Falls through cleanly (resolves false) if the session has expired or
  // third-party cookies are blocked — the caller then marks sync as 'pending'
  // and waits for the user to manually re-auth via startAuthRedirect().
  // ───────────────────────────────────────────────────────────────────────────
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

      const timeoutId = setTimeout(() => {
        cleanup();
        resolve(false);
      }, TIMEOUT_MS);

      // Listen for the token landing in a message from the iframe's redirect
      // Google sends the token back in the URL hash of the redirect_uri loaded
      // inside the iframe. We read it via a load event on the iframe.
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
        } catch {
          // Cross-origin error means Google returned an error page, not our app
        }
        clearTimeout(timeoutId);
        cleanup();
        resolve(false);
      };

      iframe.src = buildAuthUrl('none');
    });
  }

  // ─── Token for API calls ────────────────────────────────────────────────────
  //
  // Used internally by uploadMirror / downloadMirror.
  // Returns the cached token if valid, otherwise throws — the caller
  // (triggerSync in App.tsx) will catch this and set status to 'pending'.
  // ───────────────────────────────────────────────────────────────────────────
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

  async findMirrorFile(token: string): Promise<string | null> {
    const query = encodeURIComponent(`name = '${SYNC_FILE_NAME}' and spaces = 'appDataFolder'`);
    const res   = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`Drive file list failed: ${res.status}`);
    const data = await res.json();
    return data.files?.length > 0 ? data.files[0].id : null;
  }

  async uploadMirror(): Promise<number> {
    const token    = this.getToken();
    const fileId   = await this.findMirrorFile(token);
    const everything  = await storage.getEverything();
    const lastUpdated = Date.now();

    const metadata: Record<string, any> = { name: SYNC_FILE_NAME };
    if (!fileId) metadata.parents = ['appDataFolder'];

    const boundary = 'ironflow_mp_boundary';
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\n` +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify({ version: '2.0', lastUpdated, data: everything }) +
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

  async downloadMirror(): Promise<{ lastUpdated: number; data: any } | null> {
    const token  = this.getToken();
    const fileId = await this.findMirrorFile(token);
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
  }
}

export const ironSync = new IronSyncService();
