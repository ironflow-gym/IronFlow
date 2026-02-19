import { storage } from './storageService';

const CLIENT_ID = '567778782957-6qknv8pq07lb8j4m15sb3nu161bn1hpp.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const SYNC_FILE_NAME = 'ironflow_vault_mirror.json';

export class IronSyncService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  hasValidToken(): boolean {
    return !!(this.accessToken && Date.now() < this.tokenExpiry);
  }

  /**
   * Authorize the user.
   * @param interactive If true, opens a popup. If false, attempts a silent refresh.
   */
  async authorize(interactive: boolean = true): Promise<string> {
    if (this.hasValidToken()) {
      return this.accessToken!;
    }

    return new Promise((resolve, reject) => {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          hint: interactive ? undefined : localStorage.getItem('ironflow_sync_email_hint'),
          callback: (response: any) => {
            if (response.error) {
              reject(response);
            } else {
              this.accessToken = response.access_token;
              this.tokenExpiry = Date.now() + (response.expires_in * 1000);
              resolve(this.accessToken!);
            }
          },
        });
        
        // Use prompt: 'none' for non-interactive attempts to prevent logon boxes
        client.requestAccessToken({ prompt: interactive ? '' : 'none' });
      } catch (e) {
        reject(e);
      }
    });
  }

  async findMirrorFile(): Promise<string | null> {
    const token = await this.authorize(false);
    const query = encodeURIComponent(`name = '${SYNC_FILE_NAME}' and spaces = 'appDataFolder'`);
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  }

  async uploadMirror(): Promise<number> {
    const token = await this.authorize(false);
    const fileId = await this.findMirrorFile();
    const everything = await storage.getEverything();
    const lastUpdated = Date.now();
    const payload = {
      version: '2.0',
      lastUpdated,
      data: everything
    };

    const metadata = {
      name: SYNC_FILE_NAME,
      parents: ['appDataFolder']
    };

    const boundary = 'foo_bar_baz';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const body =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(payload) +
      closeDelimiter;

    const url = fileId 
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    
    const method = fileId ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    });

    if (!res.ok) throw new Error("Upload failed");

    return lastUpdated;
  }

  async downloadMirror(): Promise<{ lastUpdated: number; data: any } | null> {
    const token = await this.authorize(false);
    const fileId = await this.findMirrorFile();
    if (!fileId) return null;

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    if (!response.ok) return null;
    return await response.json();
  }

  async disconnect() {
    this.accessToken = null;
    this.tokenExpiry = 0;
    localStorage.removeItem('ironflow_sync_email_hint');
  }
}

export const ironSync = new IronSyncService();