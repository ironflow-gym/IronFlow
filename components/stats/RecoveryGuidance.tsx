import React from 'react';
import type { HistoricalLog } from '../../types';
import type { DeloadRecommendation } from '../../src/utils';
import { recoveryContext } from '../../src/mobileStats';
import { useLocalToday } from './MobileProgressSummary';
import { displayDate } from '../../src/interfacePresentation';
export default function RecoveryGuidance({ history, recommendation }: { history: HistoricalLog[]; recommendation: DeloadRecommendation | null }) {
  const today = useLocalToday();
  const context = recoveryContext(history, recommendation, today);
  const status = !recommendation ? 'More history needed' : { none: 'No recovery alert', approaching: 'Consider lighter training soon', due: 'Consider lighter training', overdue: 'Review your recovery' }[recommendation.status];
  return <section aria-label="Recovery guidance" className="min-w-0 space-y-2 rounded-2xl border border-slate-700 bg-slate-900 p-4 [overflow-wrap:anywhere]">
    <h3 className="font-bold">Recovery guidance</h3><p className="text-sm text-slate-200">{context.label}{context.date && <span className="block text-xs text-slate-400">Marked deload sets on {displayDate(context.date)}</span>}</p><p className="text-sm text-amber-200">{status}</p>
    <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-slate-300">How this is calculated</summary><div className="space-y-2 text-xs text-slate-400"><p>A recorded lighter session means you explicitly marked deload sets. The existing recovery estimate also detects quieter training periods from logged training-day frequency and exertion; missing logs can resemble rest. An inferred period is not a confirmed lighter session.</p>{recommendation ? <><p>Estimated elapsed recovery interval: {recommendation.blockWeek} weeks. Suggested review interval: {recommendation.targetBlockLength} weeks. These are estimates, not programme progress.</p><p>Training volume: {recommendation.volumeZone}. Exertion trend: {recommendation.rpeConfidence ? recommendation.rpeTrend : 'not enough recorded ratings'}.</p></> : <p>At least three weeks of recorded history are needed for the existing estimate.</p>}<p>Advisory only. This does not advance your training block, skip sessions, change progression rules or alter a workout.</p></div></details>
  </section>;
}
