import { Download, Upload, X, FileText, Calendar, Filter, CheckCircle2, AlertTriangle, RefreshCw, ChevronRight, Search, FileUp, Database, Sparkles, Loader2, ArrowRight, Plus } from 'lucide-react';
import React, { useState, useMemo, useRef } from 'react';
import { HistoricalLog, ExerciseLibraryItem } from '../types';
import { GeminiService } from '../services/geminiService';
import { DEFAULT_LIBRARY } from './ExerciseLibrary';

interface CSVManagerProps {
  history: HistoricalLog[];
  onImport: (newLogs: HistoricalLog[], mode: 'overwrite' | 'merge' | 'ignore') => void;
  onClose: () => void;
  aiService: GeminiService;
}

interface MappingConflict {
  importedName: string;
  matches: string[];
  isNew: boolean;
  suggestedStandardName: string;
  suggestedCategory: string;
  selectedMapping?: string;
}

const CSV_HEADER = "Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time";

const CSVManager: React.FC<CSVManagerProps> = ({ history, onImport, onClose, aiService }) => {
  const [view, setView] = useState<'main' | 'import' | 'export'>('main');
  const [importStage, setImportStage] = useState<'upload' | 'mapping' | 'conflict' | 'success'>('upload');
  const [stagedLogs, setStagedLogs] = useState<HistoricalLog[]>([]);
  const [conflictingDates, setConflictingDates] = useState<string[]>([]);
  const [mappings, setMappings] = useState<MappingConflict[]>([]);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Library lookup
  const fullLibrary = useMemo(() => {
    const custom: ExerciseLibraryItem[] = JSON.parse(localStorage.getItem('ironflow_library') || '[]');
    return [...DEFAULT_LIBRARY, ...custom];
  }, []);

  const libraryNames = useMemo(() => fullLibrary.map(l => l.name), [fullLibrary]);

  const processFile = async (file: File) => {
    if (!file) return;
    
    setImportStage('mapping');
    setIsProcessingAI(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        const parsed: HistoricalLog[] = [];
        const uniqueImportedNames = new Set<string>();

        lines.slice(1).forEach((line) => {
          if (!line.trim()) return;
          const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          if (parts.length < 3) return;

          const clean = (val: string) => val ? val.trim().replace(/^"|"$/g, '') : '';
          const log: HistoricalLog = {
            date: clean(parts[0]),
            exercise: clean(parts[1]),
            category: clean(parts[2]) || 'Other',
            weight: parseFloat(clean(parts[3])) || 0,
            unit: clean(parts[4]) || 'kgs',
            reps: parseInt(clean(parts[5])) || 0
          };

          if (log.date && log.exercise) {
            parsed.push(log);
            uniqueImportedNames.add(log.exercise);
          }
        });

        if (parsed.length === 0) {
          alert("No valid workout data found in this CSV.");
          setImportStage('upload');
          setIsProcessingAI(false);
          return;
        }

        setStagedLogs(parsed);

        // --- TIER 1: HEURISTIC PRE-CHECK ---
        // Efficiently filter out items that already have high-confidence local matches
        const importedArray = Array.from(uniqueImportedNames);
        const heuristicMatches: MappingConflict[] = [];
        const needsAiRefinement: string[] = [];

        importedArray.forEach(importedName => {
          // Exact match (case insensitive)
          const exactMatch = fullLibrary.find(l => l.name.toLowerCase() === importedName.toLowerCase());
          
          if (exactMatch) {
            heuristicMatches.push({
              importedName,
              matches: [exactMatch.name],
              isNew: false,
              suggestedStandardName: exactMatch.name,
              suggestedCategory: exactMatch.category,
              selectedMapping: exactMatch.name
            });
          } else {
            needsAiRefinement.push(importedName);
          }
        });

        // --- TIER 2: AI REFINEMENT ---
        let aiMatches: MappingConflict[] = [];
        if (needsAiRefinement.length > 0) {
          const rawAiResults = await aiService.matchExercisesToLibrary(
            needsAiRefinement,
            libraryNames
          );
          
          aiMatches = rawAiResults.map(m => ({
            ...m,
            selectedMapping: m.matches.length === 1 ? m.matches[0] : (m.isNew ? 'NEW' : undefined)
          }));
        }

        // Combine Tiers
        setMappings([...heuristicMatches, ...aiMatches]);

      } catch (err) {
        console.error("CSV Parse Error:", err);
        alert("Failed to read CSV file.");
        setImportStage('upload');
      } finally {
        setIsProcessingAI(false);
      }
    };
    reader.onerror = () => {
      alert("Error reading file.");
      setImportStage('upload');
      setIsProcessingAI(false);
    };
    reader.readAsText(file);
  };

  const finalizeMapping = async () => {
    const missing = mappings.filter(m => !m.selectedMapping);
    if (missing.length > 0) {
      alert(`Please select a match for: ${missing.map(m => m.importedName).join(', ')}`);
      return;
    }

    const customLibrary: ExerciseLibraryItem[] = JSON.parse(localStorage.getItem('ironflow_library') || '[]');
    let libraryUpdated = false;
    const mappingTable: Record<string, string> = {};

    for (const m of mappings) {
      if (m.selectedMapping === 'NEW') {
        const alreadyExists = customLibrary.some(l => l.name === m.suggestedStandardName) || DEFAULT_LIBRARY.some(l => l.name === m.suggestedStandardName);
        if (!alreadyExists) {
          const newItem: ExerciseLibraryItem = {
            name: m.suggestedStandardName,
            category: m.suggestedCategory,
            muscles: [],
            instructions: ["Imported from CSV"],
            benefits: "Unknown",
            risks: "Unknown"
          };
          customLibrary.push(newItem);
          libraryUpdated = true;
          mappingTable[m.importedName] = newItem.name;
        } else {
          mappingTable[m.importedName] = m.suggestedStandardName;
        }
      } else if (m.selectedMapping) {
        mappingTable[m.importedName] = m.selectedMapping;
      }
    }

    if (libraryUpdated) {
      localStorage.setItem('ironflow_library', JSON.stringify(customLibrary));
    }

    const mappedLogs = stagedLogs.map(log => ({
      ...log,
      exercise: mappingTable[log.exercise] || log.exercise
    }));

    const newDates = new Set(mappedLogs.map(l => l.date));
    const existingDates = new Set(history.map(h => h.date));
    const conflicts = Array.from(newDates).filter(d => existingDates.has(d));

    setStagedLogs(mappedLogs);
    if (conflicts.length > 0) {
      setConflictingDates(conflicts);
      setImportStage('conflict');
    } else {
      onImport(mappedLogs, 'merge');
      setImportStage('success');
    }
  };

  const toggleMappingChoice = (importedName: string, choice: string) => {
    setMappings(prev => prev.map(m => 
      m.importedName === importedName ? { ...m, selectedMapping: choice } : m
    ));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (e.target) e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.csv')) {
      processFile(file);
    } else {
      alert("Please drop a valid CSV file.");
    }
  };

  const executeImport = (mode: 'overwrite' | 'merge' | 'ignore') => {
    onImport(stagedLogs, mode);
    setImportStage('success');
  };

  const handleExport = () => {
    const csvRows = [CSV_HEADER];
    history.forEach(h => {
      csvRows.push(`${h.date},"${h.exercise}","${h.category}",${h.weight},${h.unit},${h.reps},,,`);
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    const now = new Date();
    const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    a.setAttribute('download', `ironflow_export_${today}.csv`);
    a.click();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-3xl p-4 sm:p-8 flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col h-[85vh] shadow-2xl overflow-hidden relative">
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept=".csv,text/csv" 
          className="hidden" 
        />

        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-100 flex items-center gap-3">
              <Database className="text-emerald-400" />
              Data Manager
            </h2>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Smart Sync Workflow</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-900 hover:bg-slate-700 rounded-2xl text-slate-400 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {view === 'main' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full items-center">
              <button onClick={() => setView('import')} className="flex flex-col items-center justify-center p-10 bg-slate-950/50 border border-slate-800 rounded-[2rem] hover:border-emerald-500/30 group transition-all">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="text-emerald-400" size={32} />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight">Import CSV</h3>
                <p className="text-xs text-slate-500 text-center mt-2">Smart Exercise Matching</p>
              </button>
              <button onClick={handleExport} className="flex flex-col items-center justify-center p-10 bg-slate-950/50 border border-slate-800 rounded-[2rem] hover:border-emerald-500/30 group transition-all">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Download className="text-emerald-400" size={32} />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight">Export CSV</h3>
                <p className="text-xs text-slate-500 text-center mt-2">Full History Backup</p>
              </button>
            </div>
          )}

          {view === 'import' && (
            <div className="h-full flex flex-col">
              {importStage === 'upload' && (
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex-1 flex flex-col items-center justify-center border-4 border-dashed rounded-[3rem] py-20 space-y-6 transition-all ${isDragging ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-800'}`}
                >
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isDragging ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                    <FileUp size={40} />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-300">Drop your CSV file here</p>
                    <p className="text-[10px] text-slate-600 uppercase tracking-widest mt-1">Two-tier validation active</p>
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="px-8 py-4 bg-emerald-500 text-slate-950 font-black rounded-2xl uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                    Browse Files
                  </button>
                </div>
              )}

              {importStage === 'mapping' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl flex gap-4 items-center">
                    {isProcessingAI ? <Loader2 className="text-emerald-400 animate-spin" /> : <Sparkles className="text-emerald-400" />}
                    <div>
                      <h4 className="font-black text-emerald-400 uppercase text-xs">Matching Protocol</h4>
                      <p className="text-xs text-slate-400 mt-1">{isProcessingAI ? "Analyzing obscure brand names with Google Search..." : `Validated ${mappings.length} movements found in CSV.`}</p>
                    </div>
                  </div>

                  {!isProcessingAI && (
                    <div className="space-y-4">
                      {mappings.map((m, idx) => (
                        <div key={idx} className="bg-slate-950/50 border border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">From CSV</p>
                            <h5 className="font-black text-slate-200 truncate">{m.importedName}</h5>
                          </div>
                          
                          <ArrowRight className="text-slate-700 hidden sm:block" size={16} />

                          <div className="flex-[1.5] flex flex-wrap gap-2">
                            {m.matches.map(match => (
                              <button 
                                key={match}
                                onClick={() => toggleMappingChoice(m.importedName, match)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${m.selectedMapping === match ? 'bg-emerald-500 border-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                              >
                                {match}
                              </button>
                            ))}
                            <button 
                              onClick={() => toggleMappingChoice(m.importedName, 'NEW')}
                              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${m.selectedMapping === 'NEW' ? 'bg-cyan-500 border-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-cyan-400'}`}
                            >
                              <Plus size={12} />
                              Add New: {m.suggestedStandardName}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!isProcessingAI && (
                    <button 
                      onClick={finalizeMapping}
                      className="w-full py-5 bg-emerald-500 text-slate-950 font-black rounded-3xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-sm"
                    >
                      <CheckCircle2 size={20} />
                      Verify Mapping & Sync
                    </button>
                  )}
                </div>
              )}

              {importStage === 'conflict' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-3xl flex gap-4">
                    <AlertTriangle className="text-amber-500 shrink-0" size={24} />
                    <div>
                      <h4 className="font-black text-amber-500 uppercase text-sm tracking-tight">Date Collisions Detected</h4>
                      <p className="text-xs text-slate-400 mt-1">{conflictingDates.length} days already have logs.</p>
                    </div>
                  </div>
                  
                  <div className="grid gap-3">
                    <button onClick={() => executeImport('merge')} className="w-full p-6 bg-slate-950/50 border border-slate-800 rounded-3xl text-left hover:border-emerald-500/30 transition-all flex items-center justify-between group">
                      <div>
                        <p className="font-black text-slate-200 uppercase text-xs">Merge Records (Recommended)</p>
                        <p className="text-[10px] text-slate-500 mt-1">Append new logs to existing ones.</p>
                      </div>
                      <ChevronRight className="text-slate-700 group-hover:text-emerald-400" size={18} />
                    </button>
                    <button onClick={() => executeImport('overwrite')} className="w-full p-6 bg-slate-950/50 border border-slate-800 rounded-3xl text-left hover:border-rose-500/30 transition-all flex items-center justify-between group">
                      <div>
                        <p className="font-black text-slate-200 uppercase text-xs">Overwrite (Dangerous)</p>
                        <p className="text-[10px] text-slate-500 mt-1">Replace existing history with CSV data.</p>
                      </div>
                      <ChevronRight className="text-slate-700 group-hover:text-rose-400" size={18} />
                    </button>
                  </div>
                </div>
              )}

              {importStage === 'success' && (
                <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-6 text-center animate-in zoom-in-95">
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center border-4 border-emerald-500/40">
                    <CheckCircle2 className="text-emerald-400" size={40} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-100 uppercase tracking-tight">Sync Success</h3>
                    <p className="text-sm text-slate-500 mt-2">Two-tier mapping complete. History updated.</p>
                  </div>
                  <button onClick={onClose} className="px-10 py-4 bg-slate-800 text-slate-300 font-bold rounded-2xl hover:bg-slate-700 transition-all">
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {view !== 'main' && importStage !== 'success' && (
          <div className="p-6 border-t border-slate-800 bg-slate-900/50 shrink-0">
            <button 
              onClick={() => { setView('main'); setImportStage('upload'); setStagedLogs([]); setMappings([]); }}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
            >
              <RefreshCw size={14} />
              Reset Process
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CSVManager;