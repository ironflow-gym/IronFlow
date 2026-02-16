
/**
 * IronFlow Storage Service v2.0
 * High-performance IndexedDB wrapper for the Neural Core.
 */

const DB_NAME = 'IronFlow_NeuralCore';
const STORE_NAME = 'vault';
const DB_VERSION = 1;

export class StorageService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    // Request persistent storage from browser
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      console.debug(`IronFlow Storage Persisted: ${isPersisted}`);
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        
        // Handle database being blocked by other tabs
        this.db.onversionchange = () => {
          this.db?.close();
          window.location.reload();
        };

        resolve();
      };

      request.onerror = () => {
        console.error("Neural Core initialization failed. Falling back to memory-only mode.");
        reject(new Error("IndexedDB Open Failed"));
      };

      request.onblocked = () => {
        alert("Database upgrade blocked. Please close other IronFlow tabs to continue.");
      };
    });
  }

  async get<T>(id: string): Promise<T | null> {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => resolve(null);
    });
  }

  async set<T>(id: string, value: T): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ id, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async remove(id: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllKeys(): Promise<string[]> {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => resolve([]);
    });
  }

  async clearAll(): Promise<void> {
    if (this.db) this.db.close();
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        console.warn("Database deletion blocked. Ensure all tabs are closed.");
        resolve();
      };
    });
  }

  /**
   * Performance helper for bulk operations
   */
  async setBulk(items: Record<string, any>): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      Object.entries(items).forEach(([id, value]) => {
        store.put({ id, value });
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export const storage = new StorageService();
