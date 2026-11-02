import { Archive, Utensils } from 'lucide-react';

/** Keep the destination distinct from the source used to look up nutrition. */
export default function FoodWorkflowContext({ destination, description, detail, step }: {
  destination: 'pantry' | 'log'; description: string; detail?: string; step?: 1 | 2;
}) {
  const pantry = destination === 'pantry';
  const Icon = pantry ? Archive : Utensils;
  return <div className={`mb-4 space-y-2 rounded-xl border p-3 text-sm ${pantry ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'}`}>
    <p className="flex items-center gap-2 font-bold uppercase tracking-wide"><Icon size={18} aria-hidden="true" />{pantry ? 'Pantry' : 'Food log'}</p>
    {step && <ol aria-label="Barcode logging steps" className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      <li aria-current={step === 1 ? 'step' : undefined} className={step === 1 ? 'font-bold' : 'text-slate-300'}>{step === 2 ? '✓' : '1'} Product details</li>
      <li aria-hidden="true">→</li>
      <li aria-current={step === 2 ? 'step' : undefined} className={step === 2 ? 'font-bold' : 'text-slate-300'}>2 Amount &amp; date</li>
    </ol>}
    <p className="font-semibold">{description}</p>
    {detail && <p className="text-xs text-slate-300">{detail}</p>}
  </div>;
}
