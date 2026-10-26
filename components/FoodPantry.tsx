import FoodSaveFeedback from './ui/FoodSaveFeedback';
import React, { useEffect, useRef, useState } from 'react';
import { FoodItem, FuelLog, FuelProfile } from '../types';
import { GeminiService } from '../services/geminiService';
import { basisLabel } from '../src/food';
import Modal, { dialogButton, dialogField, dialogPrimaryButton } from './ui/Modal';
import FoodDefinitionEditor from './FoodDefinitionEditor';
import FoodQuantityDialog from './FoodQuantityDialog';
import BarcodeScanner from './BarcodeScanner';
import { lookupBarcode } from '../services/openFoodFactsService';

export default function FoodPantry({ items, onSaveItems, onLog, onClose, aiService, fuelProfile }: {
  items: FoodItem[]; onSaveItems: (items: FoodItem[]) => void; onLog: (entry: FuelLog) => void;
  onClose: () => void; aiService: GeminiService; fuelProfile?: FuelProfile;
}) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<FoodItem | null>(null);
  const [logging, setLogging] = useState<FoodItem | null>(null);
  const [pendingLog, setPendingLog] = useState(false);
  const [deleting, setDeleting] = useState<FoodItem | null>(null);
  const [scanBarcode, setScanBarcode] = useState(false);
  const [databaseQuery, setDatabaseQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [cameraNotice, setCameraNotice] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const alive = useRef(true);
  const addButton = useRef<HTMLButtonElement>(null);
  const stopCamera = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setCameraOpen(false); };
  useEffect(() => { alive.current = true; return () => { alive.current = false; stream.current?.getTracks().forEach(track => track.stop()); }; }, []);
  const upsert = (food: FoodItem) => onSaveItems(items.some(item => item.id === food.id) ? items.map(item => item.id === food.id ? food : item) : [...items, food]);
  const chooseLog = (food: FoodItem) => {
    if (!food.nutritionBasis || food.missingNutrients?.length) { setPendingLog(true); setEditing(food); }
    else setLogging(food);
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setNotice('');
    try { await action(); } catch (e) { if (alive.current) setNotice((e as Error).message || 'Could not load food. Try again.'); }
    finally { if (alive.current) setBusy(false); }
  };
  const blank = (): FoodItem => ({ id: crypto.randomUUID(), name: '', servingSize: '', calories: 0, protein: 0, carbs: 0, fats: 0, missingNutrients: ['calories', 'protein', 'carbs', 'fats'], nutritionSource: 'manual' });
  const startCamera = async () => {
    setCameraOpen(true); setCameraNotice('Starting camera…');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (!alive.current || !video.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media; video.current.srcObject = media; await video.current.play(); setCameraNotice('Frame the nutrition label, then capture.');
    } catch { setCameraNotice('Camera unavailable. Check browser permissions, or enter the label manually.'); }
  };
  const capture = async () => {
    if (!video.current?.videoWidth) { setCameraNotice('Wait until the camera image is ready.'); return; }
    const canvas = document.createElement('canvas'); canvas.width = video.current.videoWidth; canvas.height = video.current.videoHeight;
    canvas.getContext('2d')?.drawImage(video.current, 0, 0); setImageBusy(true);
    try {
      const result = await aiService.analyzeNutritionPanel(canvas.toDataURL('image/jpeg'));
      if (alive.current && video.current) { stopCamera(); setEditing({ ...blank(), ...result, id: crypto.randomUUID(), nutritionSource: 'label', missingNutrients: ['calories', 'protein', 'carbs', 'fats'].filter(key => typeof result[key as keyof FoodItem] !== 'number') as FoodItem['missingNutrients'] }); }
    } catch (e) { if (alive.current) setCameraNotice((e as Error).message || 'Could not read the label. Try again.'); }
    finally { if (alive.current) setImageBusy(false); }
  };
  const suspended = !!editing || !!logging || !!deleting || scanBarcode || cameraOpen;
  return <>
    <Modal label="Food pantry" title="Food pantry" closeLabel="Close food pantry" onClose={onClose} suspended={suspended} wide footer={<><FoodSaveFeedback />{notice && <p role="status" className="w-full text-sm text-slate-200">{notice}</p>}<button ref={addButton} className={dialogPrimaryButton} onClick={() => { setPendingLog(false); setEditing(blank()); }}>Add pantry food</button></>}>
      <div className="space-y-4">
        <p className="text-sm text-slate-300">Choose a food to log. Check the label values before logging a food marked for review.</p>
        <label className="block">Find pantry food<input type="search" className={dialogField} value={query} onChange={e => setQuery(e.target.value)} /></label>
        <details className="rounded-xl border border-slate-700 p-3"><summary className="min-h-11 cursor-pointer py-3 font-bold">Find or import foods</summary>
          <div className="space-y-4 pt-2"><form className="space-y-3" onSubmit={event => { event.preventDefault(); void run(async () => { const foods = await aiService.searchAFCD(databaseQuery, fuelProfile?.region); if (alive.current) { setResults(foods); setNotice(foods.length ? `${foods.length} results. Review a food before adding it.` : 'No matches found. Try another name.'); } }); }}>
            <label className="block">Food database search<input className={dialogField} value={databaseQuery} onChange={e => setDatabaseQuery(e.target.value)} placeholder="For example, rolled oats" /></label>
            <button className={dialogButton} disabled={busy || !databaseQuery.trim()}>Search food database</button>
          </form>
          {results.map(food => <article key={food.id} className="rounded-xl border border-slate-700 p-3"><h3 className="break-words font-bold">{food.name}</h3><p className="my-2 text-sm text-slate-300">{basisLabel(food.nutritionBasis)} · {food.nutritionSource === 'database' ? 'Food database' : 'Product data'}</p><button className={dialogButton} aria-label={`Review ${food.name}`} onClick={() => { setPendingLog(false); setEditing(food); }}>Review food</button></article>)}
          <form className="space-y-3" onSubmit={event => { event.preventDefault(); void run(async () => { const foods = await aiService.scrapeFoodSite(url); if (alive.current) { setResults(foods); setNotice('Imported results are ready for review. Choose a food before adding it.'); } }); }}>
            <label className="block">Product page URL (AI)<input type="url" className={dialogField} value={url} onChange={e => setUrl(e.target.value)} /></label><button className={dialogButton} disabled={busy || !url.trim()}>Read product page</button>
          </form>
          <div className="flex flex-wrap gap-2"><button className={dialogButton} onClick={() => void startCamera()}>Scan nutrition label (AI)</button><button className={dialogButton} onClick={() => setScanBarcode(true)}>Find by barcode</button></div>
          {busy && <p role="status" className="text-sm text-slate-300">Loading food data…</p>}
        </div></details>
        {!items.length && <p className="text-slate-300">Your pantry is empty. Add a food manually or search the food database.</p>}
        {items.filter(food => `${food.name} ${food.brand ?? ''}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0)).map(food => <article key={food.id} className="space-y-3 rounded-xl border border-slate-700 p-4">
          <h3 className="break-words text-lg font-bold">{food.name}</h3>{food.brand && <p className="text-sm text-slate-300">{food.brand}</p>}
          <p className="text-sm text-slate-300">{basisLabel(food.nutritionBasis)}{food.servingSize ? ` · ${food.servingSize}` : ''}</p>
          <p className="text-sm text-slate-300">{(['calories', 'protein', 'carbs', 'fats'] as const).map(key => `${food.missingNutrients?.includes(key) ? 'Unknown' : food[key]} ${key === 'calories' ? 'kcal' : `g ${key}`}`).join(' · ')}</p>
          {!!food.missingNutrients?.length && <p className="text-sm text-amber-200">Some nutrition values need completion before logging.</p>}
          <div className="flex flex-wrap gap-2"><button className={dialogPrimaryButton} aria-label={`Log ${food.name}`} onClick={() => chooseLog(food)}>Log food</button>
            <details><summary className={`${dialogButton} cursor-pointer py-3`}>Options<span className="sr-only"> for {food.name}</span></summary><div className="mt-2 flex flex-wrap gap-2"><button className={dialogButton} aria-label={`Edit pantry ${food.name}`} onClick={() => { setPendingLog(false); setEditing(food); }}>Edit</button><button className={dialogButton} aria-label={`Delete pantry ${food.name}`} onClick={() => setDeleting(food)}>Delete</button></div></details>
          </div>
        </article>)}
        {!!items.length && !items.some(food => `${food.name} ${food.brand ?? ''}`.toLowerCase().includes(query.toLowerCase())) && <p>No matching pantry foods.</p>}
      </div>
    </Modal>
    {editing && <FoodDefinitionEditor item={editing} onClose={() => setEditing(null)} onSave={food => { upsert(food); setNotice(`Updated ${food.name}.`); if (pendingLog) setLogging(food); }} />}
    {logging && <FoodQuantityDialog item={logging} onClose={() => setLogging(null)} onLog={entry => { onLog(entry); upsert({ ...logging, lastUsed: Date.now() }); setNotice(`Added ${entry.name} to ${entry.date}.`); }} />}
    {deleting && <Modal label="Delete pantry food" title="Delete pantry food?" closeLabel="Cancel deleting pantry food" onClose={() => setDeleting(null)} footer={<><FoodSaveFeedback /><button className={dialogButton} onClick={() => setDeleting(null)}>Cancel</button><button className={`${dialogPrimaryButton} bg-rose-500 hover:bg-rose-400`} onClick={() => { onSaveItems(items.filter(food => food.id !== deleting.id)); setNotice(`Deleted ${deleting.name}. Existing food logs and saved meals were kept.`); setDeleting(null); requestAnimationFrame(() => addButton.current?.focus()); }}>Delete pantry food</button></>}><p>Delete “{deleting.name}” from the pantry? Existing food logs and saved meals will be kept.</p></Modal>}
    {scanBarcode && <BarcodeScanner onClose={() => setScanBarcode(false)} onDetected={code => { setScanBarcode(false); const match = items.find(food => food.barcode === code); if (match) chooseLog(match); else { void run(async () => { const result = await lookupBarcode(code); if (alive.current) { if (result.found) { setPendingLog(false); setEditing({ ...result.item, id: crypto.randomUUID() }); } else setNotice('No product found. Add the food manually from its label.'); } }); } }} />}
    {cameraOpen && <Modal label="Scan nutrition label" title="Scan nutrition label" closeLabel="Close nutrition label camera" onClose={stopCamera} footer={<button className={dialogPrimaryButton} disabled={imageBusy} onClick={() => void capture()}>{imageBusy ? 'Reading label…' : 'Capture label'}</button>}><video ref={video} className="w-full rounded-xl" playsInline muted /><p role="status" className="mt-3 text-sm text-slate-300">{cameraNotice}</p></Modal>}
  </>;
}
