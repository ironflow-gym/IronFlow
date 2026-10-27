import InfoButton from './ui/InfoButton';
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { storage, type RestoreRecovery } from '../services/storageService';
import { backupQueue } from '../services/backupService';
import { ironSync, type MirrorFileMeta } from '../services/ironSyncService';
import { backupCategories, backupCount, validateBackup } from '../src/backupRestore';
import Modal, { dialogButton, dialogPrimaryButton } from './ui/Modal';

interface Props { onClose: () => void; onRestoring?: (restoring: boolean) => void; }
interface Review { data: Record<string, any>; current: Record<string, any>; source: string; date?: number; undo?: boolean; }

export default function BackupManager({ onClose, onRestoring }: Props) {
  const [view, setView] = useState<'main' | 'picker' | 'review' | 'success'>('main');
  const [review, setReview] = useState<Review | null>(null);
  const [recovery, setRecovery] = useState<RestoreRecovery | null>(null);
  const [files, setFiles] = useState<MirrorFileMeta[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const save = useSyncExternalStore(storage.subscribe, storage.getStatus);
  const backup = useSyncExternalStore(backupQueue.subscribe, backupQueue.getStatus);
  useEffect(() => { void storage.getRestoreRecovery().then(setRecovery).catch(() => setError('Could not read the recovery copy. Try reopening Backup and restore.')); }, []);
  useEffect(() => {
    document.querySelector<HTMLElement>('dialog[aria-label="Backup and restore"] h2')?.focus({ preventScroll: true });
  }, [view]);
  const close = () => { if (!busy && view !== 'success') onClose(); };
  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label); setError('');
    try { await action(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Try again.'); }
    finally { setBusy(''); }
  };
  const stage = async (inputData: unknown, source: string, date?: number, undo = false) => {
    const data = undo ? (inputData as Record<string, any>) : validateBackup(inputData);
    const current = await storage.getEverything();
    setReview({ data, current, source, date, undo }); setView('review');
  };
  const exportFile = () => run('Creating JSON backup…', async () => {
    // Keep the existing raw JSON format and export scope unchanged.
    const keys = ['ironflow_history', 'ironflow_biometrics', 'ironflow_templates', 'ironflow_trash', 'ironflow_library', 'ironflow_deleted_exercises', 'ironflow_settings', 'ironflow_morphology', 'ironflow_fuel', 'ironflow_fuel_profile', 'ironflow_narrative_vault', 'ironflow_pantry', 'ironflow_schedule', 'ironflow_saved_meals', 'ironflow_blocks'];
    const snapshot = await storage.getEverything();
    const data = Object.fromEntries(keys.filter(key => snapshot[key] !== undefined).map(key => [key, snapshot[key]]));
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `IronFlow_Vault_${new Date().toISOString().split('T')[0]}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const chooseCloud = () => run('Finding Drive backups…', async () => {
    try {
      const found = await ironSync.listAllMirrorFiles(ironSync.getToken());
      if (!found.length) throw new Error('No IronFlow backups were found in Google Drive.');
      setFiles(found); setView('picker');
    } catch (e) {
      if (e instanceof Error && e.message.includes('no_token')) { ironSync.startAuthRedirect(); return; }
      throw e;
    }
  });
  const restore = () => run(review?.undo ? 'Undoing restore…' : 'Saving recovery copy and restoring…', async () => {
    if (!review) return;
    if (storage.getStatus().state !== 'saved') throw new Error('Save or retry your current changes before restoring.');
    onRestoring?.(true);
    try {
      await backupQueue.pauseAndWait();
      await storage.restoreWithRecovery(review.data, !!review.undo);
      await backupQueue.refreshRestorePause().catch(() => {});
      setView('success');
      // Keep App autosave blocked until reload; it still holds the old React state.
    } catch (e) { backupQueue.cancelRestorePause(); onRestoring?.(false); throw e; }
  });
  const footer = view === 'success' ? <button className={dialogPrimaryButton} onClick={() => window.location.reload()}>Continue to IronFlow</button> : <>
    {error && <p role="alert" className="w-full text-sm text-rose-300">{error}</p>}
    {busy && <p role="status" className="w-full text-sm text-slate-300">{busy}</p>}
    {save.state !== 'saved' && <div className="w-full text-sm text-amber-200" role="status">{save.state === 'saving' ? 'Saving current changes…' : <>Current changes are not saved. <button className={dialogButton} onClick={() => void run('Retrying save…', () => storage.retryFailedWrites())}>Retry save</button></>}</div>}
    {view === 'review' ? <><button disabled={!!busy} className={dialogButton} onClick={() => { setView('main'); setReview(null); setError(''); }}>Cancel</button><button disabled={!!busy || save.state !== 'saved'} className={dialogPrimaryButton} onClick={restore}>{review?.undo ? 'Undo restore' : 'Restore this backup'}</button></> : <button disabled={!!busy} className={dialogButton} onClick={view === 'picker' ? () => { setView('main'); setError(''); } : onClose}>{view === 'picker' ? 'Back' : 'Done'}</button>}
  </>;
  return <Modal label="Backup and restore" title={view === 'review' ? review?.undo ? 'Review undo restore' : 'Review backup' : view === 'success' ? review?.undo ? 'Restore undone' : 'Backup restored' : 'Backup and restore'} closeLabel="Close backup and restore" onClose={close} closeDisabled={!!busy || view === 'success'} footer={footer}>
    <input ref={input} type="file" accept=".json,application/json" className="hidden" aria-label="Choose JSON backup" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (file) void run('Checking backup…', async () => {
        let data: unknown;
        try { data = JSON.parse(await file.text()); } catch { throw new Error('This file is not valid JSON. Choose an IronFlow backup. No data has been changed.'); }
        await stage(data, file.name);
      });
    }} />
    {view === 'main' && <div className="space-y-5">
      <div className="flex items-center justify-between gap-2"><span className="text-sm text-slate-300">JSON files and Google Drive</span><InfoButton topic="backup" /></div>
      {backup.pausedAfterRestore && <section className="space-y-3 rounded-xl border border-amber-500/40 p-4">
        <h3 className="font-bold text-amber-200">Drive backups paused after restore</h3>
        <p className="text-sm text-slate-300">Local saving continues. Resume automatic backups when you are ready to upload the restored data.</p>
        <button disabled={!!busy || save.state !== 'saved'} className={dialogPrimaryButton} onClick={() => void run('Resuming Drive backups…', async () => {
          await backupQueue.resumeAfterRestore();
          const settings = await storage.get<{ ironSyncConnected?: boolean }>('ironflow_settings');
          if (!settings?.ironSyncConnected || !ironSync.hasValidToken()) ironSync.startAuthRedirect();
        })}>Back up restored data</button>
      </section>}
      <div className="grid gap-3">
        <button disabled={!!busy || save.state !== 'saved'} className={`${dialogButton} text-left`} onClick={exportFile}>Download JSON backup</button>
        <button disabled={!!busy} className={`${dialogButton} text-left`} onClick={() => input.current?.click()}>Restore from File</button>
        <button disabled={!!busy} className={`${dialogButton} text-left`} onClick={chooseCloud}>Restore from Google Drive</button>
      </div>
      {recovery && <section className="space-y-2 border-t border-slate-700 pt-4">
        <h3 className="font-bold">Undo last restore</h3>
        <p className="text-sm text-slate-300">Recover this device’s data from {new Date(recovery.createdAt).toLocaleString()}. This replaces any changes made since that restore.</p>
        <button disabled={!!busy} className={dialogButton} onClick={() => void run('Preparing recovery review…', () => stage(recovery.data, 'Local recovery copy', recovery.createdAt, true))}>Review undo restore</button>
      </section>}
    </div>}
    {view === 'picker' && <div className="space-y-3"><p className="text-sm text-slate-300">Choose a device backup to review.</p>{files.map(file => <button disabled={!!busy} key={file.driveFileId} className={`${dialogButton} w-full text-left`} onClick={() => void run('Checking Drive backup…', async () => {
      const downloaded = await ironSync.downloadMirrorById(file.driveFileId);
      if (!downloaded) throw new Error('Could not download this backup. Check your connection and try again.');
      await stage(downloaded, file.instanceName, downloaded.lastUpdated);
    })}><span className="block">{file.instanceName}{file.isCurrentDevice ? ' · This device' : ''}</span><span className="block text-sm font-normal text-slate-400">{file.lastUpdated ? new Date(file.lastUpdated).toLocaleString() : 'Backup date not recorded'}</span></button>)}</div>}
    {view === 'review' && review && <div className="space-y-4">
      <div><p className="break-words font-bold">{review.source}</p><p className="text-sm text-slate-400">{review.date ? new Date(review.date).toLocaleString() : 'Backup date not recorded in this file'}</p></div>
      <p className="rounded-xl border border-amber-500/40 p-3 text-sm text-amber-100">{review.undo ? 'Undo replaces the data on this device, including changes made since the restore. The recovery copy is used once.' : 'Restoring replaces the data on this device with this backup. Missing categories will be cleared. Device settings and the Google Drive connection stay unchanged.'}</p>
      {review.current.ironflow_active_session && <p className="text-sm text-amber-200">Your unfinished workout will be replaced. {review.undo ? 'It will not be kept in another recovery copy.' : 'It will be included in the recovery copy.'}</p>}
      <table className="w-full text-left text-sm"><caption className="sr-only">Current data compared with backup</caption><thead><tr className="border-b border-slate-700"><th className="py-2">Contents</th><th className="px-2 text-right">Device</th><th className="text-right">{review.undo ? 'Recovery' : 'Backup'}</th></tr></thead><tbody>{backupCategories.map(([name, key]) => <tr key={key} className="border-b border-slate-800"><th className="py-2 font-normal">{name}</th><td className="px-2 text-right">{backupCount(review.current, key)}</td><td className="text-right">{Object.hasOwn(review.data, key) ? backupCount(review.data, key) : <span className="text-amber-200">Missing</span>}</td></tr>)}</tbody></table>
      <p className="text-sm text-slate-300">“Missing” means this backup has no data for that category. Restoring clears that category on this device.</p>
      <details className="text-sm text-slate-300"><summary className="min-h-11 cursor-pointer py-3 font-bold">Other backup contents</summary><ul className="space-y-2">{[['Deleted routines', 'ironflow_trash'], ['Deleted exercises', 'ironflow_deleted_exercises'], ['Nutrition preferences', 'ironflow_fuel_profile'], ['Saved reviews', 'ironflow_narrative_vault'], ['Unfinished workout', 'ironflow_active_session']].map(([name, key]) => <li key={key}>{name}: {Object.hasOwn(review.data, key) ? 'Included' : 'Missing — cleared on restore'}</li>)}</ul></details>
      <p className="text-sm text-slate-300">{review.undo ? 'Drive backups stay paused after undo.' : 'A local recovery copy is saved first so you can undo this restore. It remains until you undo or restore another backup. Drive backups pause until you choose Back up restored data.'}</p>
    </div>}
    {view === 'success' && <div className="space-y-3"><p>{review?.undo ? 'Your previous device data has been recovered.' : 'Your backup has been restored. You can undo it from Backup and restore.'}</p><p className="text-sm text-slate-300">Continue to reload the app. Local saving will continue; automatic Drive backups remain paused.</p></div>}
  </Modal>;
}
