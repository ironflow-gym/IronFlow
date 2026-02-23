import { storage } from './storageService';

const CLIENT_ID = '567778782957-6qknv8pq07lb8j4m15sb3nu161bn1hpp.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const SYNC_FILE_NAME = 'ironflow_vault_mirror.json';

// localStorage keys
const LS_TOKEN_KEY         = 'ironflow_sync_token';
const LS_TOKEN_EXPIRY_KEY  = 'ironflow_sync_token_expiry';
const LS_EMAIL_HINT_KEY    = 'ironflow_sync_email_hint';
// Temporary key the OAuth redirect tab writes the token into
const LS_OAUTH_RESULT_KEY  = 'ironflow_oauth_result';

// =============================================================================
// OAuth redirect handler
//
// When Google redirects back to the app after the user grants access, the URL
// contains the token in the fragment (#access_token=...&expires_in=...).
// If this module detects that pattern on load it stores the token, notifies
// the opener tab, and closes itself immediately — the user never sees the app
// reload in the popup.
// =============================================================================
(function handleOAuthRedirect() {
  const hash = window.location.hash;
  if (!hash.includes('access_token=')) return;

  const params = new URLSearchParams(hash.slice(1)); // strip leading '#'
  const token     = params.get('access_token');
  const expiresIn = parseInt(params.get('expires_in') || '3600');

  if (!token) return;

  const expiry = Date.now() + expiresIn * 1000;
  // Write result for the polling loop in the opener tab
  localStorage.setItem(LS_OAUTH_RESULT_KEY, JSON.stringify({ token, expiry }));

  // Clean the hash so history doesn't expose the token if the user navigates back
  history.replaceState(null, '', window.location.pathname + window.location.search);

  // Close the popup — the opener is polling and will pick up the token
  window.close();
})();

// =============================================================================

export class IronSyncService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    // Rehydrate persisted token so page reloads within the 1-hour window
    // don't require re-auth.
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

  // ===========================================================================
  // Interactive auth
  //
  // CRITICAL: The caller must call window.open() SYNCHRONOUSLY in the click
  // handler and pass the resulting window reference here. This is the only
  // reliable way to avoid popup blockers — browsers permit window.open() when
  // called directly from a user gesture, but block it after any await.
  //
  // If the token is already valid, the pre-opened window is closed immediately
  // and the cached token is returned without any network call.
  //
  // Usage in a click handler:
  //   const popup = window.open('', 'ironflow_oauth', 'width=500,height=650');
  //   const token = await ironSync.authorizeInteractive(popup);
  //
  // REQUIREMENT: the app's full URL must be registered as both an
  // "Authorised JavaScript origin" AND an "Authorised redirect URI" in the
  // Google Cloud Console OAuth client.
  // ===========================================================================
  async authorizeInteractive(popup: Window | null): Promise<string> {
    if (this.hasValidToken()) {
      // Token still valid — no need to auth, close the pre-opened window
      if (popup && !popup.closed) popup.close();
      return this.accessToken!;
    }

    if (!popup || popup.closed) {
      throw new Error(
        'popup_blocked: The sign-in window could not be opened. ' +
        'Please allow popups for this site in your browser settings and try again.'
      );
    }

    // Clear any stale result from a previous attempt
    localStorage.removeItem(LS_OAUTH_RESULT_KEY);

    // Build the redirect_uri — the app's own origin + path, no hash
    const redirectUri = window.location.origin + window.location.pathname;

    const params = new URLSearchParams({
      client_id:              CLIENT_ID,
      redirect_uri:           redirectUri,
      response_type:          'token',
      scope:                  SCOPES,
      include_granted_scopes: 'true',
      ...(localStorage.getItem(LS_EMAIL_HINT_KEY)
        ? { login_hint: localStorage.getItem(LS_EMAIL_HINT_KEY)! }
        : {}),
    });

    // Navigate the already-open popup to the Google auth URL.
    // The popup was opened synchronously by the caller so browsers allow this.
    popup.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

    // Poll localStorage for the token the redirect handler will write
    return new Promise((resolve, reject) => {
      const POLL_INTERVAL_MS = 300;
      const TIMEOUT_MS       = 5 * 60 * 1000; // 5 minutes
      const started          = Date.now();

      const poll = setInterval(() => {
        const raw = localStorage.getItem(LS_OAUTH_RESULT_KEY);

        if (raw) {
          clearInterval(poll);
          localStorage.removeItem(LS_OAUTH_RESULT_KEY);
          try {
            const { token, expiry } = JSON.parse(raw);
            this._storeToken(token, (expiry - Date.now()) / 1000);
            resolve(this.accessToken!);
          } catch {
            reject(new Error('auth_error: Could not parse token response.'));
          }
          return;
        }

        // User closed the popup without completing auth
        if (popup.closed) {
          clearInterval(poll);
          reject(new Error('auth_cancelled: Sign-in window was closed.'));
          return;
        }

        if (Date.now() - started > TIMEOUT_MS) {
          clearInterval(poll);
          popup.close();
          reject(new Error('auth_timeout: Sign-in timed out.'));
        }
      }, POLL_INTERVAL_MS);
    });
  }

  // ===========================================================================
  // Silent re-auth — background only, never shows UI.
  // Uses the GIS token client with prompt:'none'. Guarded by a timeout because
  // GIS sometimes never fires the callback when third-party cookies are blocked.
  // ===========================================================================
  async authorizeSilent(): Promise<string> {
    if (this.hasValidToken()) return this.accessToken!;

    return new Promise((resolve, reject) => {
      let settled = false;

      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('silent_auth_timeout'));
        }
      }, 10000);

      const done = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        fn();
      };

      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          login_hint: localStorage.getItem(LS_EMAIL_HINT_KEY) || undefined,
          callback: (response: any) => {
            if (response.error) {
              done(() => reject(new Error(`silent_oauth_error: ${response.error}`)));
            } else {
              done(() => {
                this._storeToken(response.access_token, response.expires_in);
                resolve(this.accessToken!);
              });
            }
          },
        });
        client.requestAccessToken({ prompt: 'none' });
      } catch (e) {
        done(() => reject(e));
      }
    });
  }

  // ===========================================================================
  // ensureToken — unified entry point used by upload/download
  // ===========================================================================
  // Background-only token retrieval. Interactive auth must go through
  // authorizeInteractive(popup) called directly from a component click handler.
  async ensureToken(_interactive: boolean = false): Promise<string> {
    if (this.hasValidToken()) return this.accessToken!;
    return this.authorizeSilent();
  }

  /** @deprecated Use authorizeInteractive(popup) for interactive auth */
  async authorize(_interactive: boolean = true): Promise<string> {
    return this.ensureToken(false);
  }

  private _storeToken(token: string, expiresInSeconds: number): void {
    this.accessToken = token;
    this.tokenExpiry = Date.now() + expiresInSeconds * 1000;
    localStorage.setItem(LS_TOKEN_KEY, token);
    localStorage.setItem(LS_TOKEN_EXPIRY_KEY, String(this.tokenExpiry));
  }

  async findMirrorFile(token: string): Promise<string | null> {
    const query = encodeURIComponent(`name = '${SYNC_FILE_NAME}' and spaces = 'appDataFolder'`);
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) throw new Error(`Drive file list failed: ${response.status}`);
    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  }

  async uploadMirror(): Promise<number> {
    const token = await this.ensureToken(false);
    const fileId = await this.findMirrorFile(token);
    const everything = await storage.getEverything();
    const lastUpdated = Date.now();
    const payload = { version: '2.0', lastUpdated, data: everything };

    const metadata: any = { name: SYNC_FILE_NAME };
    if (!fileId) metadata.parents = ['appDataFolder'];

    const boundary = 'ironflow_mp_boundary';
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\n` +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(payload) +
      `\r\n--${boundary}--`;

    const res = await fetch(
      fileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: fileId ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error('IronSync upload failed:', errorText);
      throw new Error(`Upload failed (${res.status}): ${errorText}`);
    }

    return lastUpdated;
  }

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
    localStorage.removeItem(LS_OAUTH_RESULT_KEY);
  }
}

export const ironSync = new IronSyncService();
