import React, { useState, useMemo } from 'react';
import { Search, Globe, Loader2, X, BookOpen, ChevronRight, PlusCircle, ChevronLeft, Activity, Trash2 } from 'lucide-react';
import { ExerciseLibraryItem, UserSettings } from '../types';
// Fix: Use PascalCase GeminiService to match project standard and resolve casing conflicts
import { GeminiService } from '../services/GeminiService';
import ExerciseDetailContent from './ExerciseDetailContent';

export const DEFAULT_LIBRARY: ExerciseLibraryItem[] = [
  // --- CHEST ---
  { name: "Barbell Bench Press", category: "Chest", muscles: ["Pectorals", "Triceps", "Front Deltoids"], instructions: ["Lie on bench", "Grip bar slightly wider than shoulders", "Lower to mid-chest", "Push back up"], benefits: "Primary chest builder, improves pushing power.", risks: "Shoulder impingement if flared too wide; dropping bar if no spotter." },
  { name: "Dumbbell Flyes", category: "Chest", muscles: ["Pectorals", "Front Deltoids"], instructions: ["Lie on bench with dumbbells above chest", "Lower arms in wide arc until stretch is felt", "Bring back to center"], benefits: "Isolates pectoral muscles and improves chest width.", risks: "High strain on shoulder capsule if lowered too far." },
  { name: "Incline Barbell Press", category: "Chest", muscles: ["Upper Pectorals", "Front Deltoids", "Triceps"], instructions: ["Bench at 30-45 degrees", "Lower bar to upper chest", "Press up and slightly back"], benefits: "Targets upper pectorals and front deltoids.", risks: "Increased stress on rotator cuffs compared to flat press." },
  { name: "Push-Ups", category: "Chest", muscles: ["Pectorals", "Triceps", "Core"], instructions: ["Plank position", "Lower chest to floor", "Push back to start"], benefits: "Excellent bodyweight compound movement for chest and core.", risks: "Wrist strain; lower back sagging." },
  { name: "Decline Bench Press", category: "Chest", muscles: ["Lower Pectorals", "Triceps"], instructions: ["Secure feet in decline bench", "Lower bar to lower chest", "Press upward"], benefits: "Targets lower pectorals and allows for heavier weights.", risks: "Blood pressure spike; difficult to rack/unrack without spotter." },

  // --- BACK ---
  { name: "Deadlift", category: "Back", muscles: ["Hamstrings", "Glutes", "Erector Spinae", "Traps", "Forearms"], instructions: ["Stand with mid-foot under bar", "Hinge at hips", "Grip bar", "Lift by extending hips and knees"], benefits: "Ultimate full-body strength and posterior chain development.", risks: "Lower back strain if spine is not kept neutral." },
  { name: "Pull Ups", category: "Back", muscles: ["Lats", "Biceps", "Rhomboids", "Traps"], instructions: ["Grip bar wider than shoulders", "Hang with straight arms", "Pull chest to bar", "Lower slowly"], benefits: "Mastery of bodyweight; builds wide, powerful back.", risks: "Elbow tendonitis if overused with poor form." },
  { name: "Bent Over Barbell Row", category: "Back", muscles: ["Lats", "Rhomboids", "Biceps", "Erector Spinae"], instructions: ["Hinge forward", "Pull bar to lower stomach", "Squeeze shoulder blades", "Lower with control"], benefits: "Core back thickness and postural strength.", risks: "High lower back demand; avoid rounded spine." },
  { name: "Lat Pulldowns", category: "Back", muscles: ["Lats", "Biceps", "Rear Deltoids"], instructions: ["Sit at machine", "Pull bar to upper chest", "Focus on pulling with elbows"], benefits: "Isolates lats; builds upper back width.", risks: "Pulling behind neck can cause cervical spine issues." },

  // --- LEGS ---
  { name: "Squat", category: "Legs", muscles: ["Quadriceps", "Glutes", "Hamstrings", "Core"], instructions: ["Bar across upper back", "Feet shoulder-width apart", "Hinge at hips", "Descend until thighs are parallel to floor"], benefits: "Compound leg development and core stability.", risks: "Knee and lower back injury if form breaks under heavy load." },
  { name: "Leg Press", category: "Legs", muscles: ["Quadriceps", "Glutes"], instructions: ["Sit in machine", "Lower platform until knees at 90 deg", "Press up without locking knees"], benefits: "Safely loads legs without spinal compression.", risks: "Rounding lower back off the seat (very dangerous for spine)." },
  { name: "Romanian Deadlift", category: "Legs", muscles: ["Hamstrings", "Glutes", "Erector Spinae"], instructions: ["Hold bar at hips", "Push hips back", "Lower bar to mid-shin with straight back", "Feel stretch in hams"], benefits: "Elite posterior chain and hamstring builder.", risks: "Rounding the back at the bottom position." },
  { name: "Hip Thrusts", category: "Legs", muscles: ["Glutes", "Hamstrings"], instructions: ["Upper back on bench", "Bar across hips", "Drive hips to ceiling"], benefits: "Number one exercise for glute hypertrophy.", risks: "Neck position; bruising from bar." },

  // --- ARMS ---
  { name: "Barbell Curls", category: "Arms", muscles: ["Biceps", "Forearms"], instructions: ["Stand straight", "Curl bar to shoulders", "Avoid swinging elbows"], benefits: "Basic mass builder for the biceps.", risks: "Lower back swinging; elbow movement." },
  { name: "Tricep Pushdowns", category: "Arms", muscles: ["Triceps"], instructions: ["Use rope or bar on cable", "Keep elbows tucked to sides", "Extend arms fully down"], benefits: "Easy to scale; great tricep isolation.", risks: "Shoulders rolling forward to 'push' the weight." },
  { name: "Skull Crushers", category: "Arms", muscles: ["Triceps"], instructions: ["Lie on bench", "Lower E-Z bar to forehead", "Extend elbows back up"], benefits: "Top-tier tricep mass builder.", risks: "High stress on the elbow joint (tendonitis)." },
  { name: "Hammer Curls", category: "Arms", muscles: ["Biceps", "Brachialis", "Forearms"], instructions: ["Palms facing inward", "Curl dumbbells to shoulders", "Keep thumbs up"], benefits: "Targets brachialis and forearms (arm thickness).", risks: "Wrist fatigue." },

  // --- SHOULDERS ---
  { name: "Overhead Press", category: "Shoulders", muscles: ["Front Deltoids", "Lateral Deltoids", "Triceps", "Core"], instructions: ["Feet shoulder-width apart", "Bar at upper chest height", "Press bar overhead until arms lock", "Lower with control"], benefits: "Builds powerful shoulders and upper body stability.", risks: "Avoid excessive arching of the lower back; start with light weight." },
  { name: "Dumbbell Lateral Raise", category: "Shoulders", muscles: ["Lateral Deltoids"], instructions: ["Hold dumbbells at sides", "Raise arms to shoulder height", "Keep slight elbow bend"], benefits: "Builds shoulder width (medial delt).", risks: "Traps taking over; shoulder impingement if arms rotate inward." },
  { name: "Arnold Press", category: "Shoulders", muscles: ["Front Deltoids", "Lateral Deltoids", "Rear Deltoids", "Triceps"], instructions: ["Start with palms facing you", "Press and rotate palms outward", "Full overhead extension"], benefits: "Hits all three heads of the deltoid.", risks: "Complex movement; high demand on rotator cuff." },

  // --- CORE ---
  { name: "Plank", category: "Core", muscles: ["Rectus Abdominis", "Obliques", "Erector Spinae"], instructions: ["Forearms on floor", "Body in straight line", "Squeeze glutes and core", "Hold for time"], benefits: "Deep core stabilization and postural health.", risks: "Sagging hips can cause lower back strain." },
  { name: "Hanging Leg Raises", category: "Core", muscles: ["Rectus Abdominis", "Hip Flexors"], instructions: ["Hang from bar", "Lift legs to 90 degrees or bar", "Avoid swinging"], benefits: "Superior lower abdominal and hip flexor strength.", risks: "Shoulder fatigue; excessive swinging." },
];

interface ExerciseLibraryProps {
  onClose: () => void;
  aiService: GeminiService;
  userSettings: UserSettings;
  customLibrary: ExerciseLibraryItem[];
  deletedExercises: ExerciseLibraryItem[];
  onUpdateCustomLibrary: (lib: ExerciseLibraryItem[]) => void;
  onDeleteExercise: (exercise: ExerciseLibraryItem) => void;
}

const ExerciseLibrary: React.FC<ExerciseLibraryProps> = ({ 
  onClose, 
  aiService, 
  userSettings, 
  customLibrary, 
  deletedExercises, 
  onUpdateCustomLibrary, 
  onDeleteExercise 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedItem, setSelectedItem] = useState<ExerciseLibraryItem | null>(null);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

  const fullLibrary = useMemo(() => {
    const map = new Map<string, ExerciseLibraryItem>();
    DEFAULT_LIBRARY.forEach(item => map.set(item.name.toLowerCase(), item));
    customLibrary.forEach(item => map.set(item.name.toLowerCase(), item));

    const active = Array.from(map.values()).filter(item => 
      !deletedExercises.some(d => d.name.toLowerCase() === item.name.toLowerCase())
    );
    
    return active.filter(item => 
      userSettings.includedBodyParts.includes(item.category)
    );
  }, [customLibrary, deletedExercises, userSettings]);

  const categories = useMemo(() => ['All', ...new Set(fullLibrary.map(i => i.category))], [fullLibrary]);

  const filteredItems = useMemo(() => {
    return fullLibrary.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [fullLibrary, searchQuery, selectedCategory]);

  const handleOnlineSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearchingOnline(true);
    try {
      const result = await aiService.searchExerciseOnline(searchQuery);
      setSelectedItem(result);
    } catch (e) {
      alert("No reputable information found.");
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handleEnhance = async (name: string) => {
    try {
      const result = await aiService.searchExerciseOnline(name);
      result.name = name;
      setSelectedItem(result);
      
      const existsInCustom = customLibrary.some(i => i.name.toLowerCase() === name.toLowerCase());
      if (existsInCustom) {
        onUpdateCustomLibrary(customLibrary.map(i => i.name.toLowerCase() === name.toLowerCase() ? result : i));
      } else {
        onUpdateCustomLibrary([...customLibrary, result]);
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-3xl flex flex-col animate-in fade-in duration-500">
      <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col min-h-0">
        
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-slate-900 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl">
              <BookOpen className="text-emerald-400" size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                <span className="text-slate-100">IronFlow</span> <span className="text-emerald-400">Library</span>
              </h2>
              <p className="hidden sm:block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Scientific Training Resource</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-900 hover:bg-slate-800 rounded-2xl text-slate-400 border border-slate-800 transition-all active:scale-95">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          
          <div className={`w-full lg:w-[380px] flex flex-col border-r border-slate-900 bg-slate-950/20 ${selectedItem ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-6 space-y-5 shrink-0">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input 
                    type="text"
                    placeholder="Search exercises..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3.5 pl-12 pr-12 text-sm text-slate-100 focus:ring-2 focus:ring-emerald-500/50 outline-none placeholder:text-slate-600 transition-all"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                  {searchQuery && <X onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 cursor-pointer hover:text-emerald-400 transition-colors" size={18} />}
                </div>
                <button 
                  onClick={handleOnlineSearch} 
                  disabled={isSearchingOnline || !searchQuery} 
                  className="p-3.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                  title="Search Global Database"
                >
                  {isSearchingOnline ? <Loader2 className="animate-spin" size={20} /> : <Globe size={20} />}
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {categories.map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => setSelectedCategory(cat)}
                    className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${selectedCategory === cat ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md shadow-emerald-500/10' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-3">
              {filteredItems.map(item => (
                <button 
                  key={item.name} 
                  onClick={() => setSelectedItem(item)}
                  className={`w-full text-left p-5 rounded-3xl border transition-all flex items-center justify-between group ${selectedItem?.name === item.name ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-900/30 border-slate-800/60 hover:border-slate-700'}`}
                >
                  <div>
                    <h4 className={`font-black text-sm tracking-tight ${selectedItem?.name === item.name ? 'text-emerald-400' : 'text-slate-200'}`}>{item.name}</h4>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">{item.category}</span>
                      {item.muscles?.slice(0, 1).map(m => (
                        <span key={m} className="text-[9px] text-emerald-500/40 font-bold uppercase tracking-widest">| {m}</span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight size={18} className={`text-slate-700 transition-all ${selectedItem?.name === item.name ? 'translate-x-1 text-emerald-500' : 'group-hover:text-slate-400'}`} />
                </button>
              ))}
              {filteredItems.length === 0 && (
                <div className="py-20 text-center opacity-20">
                  <Search size={40} className="mx-auto mb-4" />
                  <p className="text-xs font-black uppercase tracking-widest">No exercises match filters</p>
                </div>
              )}
            </div>
          </div>

          <div className={`flex-1 flex flex-col bg-slate-950/40 relative ${selectedItem ? 'flex' : 'hidden lg:flex'}`}>
            {selectedItem ? (
              <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-right-8 duration-500">
                <div className="absolute top-8 left-8 z-[110] lg:hidden">
                    <button onClick={() => setSelectedItem(null)} className="p-3 bg-slate-900 rounded-2xl text-emerald-400 border border-slate-800 transition-all active:scale-90"><ChevronLeft size={20} /></button>
                </div>
                
                <ExerciseDetailContent item={selectedItem} onEnhance={handleEnhance} />

                <div className="px-8 pb-8 bg-slate-950/90 flex flex-col gap-6">
                  <div className="max-w-xs mx-auto text-center space-y-4 pt-4 border-t border-slate-900">
                    <button 
                      onClick={() => {
                        onDeleteExercise(selectedItem);
                        setSelectedItem(null);
                      }}
                      className="w-full py-4 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                    >
                      <Trash2 size={16} />
                      Delete from Database
                    </button>
                    {!fullLibrary.some(i => i.name.toLowerCase() === selectedItem.name.toLowerCase()) && (
                      <button 
                        onClick={() => {
                          const exists = customLibrary.some(i => i.name.toLowerCase() === selectedItem.name.toLowerCase());
                          if (exists) return alert("Exercise already in your custom collection.");
                          const newLib = [...customLibrary, selectedItem];
                          onUpdateCustomLibrary(newLib);
                          alert("Added to Laboratory Database!");
                        }}
                        className="w-full py-4.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl transition-all shadow-2xl shadow-emerald-500/30 flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest text-[10px]"
                      >
                        <PlusCircle size={20} /> Deploy to Collection
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full"></div>
                <div className="relative z-10">
                  <div className="w-24 h-24 bg-slate-900 border border-slate-800 rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-2xl group hover:border-emerald-500/50 transition-all duration-500">
                    <Activity size={40} className="text-slate-600 group-hover:text-emerald-400 transition-colors duration-500" />
                  </div>
                  <h3 className="text-3xl font-black text-slate-300 tracking-tighter uppercase mb-4">Laboratory Directory</h3>
                  <p className="text-slate-500 max-w-xs mx-auto text-sm leading-relaxed mb-10">
                    Select an exercise from the directory to analyze its kinematic profile and training methodology.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default ExerciseLibrary;