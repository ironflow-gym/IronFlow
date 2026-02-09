
import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, X, Trash, Ghost, AlertTriangle, Dumbbell, Layout } from 'lucide-react';
import { WorkoutTemplate, ExerciseLibraryItem } from '../types';

interface TrashCanProps {
  templates: WorkoutTemplate[];
  exercises: ExerciseLibraryItem[];
  onClose: () => void;
  onRestore: (id: string) => void;
  onPermanentlyDelete: (id: string) => void;
  onRestoreExercise: (name: string) => void;
  onPermanentlyDeleteExercise: (name: string) => void;
  onEmpty: () => void;
}

const TrashCan: React.FC<TrashCanProps> = ({ 
  templates, 
  exercises = [], 
  onClose, 
  onRestore, 
  onPermanentlyDelete, 
  onRestoreExercise, 
  onPermanentlyDeleteExercise, 
  onEmpty 
}) => {
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'exercises'>('templates');

  // Auto-reset confirmation states after 3 seconds
  useEffect(() => {
    let timeout: number;
    if (confirmingEmpty) {
      timeout = window.setTimeout(() => setConfirmingEmpty(false), 3000);
    }
    return () => clearTimeout(timeout);
  }, [confirmingEmpty]);

  useEffect(() => {
    let timeout: number;
    if (confirmingDeleteId) {
      timeout = window.setTimeout(() => setConfirmingDeleteId(null), 3000);
    }
    return () => clearTimeout(timeout);
  }, [confirmingDeleteId]);

  const handleEmptyTrash = () => {
    if (confirmingEmpty) {
      onEmpty();
      setConfirmingEmpty(false);
    } else {
      setConfirmingEmpty(true);
    }
  };

  const handlePermanentDelete = (id: string) => {
    if (confirmingDeleteId === id) {
      if (activeTab === 'templates') {
        onPermanentlyDelete(id);
      } else {
        onPermanentlyDeleteExercise(id);
      }
      setConfirmingDeleteId(null);
    } else {
      setConfirmingDeleteId(id);
    }
  };

  const totalItems = templates.length + exercises.length;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-3xl p-4 sm:p-8 flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col h-[80vh] shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-100 flex items-center gap-3">
              <Trash2 className="text-rose-400" />
              Trash Can
            </h2>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Recovery Center</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 py-4 bg-slate-950/50 border-b border-slate-800 flex gap-2">
           <button 
             onClick={() => setActiveTab('templates')}
             className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'templates' ? 'bg-slate-800 text-emerald-400 shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}
           >
             <Layout size={14} /> Templates ({templates.length})
           </button>
           <button 
             onClick={() => setActiveTab('exercises')}
             className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'exercises' ? 'bg-slate-800 text-emerald-400 shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}
           >
             <Dumbbell size={14} /> Exercises ({exercises.length})
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {activeTab === 'templates' ? (
            templates.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-30">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center">
                  <Ghost size={40} className="text-slate-600" />
                </div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Templates Trash Empty</p>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div key={template.id} className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 flex items-center group transition-all">
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-200">{template.name}</h4>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                        {template.exercises.length} Exercises
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => template.id && onRestore(template.id)}
                        className="p-3 bg-slate-800 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all border border-slate-700/50"
                        title="Restore Template"
                      >
                        <RotateCcw size={18} />
                      </button>
                      <button 
                        onClick={() => template.id && handlePermanentDelete(template.id)}
                        className={`p-3 rounded-xl transition-all border flex items-center gap-2 ${
                          confirmingDeleteId === template.id 
                            ? 'bg-rose-500 text-slate-950 border-rose-500 font-bold px-4' 
                            : 'bg-slate-800 text-rose-400 border-slate-700/50 hover:bg-rose-500/10'
                        }`}
                        title="Permanently Delete"
                      >
                        {confirmingDeleteId === template.id ? (
                          <>
                            <AlertTriangle size={16} />
                            <span className="text-[10px] uppercase tracking-tighter">Confirm?</span>
                          </>
                        ) : (
                          <Trash size={18} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            exercises.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-30">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center">
                  <Dumbbell size={40} className="text-slate-600" />
                </div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Exercise Trash Empty</p>
              </div>
            ) : (
              <div className="space-y-3">
                {exercises.map((exercise) => (
                  <div key={exercise.name} className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 flex items-center group transition-all">
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-200">{exercise.name}</h4>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                        {exercise.category}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => onRestoreExercise(exercise.name)}
                        className="p-3 bg-slate-800 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all border border-slate-700/50"
                        title="Restore Exercise"
                      >
                        <RotateCcw size={18} />
                      </button>
                      <button 
                        onClick={() => handlePermanentDelete(exercise.name)}
                        className={`p-3 rounded-xl transition-all border flex items-center gap-2 ${
                          confirmingDeleteId === exercise.name 
                            ? 'bg-rose-500 text-slate-950 border-rose-500 font-bold px-4' 
                            : 'bg-slate-800 text-rose-400 border-slate-700/50 hover:bg-rose-500/10'
                        }`}
                        title="Permanently Delete"
                      >
                        {confirmingDeleteId === exercise.name ? (
                          <>
                            <AlertTriangle size={16} />
                            <span className="text-[10px] uppercase tracking-tighter">Confirm?</span>
                          </>
                        ) : (
                          <Trash size={18} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        {totalItems > 0 && (
          <div className="p-6 border-t border-slate-800 bg-slate-900/50 shrink-0">
            <button 
              onClick={handleEmptyTrash}
              className={`w-full py-4 font-black rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] ${
                confirmingEmpty 
                  ? 'bg-rose-500 text-slate-950 shadow-lg shadow-rose-500/30 scale-[1.02]' 
                  : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'
              }`}
            >
              {confirmingEmpty ? (
                <>
                  <AlertTriangle size={18} />
                  Confirm: Clear All?
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  Empty Trash Can
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrashCan;
