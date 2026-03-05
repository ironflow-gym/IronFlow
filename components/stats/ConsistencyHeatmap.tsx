import React, { useMemo, useState } from 'react';
import { HistoricalLog } from '../../types';

interface Props {
  history: HistoricalLog[];
}

type Range = '3m' | '6m' | '1y';
const RANGE_DAYS: Record<Range, number> = { '3m': 91, '6m': 182, '1y': 365 };
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const ConsistencyHeatmap: React.FC<Props> = ({ history }) => {
  const [range, setRange] = useState<Range>('3m');
  const [tooltip, setTooltip] = useState<{ date: string; names: string[]; tonnage: number; x: number; y: number } | null>(null);

  const { cells, maxTonnage } = useMemo(() => {
    const days = RANGE_DAYS[range as Range];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateMap: Record<string, { tonnage: number; names: Set<string> }> = {};
    history.forEach(h => {
      if (!dateMap[h.date]) dateMap[h.date] = { tonnage: 0, names: new Set() };
      dateMap[h.date].tonnage += h.weight * h.reps;
      dateMap[h.date].names.add(h.exercise);
    });
    let maxTonnage = 0;
    const cells: { date: string; tonnage: number; names: string[] }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const entry = dateMap[dateStr];
      const tonnage = entry?.tonnage ?? 0;
      if (tonnage > maxTonnage) maxTonnage = tonnage;
      cells.push({ date: dateStr, tonnage, names: entry ? [...entry.names] : [] });
    }
    return { cells, maxTonnage };
  }, [history, range]);

  const paddedCells = useMemo(() => {
    if (cells.length === 0) return [];
    const firstDate = new Date(cells[0].date);
    const dayOfWeek = (firstDate.getDay() + 6) % 7;
    const padding = Array.from({ length: dayOfWeek }, () => null);
    return [...padding, ...cells];
  }, [cells]);

  const weeks = Math.ceil(paddedCells.length / 7);

  const intensityClass = (tonnage: number): string => {
    if (tonnage === 0) return 'bg-slate-800';
    const ratio = tonnage / (maxTonnage || 1);
    if (ratio < 0.25) return 'bg-emerald-900';
    if (ratio < 0.5)  return 'bg-emerald-700';
    if (ratio < 0.75) return 'bg-emerald-500';
    return 'bg-emerald-400';
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Training Heatmap</h3>
        <div className="flex gap-1">
          {(['3m', '6m', '1y'] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${range === r ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300'}`}>
              {r === '3m' ? '3 Mo' : r === '6m' ? '6 Mo' : '1 Yr'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="flex flex-col gap-[3px] mr-1">
          {DAY_LABELS.map((d, i) => (
            <div key={i} className="h-3 w-3 flex items-center justify-center text-[9px] font-black text-slate-400">{d}</div>
          ))}
        </div>
        <div className="flex gap-[3px] overflow-x-auto flex-1">
          {Array.from({ length: weeks }, (_, wi) => (
            <div key={wi} className="flex flex-col gap-[3px] shrink-0">
              {Array.from({ length: 7 }, (_, di) => {
                const cell = paddedCells[wi * 7 + di];
                if (!cell) return <div key={di} className="w-3 h-3 rounded-sm opacity-0" />;
                return (
                  <div key={di}
                    className={`w-3 h-3 rounded-sm cursor-pointer transition-all hover:ring-1 hover:ring-emerald-400/50 ${intensityClass(cell.tonnage)}`}
                    onMouseEnter={e => {
                      if (cell.tonnage > 0) {
                        const rect = (e.target as HTMLElement).getBoundingClientRect();
                        setTooltip({ date: cell.date, names: cell.names, tonnage: Math.round(cell.tonnage), x: rect.left, y: rect.top });
                      }
                    }}
                    onMouseLeave={() => setTooltip(null)} />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Less</span>
        {['bg-slate-800', 'bg-emerald-900', 'bg-emerald-700', 'bg-emerald-500', 'bg-emerald-400'].map((c, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
        ))}
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">More</span>
      </div>
      {tooltip && (
        <div className="fixed z-50 pointer-events-none bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 shadow-xl"
          style={{ left: tooltip.x + 16, top: tooltip.y - 8 }}>
          <p className="text-[10px] font-black text-slate-300">{tooltip.date}</p>
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{tooltip.tonnage.toLocaleString()} kg&#xB7;reps</p>
          {tooltip.names.slice(0, 3).map(n => (
            <p key={n} className="text-[9px] text-emerald-400 font-black truncate max-w-[160px]">{n}</p>
          ))}
          {tooltip.names.length > 3 && <p className="text-[9px] text-slate-400 font-black">+{tooltip.names.length - 3} more</p>}
        </div>
      )}
    </div>
  );
};

export default ConsistencyHeatmap;
