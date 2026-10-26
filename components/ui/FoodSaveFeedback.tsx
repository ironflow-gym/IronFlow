import React, { useSyncExternalStore } from 'react';
import { storage } from '../../services/storageService';
import { dialogButton } from './Modal';
/** Surface the same durable save state inside the active food workflow. */
export default function FoodSaveFeedback() {
  const status = useSyncExternalStore(storage.subscribe, storage.getStatus);
  if (status.state === 'saved') return null;
  return <div className="w-full text-sm" aria-live="polite">
    {status.state === 'saving' ? <p>Saving on this device…</p> : <div className="space-y-2"><p role="alert" className="text-rose-200">Not saved — keep this tab open</p><button type="button" className={dialogButton} onClick={() => { void storage.retryFailedWrites().catch(() => {}); }}>Retry save</button></div>}
  </div>;
}
