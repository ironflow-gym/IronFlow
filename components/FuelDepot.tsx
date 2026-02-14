import React, { useState } from 'react';
import { Coffee, Flame, Zap, Shield, Send, Loader2, Bot, Save, X, Edit3 } from 'lucide-react';
import { FuelLog, FuelProfile, BiometricEntry, UserSettings } from '../types';
import { GeminiService } from '../services/GeminiService';

interface FuelDepotProps {
  history: FuelLog[];
  profile: FuelProfile;
  onSaveFuel: (history: FuelLog[]) => void;
  onSaveProfile: (profile: FuelProfile) => void;
  biometricHistory: BiometricEntry[];
  aiService: GeminiService;
  userSettings: UserSettings;
}

const FuelDepot: React.FC<FuelDepotProps> = ({ history, profile, onSaveFuel, onSaveProfile, biometricHistory, aiService, userSettings }) => {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const handleNarrativeFuel = async () => {
    if (!prompt.trim()) return;
    setIsProcessing(true);
    try {
      const { logs, updatedProfile } = await aiService.parseFuelPrompt(prompt, profile);
      onSaveFuel([...logs, ...history]);
      if (updatedProfile) onSaveProfile(updatedProfile);
      setPrompt('');
    } catch (e) {
      alert("Metabolic synthesis failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl space-y-6">
        <div className="flex justify-between items-center">
           <div className="flex items-center gap-4">
              <div className="p-2.5 bg-[#fb923c]/10 rounded-xl text-[#fb923c] border border-[#fb923c]/20"><Coffee size={24} /></div>
              <div><h3 className="text-xl font-black text-slate-100">Fuel Depot</h3><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Metabolic Logistics</p></div>
           </div>
           <button onClick={() => setIsEditingProfile(!isEditingProfile)} className="p-3 bg-slate-800 rounded-2xl text-slate-400 hover:text-[#fb923c] transition-all"><Edit3 size={20}/></button>
        </div>

        <div className="relative">
           <textarea 
             value={prompt}
             onChange={(e) => setPrompt(e.target.value)}
             placeholder="Narrate your intake... 'A large chicken salad with avocado and 500ml of protein shake.'"
             className="w-full h-32 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-[#fb923c]/30 resize-none transition-all placeholder:text-slate-900"
           />
           <button 
             onClick={handleNarrativeFuel}
             disabled={isProcessing || !prompt.trim()}
             className="absolute bottom-4 right-4 p-4 bg-[#fb923c] text-slate-950 rounded-2xl shadow-xl shadow-[#fb923c]/20 active:scale-95 transition-all disabled:opacity-50"
           >
             {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
           </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-1">
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Intake Goal</p>
              <h4 className="text-sm font-black text-slate-100">{profile.goal}</h4>
           </div>
           <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-1">
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Logs Processed</p>
              <h4 className="text-sm font-black text-slate-100">{history.length} Entries</h4>
           </div>
        </div>
      </div>

      <div className="space-y-4">
         <h3 className="text-standard-label text-slate-500 px-2 flex items-center justify-between">
            <span>Historical Logistics</span>
            <span className="text-[#fb923c]/50">Fuel Timeline</span>
         </h3>
         <div className="space-y-3">
            {history.slice(0, 10).map((log, i) => (
              <div key={log.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center justify-between">
                 <div>
                    <p className="text-sm font-black text-slate-100">{log.name}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{log.calories} kcal • P: {log.protein}g C: {log.carbs}g F: {log.fats}g</p>
                 </div>
                 <div className="text-[10px] font-black text-slate-700 uppercase tracking-tighter">{log.date}</div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};

export default FuelDepot;
