import { Download, Upload, X, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { HistoricalLog } from '../types';
import { GeminiService } from '../services/GeminiService';

interface CSVManagerProps {
  history: HistoricalLog[];
  onImport: (newLogs: HistoricalLog[], mode: 'overwrite' | 'merge' | 'ignore') => void;
  onClose: () => void;
  aiService: GeminiService;
}

const CSVManager: React.FC<CSVManagerProps> = ({ history, onImport, onClose, aiService }) => {
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = () => {
    const headers = ["Date", "Exercise", "Category", "Weight", "Unit", "Reps"];
    const rows = history.map(h => [h.date, h.exercise, h.category, h.weight, h.unit, h.reps]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `IronFlow_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-3xl p-4 flex items-center justify-center animate-in fade-in duration-500">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-8 shadow-2xl">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
             <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400"><FileText size={24} /></div>
             <div>
                <h3 className="text-xl font-black text-slate-100">Data Management</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CSV Transfer Hub</p>
             </div>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-800 rounded-2xl text-slate-400"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-1 gap-4">
           <button onClick={handleExport} className="w-full p-6 bg-slate-950 border border-slate-800 rounded-3xl hover:border-emerald-500/40 transition-all flex items-center gap-6 group">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform"><Download size={24}/></div>
              <div className="text-left">
                 <h4 className="font-black text-slate-100 uppercase text-xs">Export to CSV</h4>
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{history.length} Session Logs</p>
              </div>
           </button>

           <div className="p-6 bg-slate-950 border border-slate-800 rounded-3xl opacity-50 cursor-not-allowed flex items-center gap-6">
              <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-600"><Upload size={24}/></div>
              <div className="text-left">
                 <h4 className="font-black text-slate-500 uppercase text-xs">Import from CSV</h4>
                 <p className="text-[10px] text-slate-700 font-bold uppercase tracking-widest mt-1">Experimental Feature</p>
              </div>
           </div>
        </div>

        <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 flex gap-3">
           <CheckCircle2 className="text-emerald-500 shrink-0" size={16} />
           <p className="text-[10px] text-slate-500 font-bold uppercase leading-relaxed">External CSV imports use AI to map legacy movements to our architectural library.</p>
        </div>
      </div>
    </div>
  );
};

export default CSVManager;
