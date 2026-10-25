import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { StorageService } from '../services/storageService.ts';
import { BackupQueue } from '../services/backupQueue.ts';

function fixture() {
  globalThis.indexedDB = new IDBFactory();
  const store = new StorageService();
  const uploads: Record<string, any>[] = [];
  const queue = new BackupQueue(store, {
    hasValidToken: () => true, refreshToken: async () => true,
    upload: async () => { uploads.push(await store.getEverything()); return 1234; },
  }, 100000);
  return { store, uploads, queue };
}

test('history and removal of the session draft commit before backup', async () => {
  const { store, uploads, queue } = fixture();
  try {
    await store.set('ironflow_active_session', { id: 'session-1' });
    queue.configure(true, true, false);
    const writing = store.setBulk({ ironflow_history: [{ exercise: 'Squat', reps: 8 }] }, ['ironflow_active_session']);
    await queue.flush();
    assert.equal(uploads.length, 0, 'never upload while saving');
    await writing;
    await queue.flush();
    assert.deepEqual(uploads[0].ironflow_history, [{ exercise: 'Squat', reps: 8 }]);
    assert.equal('ironflow_active_session' in uploads[0], false);
    assert.equal('__ironflow_backup_state' in uploads[0], false);
    assert.equal((await store.getBackupMetadata())?.pending, false);
  } finally { queue.dispose(); }
});

test('a transaction aborted after request success is rejected and can be retried', async () => {
  const { store, queue } = fixture();
  const original = IDBObjectStore.prototype.put;
  try {
    await store.set('history', ['original']);
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      const request = original.apply(this, args);
      if (args[0].id === 'history') request.addEventListener('success', () => this.transaction.abort());
      return request;
    };
    await assert.rejects(store.setBulk({ history: ['new'], templates: ['routine'] }));
    assert.deepEqual(await store.get('history'), ['original']);
    assert.equal(await store.get('templates'), null, 'failed batch is atomic');
    assert.equal(store.getStatus().state, 'error');
    IDBObjectStore.prototype.put = original;
    await store.retryFailedWrites();
    assert.deepEqual(await store.get('history'), ['new']);
    assert.deepEqual(await store.get('templates'), ['routine']);
    assert.equal(store.getStatus().state, 'saved');
  } finally { IDBObjectStore.prototype.put = original; queue.dispose(); }
});

test('a newer successful save supersedes a failed value', async () => {
  const { store, queue } = fixture();
  const original = IDBObjectStore.prototype.put;
  try {
    IDBObjectStore.prototype.put = function () { throw new DOMException('Full', 'QuotaExceededError'); };
    await assert.rejects(store.set('history', ['old failed value']));
    IDBObjectStore.prototype.put = original;
    await store.set('history', ['latest']);
    await store.retryFailedWrites();
    assert.deepEqual(await store.get('history'), ['latest']);
    assert.equal(store.getStatus().state, 'saved');
  } finally { IDBObjectStore.prototype.put = original; queue.dispose(); }
});

test('pending changes survive queue recreation and upload after reconnect', async () => {
  const { store, queue } = fixture();
  await store.set('history', ['offline workout']);
  queue.configure(true, false, false);
  await queue.flush();
  assert.equal((await store.getBackupMetadata())?.pending, true);
  queue.dispose();
  let uploaded = false;
  const resumed = new BackupQueue(store, {
    hasValidToken: () => true, refreshToken: async () => true,
    upload: async () => { uploaded = true; return 4321; },
  }, 100000);
  try {
    resumed.configure(true, true, false);
    await resumed.flush();
    assert.equal(uploaded, true);
    assert.equal((await store.getBackupMetadata())?.pending, false);
  } finally { resumed.dispose(); }
});

test('changes during an upload remain pending and concurrent uploads are prevented', async () => {
  const { store, queue } = fixture();
  queue.dispose();
  await store.set('history', ['first']);
  let finish!: (time: number) => void;
  let count = 0;
  const pending = new BackupQueue(store, {
    hasValidToken: () => true, refreshToken: async () => true,
    upload: () => { count++; return new Promise(resolve => { finish = resolve; }); },
  }, 100000);
  try {
    pending.configure(true, true, false);
    const uploading = pending.flush();
    while (!finish) await new Promise(resolve => setImmediate(resolve));
    await store.set('history', ['second']);
    await pending.flush();
    assert.equal(count, 1);
    finish(100);
    await uploading;
    assert.equal((await store.getBackupMetadata())?.pending, true);
    assert.equal(pending.getStatus().state, 'pending');
  } finally { pending.dispose(); }
});

test('failed uploads remain pending; restore remains exact and atomic', async () => {
  const { store, queue } = fixture();
  queue.dispose();
  const failing = new BackupQueue(store, {
    hasValidToken: () => true, refreshToken: async () => true,
    upload: async () => { throw new Error('Network down'); },
  }, 100000);
  try {
    await store.set('history', ['new']);
    failing.configure(true, true, false);
    await failing.flush();
    assert.equal(failing.getStatus().state, 'error');
    assert.equal((await store.getBackupMetadata())?.pending, true);
    failing.configure(true, true, true);
    await store.overwriteEverything({ history: ['restored'], pantry: ['oats'] });
    assert.deepEqual(await store.getEverything(), { history: ['restored'], pantry: ['oats'] });
    assert.equal(await store.getBackupMetadata(), null);
  } finally { failing.dispose(); }
});

test('expired authorization leaves data pending instead of dropping the backup', async () => {
  const { store, queue } = fixture();
  queue.dispose();
  let uploads = 0;
  const expired = new BackupQueue(store, {
    hasValidToken: () => false, refreshToken: async () => false,
    upload: async () => { uploads++; return 1; },
  }, 100000);
  try {
    await store.set('history', ['workout']);
    expired.configure(true, true, false);
    await expired.flush();
    assert.equal(uploads, 0);
    assert.equal(expired.getStatus().needsAuth, true);
    assert.equal((await store.getBackupMetadata())?.pending, true);
  } finally { expired.dispose(); }
});

test('retrying while a newer edit is saving cannot restore an older failed value', async () => {
  const { store, queue } = fixture();
  const original = IDBObjectStore.prototype.put;
  try {
    IDBObjectStore.prototype.put = function () { throw new DOMException('Full', 'QuotaExceededError'); };
    await assert.rejects(store.set('history', ['failed old edit']));
    IDBObjectStore.prototype.put = original;
    const newerSave = store.set('history', ['newest edit']);
    await store.retryFailedWrites();
    await newerSave;
    assert.deepEqual(await store.get('history'), ['newest edit']);
  } finally { IDBObjectStore.prototype.put = original; queue.dispose(); }
});

test('an aborted restore leaves all original records intact', async () => {
  const { store, queue } = fixture();
  const original = IDBObjectStore.prototype.put;
  try {
    await store.setBulk({ history: ['original'], templates: ['original template'] });
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      if (args[0].id === 'templates') throw new DOMException('Full', 'QuotaExceededError');
      return original.apply(this, args);
    };
    await assert.rejects(store.overwriteEverything({ history: ['replacement'], templates: ['replacement template'] }));
    assert.deepEqual(await store.getEverything(), { history: ['original'], templates: ['original template'] });
  } finally { IDBObjectStore.prototype.put = original; queue.dispose(); }
});
