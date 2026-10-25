import { BackupQueue } from './backupQueue';
import { storage } from './storageService';
import { ironSync } from './ironSyncService';

export const backupQueue = new BackupQueue(storage, {
  hasValidToken: () => ironSync.hasValidToken(),
  refreshToken: () => ironSync.trySilentRefresh(),
  upload: () => ironSync.uploadMirror(),
});
