import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { StorageService } from '../services/storageService.ts';
import { BackupQueue } from '../services/backupQueue.ts';
import { validateBackup, backupCount } from '../src/backupRestore.ts';

const food = { id: 'meal', date: '2026-10-25', name: 'Toast', calories: 200, protein: 5, carbs: 30, fats: 7 };
function fixture() { globalThis.indexedDB = new IDBFactory(); return new StorageService(); }

test('older raw backups and Drive envelopes validate without inventing absent data', () => {
  const old = { ironflow_history: [], ironflow_fuel: [food] };
  assert.deepEqual(validateBackup(old), old);
  assert.deepEqual(validateBackup({ version: '2.0', lastUpdated: 12, data: old }), old);
  assert.equal(Object.hasOwn(validateBackup(old), 'ironflow_schedule'), false);
  assert.equal(backupCount(old, 'ironflow_schedule'), 0);
  assert.equal(backupCount({ ironflow_schedule: { appointments: [1, 2] } }, 'ironflow_schedule'), 2);
  assert.deepEqual(validateBackup({ ...old, __ironflow_restore_recovery: { private: true } }), old);
});

test('invalid or unrelated snapshots and malformed nested records are rejected before restore', () => {
  for (const input of [null, [], {}, { hello: 'world' }, { ironflow_fuel: null }, { ironflow_fuel: [{ ...food, protein: '5' }] }, { ironflow_saved_meals: [{ id: 's', name: 'Meal', foods: [null] }] }, { ironflow_schedule: { appointments: [{ id: 'a', date: '2026-02-30', kind: 'rest' }], exceptions: {}, completions: [] } }, { ironflow_templates: [{ name: 'Routine', exercises: [null] }] }]) {
    assert.throws(() => validateBackup(input), /Invalid backup/);
  }
});

test('recovery preserves the complete original device data; undo replaces later edits and is single-use', async () => {
  const store = fixture();
  const original = { ironflow_fuel: [food], ironflow_active_session: { id: 'unfinished' }, ironflow_settings: { units: 'imperial', ironSyncConnected: true }, ironflow_morphology_pending: { images: ['private-photo'] } };
  await store.setBulk(original);
  await store.restoreWithRecovery({ ironflow_history: [], ironflow_settings: { units: 'metric', ironSyncConnected: false } });
  assert.deepEqual(await store.getEverything(), { ironflow_history: [], ironflow_settings: original.ironflow_settings });
  assert.deepEqual((await store.getRestoreRecovery())?.data, original);
  assert.equal((await store.getBackupMetadata())?.pausedAfterRestore, true);
  await store.set('ironflow_fuel', [{ ...food, name: 'Later edit' }]);
  assert.equal((await store.getBackupMetadata())?.pausedAfterRestore, true);
  await store.restoreWithRecovery({}, true);
  assert.deepEqual(await store.getEverything(), original);
  assert.equal(await store.getRestoreRecovery(), null);
  assert.equal((await store.getBackupMetadata())?.pausedAfterRestore, true);
  await assert.rejects(store.restoreWithRecovery({}, true), /No recovery/);
  assert.deepEqual(await store.getEverything(), original);
});

test('recovery-copy or replacement failure aborts everything and preserves a previous undo copy', async () => {
  const store = fixture();
  await store.set('ironflow_fuel', [food]);
  await store.restoreWithRecovery({ ironflow_history: [] });
  const prior = await store.getRestoreRecovery();
  const metadata = await store.getBackupMetadata();
  const put = IDBObjectStore.prototype.put;
  try {
    for (const failKey of ['__ironflow_restore_recovery', 'ironflow_templates']) {
      IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
        if (args[0].id === failKey) throw new DOMException('Full', 'QuotaExceededError');
        return put.apply(this, args);
      };
      await assert.rejects(store.restoreWithRecovery({ ironflow_templates: [] }));
      assert.deepEqual(await store.getEverything(), { ironflow_history: [] });
      assert.deepEqual(await store.getRestoreRecovery(), prior);
      assert.deepEqual(await store.getBackupMetadata(), metadata);
    }
  } finally { IDBObjectStore.prototype.put = put; }
});

test('failed local edits block restore without dropping the retryable values', async () => {
  const store = fixture();
  await store.set('ironflow_fuel', [food]);
  const put = IDBObjectStore.prototype.put;
  try {
    IDBObjectStore.prototype.put = function () { throw new DOMException('Full', 'QuotaExceededError'); };
    await assert.rejects(store.set('ironflow_fuel', [{ ...food, name: 'Unsaved change' }]));
  } finally { IDBObjectStore.prototype.put = put; }
  await assert.rejects(store.restoreWithRecovery({ ironflow_history: [] }), /retry/);
  await store.retryFailedWrites();
  assert.equal((await store.get<any[]>('ironflow_fuel'))?.[0].name, 'Unsaved change');
});

test('post-restore pause survives queue recreation, reconnect and forced backup; explicit resume uploads', async () => {
  const store = fixture();
  await store.set('ironflow_fuel', [food]);
  await store.restoreWithRecovery({ ironflow_history: [] });
  let uploaded: any[] = [];
  const remote = { hasValidToken: () => true, refreshToken: async () => true, upload: async () => { uploaded.push(await store.getEverything()); return 42; } };
  const first = new BackupQueue(store, remote, 100000);
  first.configure(true, true, false); first.request(); await first.flush();
  assert.equal(first.getStatus().pausedAfterRestore, true);
  first.dispose();
  const next = new BackupQueue(store, remote, 100000);
  try {
    next.configure(true, false, false);
    await store.set('ironflow_fuel', [food]);
    next.configure(true, true, false); next.request(); await next.flush();
    assert.equal(uploaded.length, 0);
    await next.resumeAfterRestore(); await next.flush();
    assert.equal(uploaded.length, 1);
    assert.equal('__ironflow_restore_recovery' in uploaded[0], false);
    assert.equal('__ironflow_backup_state' in uploaded[0], false);
    assert.equal((await store.getBackupMetadata())?.pausedAfterRestore, false);
    assert.equal((await store.getBackupMetadata())?.pending, false);
  } finally { next.dispose(); }
});

test('restore waits for an upload already in progress and blocks new uploads', async () => {
  const store = fixture();
  await store.set('ironflow_history', []);
  let finish!: (time: number) => void;
  let count = 0;
  const queue = new BackupQueue(store, { hasValidToken: () => true, refreshToken: async () => true, upload: () => { count++; return new Promise(resolve => { finish = resolve; }); } }, 100000);
  try {
    queue.configure(true, true, false);
    const uploading = queue.flush();
    while (!finish) await new Promise(resolve => setImmediate(resolve));
    let ready = false;
    const pausing = queue.pauseAndWait().then(() => { ready = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(ready, false);
    finish(5); await uploading; await pausing;
    queue.configure(true, true, false); // React configuration cannot release the restore lock.
    await store.restoreWithRecovery({ ironflow_fuel: [food] });
    queue.request(); await queue.flush();
    assert.equal(count, 1);
  } finally { queue.dispose(); }
});
