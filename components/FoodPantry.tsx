import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, Plus, Trash2, Edit3, Camera, Globe, Loader2, Database, ArrowRight, ShieldCheck, CheckCircle2, Sliders, Box, Layers, Save, Wand2, Maximize2 } from 'lucide-react';
import { FoodItem, FuelProfile } from '../types';
import { GeminiService } from '../services/geminiService';
import { storage } from '../services/storageService';

interface FoodPantryProps {
  onClose: () => void;
  aiService: GeminiService;
  fuelProfile?: FuelProfile;
}

const FoodPantry: React.FC<FoodPantryProps> = ({ onClose, aiService, fuelProfile }) => {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState<FoodItem | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  // AFCD food search
  const [afcdQuery, setAfcdQuery] = useState('');
  const [afcdResults, setAfcdResults] = useState<FoodItem[]>([]);
  const [isSearchingAfcd, setIsSearchingAfcd] = useState(false);
  const [showAfcdSearch, setShowAfcdSearch] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const load = async () => {
      const stored = await storage.get<FoodItem[]>('ironflow_pantry');
      if (stored) setItems(stored);
    };
    load();
  }, []);

  // Auto-reset delete confirmation after 3 seconds
  useEffect(() => {
    let timeout: number;
    if (confirmingDeleteId) {
      timeout = window.setTimeout(() => setConfirmingDeleteId(null), 3000);
    }
    return () => clearTimeout(timeout);
  }, [confirmingDeleteId]);

  const saveItems = async (newItems: FoodItem[]) => {
    setItems(newItems);
    await storage.set('ironflow_pantry', newItems);
  };

  const filteredItems = useMemo(() => {
    return items.filter(i => 
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      i.brand?.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
  }, [items, searchQuery]);

  const handleManualAdd = () => {
    const newItem: FoodItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Item',
      servingSize: '100g',
      protein: 0,
      carbs: 0,
      fats: 0,
      calories: 0
    };
    setIsEditing(newItem);
  };

  const handleSaveEdit = () => {
    if (!isEditing) return;
    const exists = items.find(i => i.id === isEditing.id);
    if (exists) {
      saveItems(items.map(i => i.id === isEditing.id ? isEditing : i));
    } else {
      saveItems([...items, isEditing]);
    }
    setIsEditing(null);
  };

  const handleDelete = (itemId: string) => {
    if (confirmingDeleteId === itemId) {
      saveItems(items.filter(i => i.id !== itemId));
      setConfirmingDeleteId(null);
    } else {
      setConfirmingDeleteId(itemId);
    }
  };

  const startCamera = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      alert("Camera blocked.");
      setIsScanning(false);
    }
  };

  const captureAndParse = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx?.drawImage(videoRef.current, 0, 0);
    const data = canvasRef.current.toDataURL('image/jpeg');
    
    setStatus("Analyzing Nutrition Panel...");
    try {
      const result = await aiService.analyzeNutritionPanel(data);
      const newItem: FoodItem = {
        id: Math.random().toString(36).substr(2, 9),
        name: result.name || 'Scanned Item',
        brand: result.brand,
        servingSize: result.servingSize || '100g',
        protein: result.protein || 0,
        carbs: result.carbs || 0,
        fats: result.fats || 0,
        calories: result.calories || 0
      };
      setIsEditing(newItem);
      stopCamera();
    } catch (e) {
      alert("Laboratory Scan Failed. Please ensure the label is clear and try again.");
    } finally {
      setStatus(null);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    setIsScanning(false);
  };

  const handleWebImport = async () => {
    if (!importUrl.trim()) return;
    setIsImporting(true);
    setStatus("Scraping Site Data...");
    try {
      const newItems = await aiService.scrapeFoodSite(importUrl);
      saveItems([...items, ...newItems]);
      setImportUrl('');
      alert(`Imported ${newItems.length} items to Pantry.`);
    } catch (e) {
      alert("Web import failed.");
    } finally {
      setIsImporting(false);
      setStatus(null);
    }
  };

  const handleAfcdSearch = async () => {
    if (!afcdQuery.trim()) return;
    setIsSearchingAfcd(true);
    setAfcdResults([]);
    try {
      const results = await aiService.searchAFCD(afcdQuery, fuelProfile?.region);
      if (results.length === 0) {
        setStatus('No results found. Try a different search term.');
        setTimeout(() => setStatus(null), 3000);
      }
      setAfcdResults(results);
    } catch (e: any) {
      setStatus('Search failed. Check your connection.');
      setTimeout(() => setStatus(null), 3000);
    } finally {
      setIsSearchingAfcd(false);
    }
  };

  const addAfcdItem = (item: FoodItem) => {
    saveItems([...items, { ...item, id: Math.random().toString(36).substr(2, 9) }]);
    setAfcdResults(prev => prev.filter(r => r.id !== item.id));
  };

  return (
    <div className="fixed inset-0 z-[160] bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-500">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-[3rem] flex flex-col h-[90vh] shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-2xl border border-orange-500/20"><Database className="text-orange-400" size={24} /></div>
            <div>
              <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tighter">Neural Pantry</h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Source of Truth Registry</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 transition-all"><X size={20} /></button>
        </div>

        {/* Toolbar */}
        <div className="p-6 bg-slate-950/30 border-b border-slate-800 flex flex-col sm:flex-row gap-4 shrink-0">
          <div className="relative flex-1">
            <input 
              type="text" 
              placeholder="Search local database..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3.5 pl-12 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-orange-500/30 transition-all placeholder:text-slate-700"
            />
            <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-700" size={18} />
          </div>
          <div className="flex gap-2">
            <button onClick={startCamera} className="p-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl border border-slate-700 active:scale-95 transition-all" title="Scan Label"><Camera size={20}/></button>
            <button onClick={() => { setShowAfcdSearch(!showAfcdSearch); setAfcdResults([]); setAfcdQuery(''); }} className={`p-3.5 rounded-2xl border active:scale-95 transition-all ${showAfcdSearch ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'}`} title="Search Food Database (AFCD)"><Database size={20}/></button>
            <button onClick={() => setImportUrl(importUrl ? '' : 'https://')} className={`p-3.5 rounded-2xl border active:scale-95 transition-all ${importUrl ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'}`} title="Import from URL"><Globe size={20}/></button>
            <button onClick={handleManualAdd} className="px-6 py-3.5 bg-orange-500 text-slate-950 font-black rounded-2xl uppercase tracking-widest text-xs flex items-center gap-2 shadow-lg shadow-orange-500/10 active:scale-95 transition-all"><Plus size={18}/> Manual Add</button>
          </div>
        </div>

        {/* AFCD Food Database Search Bar — compact inline, results in overlay */}
        {showAfcdSearch && (
          <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-800 animate-in slide-in-from-top-2">
            <div className="flex gap-3 items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={afcdQuery}
                  onChange={e => setAfcdQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAfcdSearch()}
                  placeholder="e.g. chicken breast, rolled oats, Vegemite..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 pl-10 text-xs font-bold text-slate-100 outline-none focus:ring-1 focus:ring-orange-500/30"
                />
                <Database className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
              </div>
              <button
                onClick={handleAfcdSearch}
                disabled={isSearchingAfcd || !afcdQuery.trim()}
                className="px-5 py-2.5 bg-orange-500 text-slate-950 font-black rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-50 flex items-center gap-2 shrink-0"
              >
                {isSearchingAfcd ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}
                {isSearchingAfcd ? 'Searching...' : 'Search'}
              </button>
            </div>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-2">AFCD official database · branded foods via Open Food Facts · all values per 100g</p>
          </div>
        )}

        {/* AFCD Results Overlay */}
        {afcdResults.length > 0 && (
          <>
            <div
              className="fixed inset-0 z-[170] bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setAfcdResults([])}
            />
            <div className="fixed inset-x-4 top-[12%] z-[180] max-w-lg mx-auto bg-slate-900 border-2 border-orange-500/30 rounded-[2.5rem] flex flex-col max-h-[76vh] shadow-2xl shadow-orange-500/10 animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center px-7 pt-6 pb-4 border-b border-slate-800 shrink-0">
                <div>
                  <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest">Search Results</h3>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">{afcdResults.length} matches for &ldquo;{afcdQuery}&rdquo;</p>
                </div>
                <button onClick={() => setAfcdResults([])} className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl transition-all"><X size={16} /></button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-2 custom-scrollbar">
                {afcdResults.map(item => (
                  <div key={item.id} className="flex items-center gap-3 bg-slate-800/60 border border-slate-700 rounded-2xl p-3.5 hover:border-orange-500/40 transition-all">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-100">{item.name}</p>
                      {item.brand && <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5 truncate">{item.brand}</p>}
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                        P {item.protein}g · C {item.carbs}g · F {item.fats}g · {item.calories}kcal
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                          (item as any).source === 'AFCD'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-blue-500/10 text-blue-400'
                        }`}>{(item as any).source === 'AFCD' ? 'AFCD' : 'Product Label'}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => addAfcdItem(item)}
                      className="p-2.5 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-xl hover:bg-orange-500 hover:text-slate-950 transition-all shrink-0"
                    ><Plus size={16} /></button>
                  </div>
                ))}
              </div>
              <div className="px-7 py-4 border-t border-slate-800 shrink-0">
                <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest text-center">Tap anywhere outside to dismiss · all values per 100g</p>
              </div>
            </div>
          </>
        )}

        {/* Web Import Panel */}
        {importUrl && (
          <div className="p-6 bg-slate-800/50 border-b border-slate-800 animate-in slide-in-from-top-2">
            <div className="flex gap-4">
              <input 
                type="text" 
                value={importUrl} 
                onChange={(e) => setImportUrl(e.target.value)} 
                placeholder="https://site.com/food-data"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-xs font-bold text-slate-100"
              />
              <button 
                onClick={handleWebImport} 
                disabled={isImporting}
                className="px-6 py-2 bg-emerald-500 text-slate-950 font-black rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-50"
              >
                {isImporting ? <Loader2 className="animate-spin" size={14}/> : 'Import Data'}
              </button>
              <button onClick={() => setImportUrl('')} className="p-2 text-slate-500"><X size={18}/></button>
            </div>
            <p className="text-[9px] text-slate-500 mt-2 font-black uppercase tracking-widest italic">Paste a supermarket product page or branded food URL · AI extracts nutrition panel data per 100g</p>
          </div>
        )}

        {/* Pantry Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar bg-slate-950/20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(item => (
              <div key={item.id} className="bg-slate-900/60 border border-slate-800 rounded-[2rem] p-6 group hover:border-orange-500/30 transition-all flex flex-col justify-between shadow-xl">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="min-w-0">
                      <h4 className="font-black text-slate-100 truncate uppercase tracking-tight">{item.name}</h4>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">{item.brand || 'Common Entry'}</p>
                    </div>
                    <div className="flex gap-1 items-center">
                      <button onClick={() => setIsEditing(item)} className="p-2 text-slate-600 hover:text-orange-400 transition-all"><Edit3 size={16}/></button>
                      <button 
                        onClick={() => handleDelete(item.id)} 
                        className={`p-2 transition-all active:scale-90 rounded-lg ${
                          confirmingDeleteId === item.id 
                            ? 'text-rose-500 bg-rose-500/10 scale-110 opacity-100 animate-pulse' 
                            : 'text-slate-400 hover:text-rose-400 opacity-0 group-hover:opacity-100'
                        }`}
                        title={confirmingDeleteId === item.id ? "Tap again to confirm delete" : "Delete Registry Entry"}
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-4 mb-4">
                    <div className="flex flex-col"><span className="text-[9px] font-black text-cyan-500 uppercase tracking-widest">PRO</span><span className="text-sm font-black text-slate-200">{item.protein}g</span></div>
                    <div className="flex flex-col"><span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">CHO</span><span className="text-sm font-black text-slate-200">{item.carbs}g</span></div>
                    <div className="flex flex-col"><span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">FAT</span><span className="text-sm font-black text-slate-200">{item.fats}g</span></div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-800/50 flex justify-between items-center">
                  <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest">{item.calories} kcal • {item.servingSize}</span>
                  <div className="flex items-center gap-2">
                    {item.barcode && (
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-2 py-0.5 bg-slate-800 rounded-lg border border-slate-700" title={`Barcode: ${item.barcode}`}>
                        ▌▌ {item.barcode.slice(-4)}
                      </span>
                    )}
                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                      <div className="h-full bg-cyan-400" style={{ width: `${(item.protein * 4 / (item.calories || 1)) * 100}%` }} title="Protein" />
                      <div className="h-full bg-emerald-400" style={{ width: `${(item.carbs * 4 / (item.calories || 1)) * 100}%` }} title="Carbs" />
                      <div className="h-full bg-orange-400" style={{ width: `${(item.fats * 9 / (item.calories || 1)) * 100}%` }} title="Fats" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {filteredItems.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center py-20 opacity-20">
              <Database size={56} className="mb-6" />
              <p className="text-sm font-black uppercase tracking-widest">Neural Pantry Empty</p>
              <p className="text-xs mt-2 italic font-bold">Search, scan, or import items to build your truth source.</p>
            </div>
          )}
        </div>

        {/* Camera Overlay with Precision Viewport */}
        {isScanning && (
          <div className="absolute inset-0 z-[180] bg-black flex flex-col animate-in fade-in duration-300">
            <style>{`
              @keyframes scanning-beam {
                0% { top: 0%; opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { top: 100%; opacity: 0; }
              }
              .scanning-beam {
                position: absolute;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(to right, transparent, #fb923c, transparent);
                box-shadow: 0 0 15px #fb923c;
                animation: scanning-beam 2s linear infinite;
                z-index: 10;
              }
            `}</style>
            <video ref={videoRef} className="w-full h-full object-cover" playsInline />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Viewport Mask */}
            <div className="absolute inset-0 flex flex-col pointer-events-none">
              <div className="flex-1 bg-black/60" />
              <div className="flex h-[320px]">
                <div className="flex-1 bg-black/60" />
                <div className="w-[280px] relative border-2 border-orange-500/20">
                   {/* Viewport Brackets */}
                   <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500 rounded-tl-lg" />
                   <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500 rounded-tr-lg" />
                   <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500 rounded-bl-lg" />
                   <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500 rounded-br-lg" />
                   
                   {/* Active Beam */}
                   <div className="scanning-beam" />
                   
                   <div className="absolute inset-0 bg-orange-500/5" />
                </div>
                <div className="flex-1 bg-black/60" />
              </div>
              <div className="flex-1 bg-black/60 flex flex-col items-center pt-8">
                 <p className="text-white text-[11px] font-black uppercase tracking-[0.4em] bg-black/40 px-6 py-2 rounded-full backdrop-blur-md border border-white/10">Align Nutrition Label in Frame</p>
              </div>
            </div>

            <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center gap-12">
              <button onClick={stopCamera} className="p-5 bg-slate-900/80 backdrop-blur-md rounded-full text-white border border-white/10 hover:bg-slate-800 transition-all active:scale-90"><X size={24}/></button>
              <button onClick={captureAndParse} className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.2)] border-[8px] border-white/20 active:scale-95 transition-all">
                <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center">
                  <Camera size={32} className="text-white" />
                </div>
              </button>
              <div className="w-14" />
            </div>
          </div>
        )}

        {/* Editor Modal */}
        {isEditing && (
          <div className="absolute inset-0 z-[190] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4">
             <div className="w-full max-w-lg bg-slate-900 border border-orange-500/30 rounded-[2.5rem] p-8 shadow-2xl space-y-8 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Recalibrate Food</h3>
                  <button onClick={() => setIsEditing(null)} className="p-2 text-slate-500 hover:text-slate-300 transition-colors"><X size={24}/></button>
                </div>
                <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Product Name</label>
                        <input value={isEditing.name} onChange={(e) => setIsEditing({...isEditing, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 font-bold focus:ring-1 focus:ring-orange-500/40 outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Manufacturer</label>
                        <input value={isEditing.brand || ''} onChange={(e) => setIsEditing({...isEditing, brand: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 font-bold focus:ring-1 focus:ring-orange-500/40 outline-none" />
                      </div>
                   </div>
                   {/* Barcode field — optional, used for barcode scan lookup */}
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Barcode (EAN / UPC) — optional</label>
                     <input
                       type="text"
                       inputMode="numeric"
                       placeholder="e.g. 9300652014097"
                       value={isEditing.barcode || ''}
                       onChange={e => setIsEditing({ ...isEditing, barcode: e.target.value.trim() || undefined })}
                       className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 font-bold focus:ring-1 focus:ring-orange-500/40 outline-none placeholder:text-slate-700"
                     />
                     <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">When set, scanning this barcode in Fuel Depot will match directly to this pantry entry</p>
                   </div>
                   <div className="grid grid-cols-4 gap-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase text-center block">Portion</label>
                        <input value={isEditing.servingSize} onChange={(e) => setIsEditing({...isEditing, servingSize: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-xs font-black text-slate-100 outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-cyan-500 uppercase text-center block">Protein</label>
                        <input type="number" value={isEditing.protein} onChange={(e) => setIsEditing({...isEditing, protein: parseFloat(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-xs font-black text-slate-100 outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-emerald-500 uppercase text-center block">Carbs</label>
                        <input type="number" value={isEditing.carbs} onChange={(e) => setIsEditing({...isEditing, carbs: parseFloat(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-xs font-black text-slate-100 outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-orange-500 uppercase text-center block">Fats</label>
                        <input type="number" value={isEditing.fats} onChange={(e) => setIsEditing({...isEditing, fats: parseFloat(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-xs font-black text-slate-100 outline-none" />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 text-center block">Net Energy (Calories)</label>
                      <input type="number" value={isEditing.calories} onChange={(e) => setIsEditing({...isEditing, calories: parseFloat(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-center text-3xl font-black text-orange-400 outline-none focus:ring-1 focus:ring-orange-500/40" />
                   </div>
                </div>
                <button onClick={handleSaveEdit} className="w-full py-5 bg-orange-500 text-slate-950 font-black rounded-3xl uppercase tracking-widest text-sm flex items-center justify-center gap-3 shadow-xl shadow-orange-500/20 active:scale-95 transition-all"><Save size={20}/> Commit to Neural Pantry</button>
             </div>
          </div>
        )}

        {/* Global Loading Overlay */}
        {status && (
          <div className="absolute inset-0 z-[200] bg-slate-950/60 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
             <div className="relative mb-6">
                <div className="absolute inset-0 bg-orange-500/20 blur-3xl animate-pulse" />
                <Loader2 className="animate-spin text-orange-400 relative z-10" size={48} />
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-400 ai-loading-pulse">{status}</p>
          </div>
        )}

        <div className="px-8 py-4 bg-slate-950/60 border-t border-slate-800 flex justify-between items-center text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] shrink-0">
          <div className="flex items-center gap-2"><ShieldCheck size={12} className="text-emerald-500" /><span>Verified Local Source of Truth</span></div>
          <span>{items.length} Entries Registered</span>
        </div>
      </div>
    </div>
  );
};

export default FoodPantry;