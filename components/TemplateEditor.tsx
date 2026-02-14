import React, { useState } from 'react';
import { X, Bot, Sparkles, Plus, Trash2, Save, Wand2, Loader2, RefreshCcw } from 'lucide-react';
import { WorkoutTemplate, UserSettings } from '../types';
import { GeminiService } from '../services/GeminiService';

interface TemplateEditorProps {
  template: WorkoutTemplate;
  onSave: (updatedTemplate: WorkoutTemplate) => void;
  onClose: () => void;
  aiService: GeminiService;
  userSettings: UserSettings;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onSave, onClose, aiService, userSettings }) => {
  const [editedTemplate, setEditedTemplate] = useState<WorkoutTemplate>({ ...template });
  const [isAiEditing, setIsAiEditing] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');

  const handleSave = () => {
    onSave(editedTemplate);
  };

  const handleAiEdit = async () => {
    if (!aiInstruction.trim()) return;
    setIsAiEditing(true);
    try {
      const updated = await aiService.editTemplateWithAI(editedTemplate, aiInstruction);
      setEditedTemplate(updated);
      setAiInstruction('');
    } catch (e) {
      alert("AI Edit failed.");
    } finally {
      setIsAiEditing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950/95 backdrop-blur-3xl p-4 sm:p-8 flex items-center justify-center animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div>
            <h3 className="text-xl font-black text-slate-100">Edit Protocol</h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Manual & AI Synthesis</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-800 rounded-2xl text-slate-400"><X size={20} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="space-y-4">
             <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Protocol Name</p>
                <input 
                  type="text" 
                  value={editedTemplate.name} 
                  onChange={(e) => setEditedTemplate({ ...editedTemplate, name: e.target.value })}
                  className="w-full bg-transparent text-lg font-black text-slate-100 outline-none"
                />
             </div>

             <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl space-y-3">
                <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                   <Bot size={14} /> AI Modifier
                </h4>
                <div className="relative">
                   <textarea 
                     value={aiInstruction}
                     onChange={(e) => setAiInstruction(e.target.value)}
                     placeholder="e.g., 'Double the sets for legs' or 'Swap bench for dumbbells'..."
                     className="w-full h-20 bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 outline-none resize-none"
                   />
                   <button 
                     onClick={handleAiEdit}
                     disabled={isAiEditing || !aiInstruction}
                     className="absolute bottom-2 right-2 p-2 bg-emerald-500 text-slate-950 rounded-lg shadow-lg disabled:opacity-50"
                   >
                     {isAiEditing ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
                   </button>
                </div>
             </div>
          </div>

          <div className="space-y-3">
             {editedTemplate.exercises.map((ex, i) => (
               <div key={i} className="p-4 bg-slate-950/30 border border-slate-800 rounded-2xl flex justify-between items-center">
                  <div>
                    <p className="text-sm font-black text-slate-200">{ex.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">{ex.suggestedSets} Sets • {ex.targetReps} Reps</p>
                  </div>
                  <button 
                    onClick={() => setEditedTemplate({ ...editedTemplate, exercises: editedTemplate.exercises.filter((_, idx) => idx !== i) })}
                    className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                  >
                    <Trash2 size={16} />
                  </button>
               </div>
             ))}
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50">
           <button 
             onClick={handleSave}
             className="w-full py-4 bg-emerald-500 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20"
           >
             <Save size={18} /> Archive Protocol Changes
           </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;
