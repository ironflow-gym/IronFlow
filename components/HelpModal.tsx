import React, { useState } from 'react';
import { X, ChevronRight, BookOpen, Dumbbell, BarChart3, Activity, Coffee, Shield, Bot, ExternalLink, ArrowLeft } from 'lucide-react';

interface Props {
  onClose: () => void;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

interface Category {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  sections: Section[];
}

// ── Reusable content components ──────────────────────────────────────────────

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm text-slate-300 leading-relaxed">{children}</p>
);

const H: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-5 mb-2 first:mt-0">{children}</h4>
);

const Formula: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 my-3 font-mono text-xs text-emerald-400 leading-relaxed">
    {children}
  </div>
);

const Ref: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer"
    className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs font-bold transition-colors">
    {children}<ExternalLink size={10} />
  </a>
);

const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 my-3">
    <p className="text-xs text-amber-300/80 leading-relaxed">{children}</p>
  </div>
);

const Ranges: React.FC<{ rows: { label: string; value: string; color?: string }[] }> = ({ rows }) => (
  <div className="space-y-1.5 my-3">
    {rows.map(r => (
      <div key={r.label} className="flex items-start justify-between bg-slate-900 rounded-xl px-4 py-2.5 gap-3">
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest shrink-0">{r.label}</span>
        <span className={`text-xs font-bold text-right ${r.color ?? 'text-slate-200'}`}>{r.value}</span>
      </div>
    ))}
  </div>
);

// ── Content ──────────────────────────────────────────────────────────────────

const categories: Category[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: <BookOpen size={18} />,
    color: 'text-emerald-400',
    sections: [
      {
        id: 'gs-overview',
        title: 'How IronFlow works',
        content: (
          <div className="space-y-3">
            <P>IronFlow is built around a simple loop: plan a training program, log your workouts, and review what the data shows. Everything is stored locally in your browser — nothing leaves your device unless you connect IronSync or use an AI feature.</P>
            <H>Navigation</H>
            <P>There are three main views. Plan is where you manage templates and generate programs. Workout is the active session screen. Stats contains all performance, biometric, and nutrition data across three sub-tabs — Train, Fuel, and Bios. On mobile these are the bottom tabs; on a wider screen they appear in the left sidebar.</P>
            <H>First steps</H>
            <P>Start in Plan by either generating a program with the AI or creating a template manually. Tap a template to start a session. After a few sessions the Stats → Train tab will start to populate with meaningful data.</P>
            <P>For the full picture — IronFlow Quotient, body composition projection, macro balance — log at least one biometric entry in Stats → Bios and begin logging meals in Stats → Fuel.</P>
            <H>API key</H>
            <P>All AI features require a Gemini API key. If no key is configured, a setup prompt appears on first load — you can dismiss it and configure the key later in Settings. The key is stored only in your browser and sent directly to Google's API — it does not pass through any IronFlow server. Free-tier keys from <Ref href="https://aistudio.google.com">aistudio.google.com</Ref> are sufficient for normal use.</P>
          </div>
        ),
      },
      {
        id: 'gs-data',
        title: 'Your data and privacy',
        content: (
          <div className="space-y-3">
            <P>All workout logs, biometric entries, nutrition data, templates, and settings are stored in IndexedDB — a database inside your browser. The app has no backend and no user accounts.</P>
            <P>The only outbound network calls are: Gemini API for AI features, Open Food Facts for packaged food lookups, and Google Drive if you connect IronSync. None of these calls include any identifying information beyond what is strictly necessary.</P>
            <P>Because data lives in your browser, clearing browser data will erase it. Use IronVault (Vault Backup in the menu) to keep a local JSON backup, and consider connecting IronSync for automatic cloud mirroring.</P>
          </div>
        ),
      },
    ],
  },
  {
    id: 'training',
    label: 'Training',
    icon: <Dumbbell size={18} />,
    color: 'text-emerald-400',
    sections: [
      {
        id: 'tr-templates',
        title: 'Templates and programs',
        content: (
          <div className="space-y-3">
            <P>A template is a named list of exercises with suggested sets, reps, and starting weights. You can create them manually, generate them with the AI Program Architect, or discover specific workouts using Find a Workout.</P>
            <H>Program Architect</H>
            <P>The AI generates a full training split based on the goals, available days, and equipment you describe. The output is a set of templates — one per training day — that you can use immediately or edit first. You can prompt the AI to modify any template after the fact with plain instructions.</P>
            <H>Template editor (desktop)</H>
            <P>On a wide screen, editing a template opens a three-panel interface. The exercise library is on the left — drag exercises directly onto the canvas in the centre, or click to add them. The right panel shows exercise detail and your e1RM history for that movement when an exercise is selected. Panels are resizable by dragging the dividers.</P>
            <H>Workout discovery</H>
            <P>Find a Workout lets you describe what you want — "a 45-minute upper body session with dumbbells only" — and the AI generates a one-off template. This is separate from your saved programs and is useful for filling gaps in your main plan or for travel sessions.</P>
          </div>
        ),
      },
      {
        id: 'tr-logging',
        title: 'Logging a session',
        content: (
          <div className="space-y-3">
            <P>Tap a template to start a session, or start an ad-hoc session from the Workout tab if you want to log without a template. Each exercise shows a row per set. Enter weight and reps and tap the checkmark to log the set.</P>
            <H>Set circle — warmup and deload flags</H>
            <P>The round button to the left of the weight and rep fields cycles through three states on each short tap: normal (numbered, green) → warmup (W, amber) → deload (D, cyan) → back to normal. Use warmup for lighter sets done before working weight; use deload for sets done at intentionally reduced load during a recovery week.</P>
            <P>Warmup and deload sets are excluded from all analytics — e1RM, tonnage, volume counts, MEV/MRV, and PR detection. Deload sets are included in ACWR to correctly reflect the session took place. If you log warmup sets without flagging them, every metric will be inflated.</P>
            <P>To delete a set, long-press the circle (hold for approximately 0.6 seconds — the device will vibrate on supported hardware). The set turns red and shows a trash icon; the checkmark becomes a delete confirm. Long-press is disabled on already-completed sets.</P>
            <H>AI weight suggestions</H>
            <P>For resistance exercises, the weight field is pre-populated from your training history. The default is your most recent logged working weight for that exercise, adjusted for progression using a double-progression model. If an exercise has equipment configuration set (see Exercise Library), the suggestion is snapped to the nearest available weight increment and will never be suggested below the starting weight of that equipment. Adjust the pre-populated weight freely — it is a starting point, not a prescription.</P>
            <H>Rest timer</H>
            <P>The rest timer starts automatically after each completed set. The default duration is set in Settings and can be overridden mid-session. When the timer reaches zero it pulses red — tap it to dismiss or leave it if you are still resting. Warmup-to-warmup transitions use a shorter rest period automatically.</P>
            <H>Interval timer</H>
            <P>For cardio exercises, an interval timer can be configured per-exercise directly in the active session. A gear icon labelled Interval appears in the exercise header — tap it to set the work and rest durations in seconds. Tap Start to begin the work countdown. When work time expires the set is automatically completed and the rest countdown begins. Tap Start again for the next interval.</P>
            <H>Exercise advice</H>
            <P>The Bot icon on each exercise in an active session triggers an AI coaching note specific to that movement, taking into account your recent sets and history. It returns a short tip — a form cue, a load recommendation, or a technique note.</P>
            <H>Exercise swap</H>
            <P>Tap the swap icon on any exercise to get AI-generated alternatives that match the muscle group and movement pattern. The swap applies to the current session only and does not modify your template.</P>
            <H>Session Surgery</H>
            <P>Past sessions can be edited after the fact. From Stats → Train, drill down into any session date and tap the edit icon. This opens Session Surgery, which lets you correct weights, reps, or set flags on any logged set without deleting the whole session.</P>
            <H>Bulk rename</H>
            <P>If you have logged an exercise under inconsistent names, you can relabel historical entries from the exercise drill-down view in Stats. Select the sessions to update and enter the new name. This rewrites the exercise name in your history without affecting the logged data.</P>
            <H>Plate calculator</H>
            <P>When you tap a weight field in an active session, the Neural Pad opens. For barbell and slab-loaded exercises, the plate calculator shows what to load on each side of the bar. It deducts the bar or equipment starting weight (set in Equipment Config, or configured via the barbell icon in the pad) and shows only the plates you need to add.</P>
            <P>When a previous set has already been completed for the same exercise in the current session, the calculator compares what was already loaded with what the new target requires. It then chooses the cheaper option between two approaches — adjusting from the current load versus stripping the bar and reloading from scratch — based on total plate movements required. The display uses colour to show the action needed:</P>
            <Ranges rows={[
              { label: 'Normal colour', value: 'Plates already on the bar — leave them', color: 'text-slate-300' },
              { label: 'Emerald ring', value: 'Plates to add', color: 'text-emerald-400' },
              { label: 'Rose ring / faded', value: 'Plates to remove', color: 'text-rose-400' },
            ]} />
            <P>The compact bar view in the Neural Pad shows a summary label: for example "+10 | −5" means add a 10 and remove a 5 from each side. Tap the bar to open the Neural Zoom full-screen view, which shows the full breakdown split into Leave on, Add, and Remove sections. If stripping and reloading is fewer movements than adjusting, the full load is shown instead with no delta breakdown.</P>
            <H>Cardio exercises</H>
            <P>Exercises categorised as cardio capture distance and duration instead of weight and reps. The interval timer is only available on cardio exercises.</P>
          </div>
        ),
      },
      {
        id: 'tr-rpe',
        title: 'Session RPE rating',
        content: (
          <div className="space-y-3">
            <P>When you complete a session, a rating screen appears asking how the session felt on a scale of 1 to 10. This is a session RPE — Rate of Perceived Exertion applied to the whole workout, not to individual sets or exercises. You can skip it, but rating consistently unlocks better data across the app.</P>
            <H>What you are rating</H>
            <P>Rate the overall demand of the session after your breathing and heart rate have settled — not mid-session. Consider physical fatigue, mental effort, and how hard the later sets felt. One number for the whole thing.</P>
            <H>Scale anchors</H>
            <Ranges rows={[
              { label: '1 – 3', value: 'Easy. You could have done significantly more. Movement felt effortless, no meaningful fatigue accumulated. Typical of a deliberate deload session, active recovery, or low-volume technique work.', color: 'text-sky-400' },
              { label: '4 – 6', value: 'Moderate. Genuine effort but in control throughout. Some fatigue by the end, no struggle. This is the target range for most training days — enough stimulus to drive adaptation without compromising recovery. A 5 is a well-executed working session that went to plan.', color: 'text-emerald-400' },
              { label: '7 – 8', value: 'Hard. Genuinely taxing. The later sets required real commitment. You finished, but pushing further would have been difficult. Appropriate for a peak week or a heavy compound day. Sustainable occasionally, not week after week.', color: 'text-amber-400' },
              { label: '9 – 10', value: 'Maximum. You gave everything. Significant fatigue during the session, took real effort to complete. A 10 should be rare — true maximum effort with nothing left. Frequent 9s and 10s signal the load is too high to sustain, and the deload scheduler will reflect this.', color: 'text-rose-400' },
            ]} />
            <H>Practical guide</H>
            <P>If you are unsure, wait 15 minutes after finishing and ask: could I repeat this session tomorrow at the same quality? If yes comfortably: 4–5. If yes but degraded: 6–7. If no: 8+. If absolutely not: 9–10.</P>
            <H>What RPE data unlocks</H>
            <P>Once at least half the sessions in a 28-day window have been rated, the ACWR gauge upgrades from tonnage-based to RPE-weighted using the Foster session load method (RPE × session duration in minutes). This is a more sensitive workload signal than tonnage alone. The deload scheduler also uses your RPE trend over the past three weeks — a rising trend shortens the recommended block length, accelerating the deload recommendation.</P>
            <Note>You only need to rate consistently to get the benefit — you do not need to rate every single session. Once half the sessions in the rolling window are rated, the RPE-weighted path activates.</Note>
            <H>Adding or editing RPE after the fact</H>
            <P>If you skipped the rating at session end, or want to correct one, open the session drill-down in Stats → Train and tap the RPE tile below the four summary stats. The same 1–10 scale appears inline. Select a value and tap Save RPE. If no rating exists yet the tile shows a dashed outline labelled "Tap to add rating"; once rated it shows the value, its colour band, and its label (Easy, Moderate, Hard, or Maximum). Saving recalculates the Foster session load for that session so the ACWR gauge and deload scheduler pick up the change immediately.</P>
          </div>
        ),
      },
      {
        id: 'tr-library',
        title: 'Exercise library',
        content: (
          <div className="space-y-3">
            <P>The exercise library contains instructions, muscle targets, setup cues, execution notes, and risk considerations for each movement. Access it from the menu or from within the template editor.</P>
            <P>On mobile, selecting an exercise replaces the list with its detail page. On desktop, the list and detail sit side by side.</P>
            <P>You can add custom exercises to the library. Custom exercises behave identically to built-in ones and appear in AI suggestions and analytics.</P>
            <H>Muscle tags and analytics</H>
            <P>Each exercise has a primary muscle and optional secondary muscles. Secondary muscles are counted at 0.5 weight in the volume calculations. If a muscle group is showing zero sets in the volume dot grid despite you training it, check that the relevant exercises have the correct muscle tags in the library.</P>
            <H>Equipment configuration</H>
            <P>Each exercise can be configured with the specific equipment you use for it. Scroll to the Equipment Config section at the bottom of the exercise detail page and tap Edit. Two values can be set:</P>
            <Ranges rows={[
              { label: 'Weight Increment', value: 'The smallest weight step available on this machine or setup — for example 5 for a cable stack, 2.5 for a standard barbell. Weight suggestions and warmup weights are snapped to this increment so the plates always land on a clean load.', color: 'text-slate-300' },
              { label: 'Starting Weight', value: 'The base mass before any plates are added — the bar, sled, or machine carriage. For example 20 for a standard barbell, 17.45 for a specific leg press sled. Weight suggestions are always at or above this floor, and the plate calculator deducts it before showing what to load.', color: 'text-slate-300' },
            ]} />
            <P>Equipment config can be set from the Exercise Library or directly from the exercise detail sheet inside an active workout — useful when you are standing next to the machine and can read its actual specifications. Tap Save Equipment Config to persist the values. Changes take effect from the next session that uses that exercise.</P>
            <Note>Weight increment and starting weight are currently entered and displayed in kg regardless of your measurement system preference. This will be addressed in a future update.</Note>
          </div>
        ),
      },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart3 size={18} />,
    color: 'text-emerald-400',
    sections: [
      {
        id: 'an-overview',
        title: 'Stats overview and smart cards',
        content: (
          <div className="space-y-3">
            <P>The Stats → Train view has two layers. At the top, contextual cards surface insights automatically based on your current training state. Below, a scrollable set of charts and data panels covers your full history.</P>
            <H>Anniversary card</H>
            <P>On and for seven days after each yearly anniversary of your first logged session, a card appears summarising the year: total sessions and working sets logged, your biggest strength percentage gain across any lift, your longest weekly streak that year, and body fat reduction if applicable. It appears automatically — no action required.</P>
            <H>Consistency Streak card</H>
            <P>Shows your current unbroken run of weeks meeting your weekly session goal (set in Settings). The current partial week is not counted unless you have already met the goal this week. Streaks of eight or more weeks receive a special indicator. The card does not appear if your streak is zero.</P>
            <H>Imminent Milestone card</H>
            <P>When any lift is projected to reach a round-number e1RM milestone within two weeks, a card appears naming the exercise, the target, and the projected timeframe. Milestones are exercise-specific — for example, bench press targets are set at 40, 60, 80, 100, 120kg intervals; deadlift at 80, 100, 120, 140, 160kg. The projection requires at least four qualifying sessions in the past 90 days and a positive average weekly gain. Assisted exercises are excluded.</P>
            <H>Deload Scheduler card</H>
            <P>Appears when a deload is approaching, due, or overdue. Shows your current week in the loading block, your volume zone, your RPE trend if sufficient sessions have been rated, and a status label. See the Deload Scheduler section for full detail. The card does not appear when no deload is needed.</P>
            <H>Volume landmark dot grid</H>
            <P>A compact row of coloured dots — one per tracked muscle group — showing your current weekly volume status at a glance. Grey means below MEV, green means in the productive zone, amber means approaching MRV, red means above MRV. Tapping the grid opens a detailed breakdown with a four-week bar chart per muscle, your average sets per week, and how many sets you would need to add to reach MEV if you are currently below it. Based on a 28-day rolling average. Secondary muscles are counted at half weight.</P>
            <H>Architect's Evolution Review</H>
            <P>A button in the Stats → Train view triggers an on-demand AI weekly check-in. Unlike a simple training summary, the Evolution Review draws on all four available data domains simultaneously: your recent training logs (last 12 sessions by exercise), your most recent biometric entries, your nutrition logs from the past seven days as daily macro totals, and your current saved training protocols. The AI uses this combined picture to give coaching guidance that the individual data streams cannot provide alone — for example, identifying that a stalling lift is more likely a protein deficit problem than a programming problem if your macros are consistently low. Tap Force Recalibration at any time to regenerate with the latest data.</P>
          </div>
        ),
      },
      {
        id: 'an-e1rm',
        title: 'e1RM — Estimated one-rep max',
        content: (
          <div className="space-y-3">
            <P>The e1RM chart tracks your estimated one-rep maximum for a selected exercise over time. Select an exercise from the drill-down list to populate it.</P>
            <H>How it is calculated</H>
            <P>IronFlow uses the Epley formula, one of the most widely validated rep-max estimators in the research literature:</P>
            <Formula>e1RM = weight × (1 + reps / 30)</Formula>
            <P>Reps are capped at 36 to avoid extrapolation artefacts at very high rep ranges where the formula becomes unreliable. Single-rep sets use the logged weight directly. Only working sets are included — warmup and deload sets are excluded. For each date, the highest e1RM across all sets for that exercise is used.</P>
            <H>Statistical warmup detection</H>
            <P>In addition to sets you flag manually, the analytics engine automatically identifies sets at or below 60% of the session's peak weight as statistical warmups. These appear labelled "Stat-Warmup" in amber in the session drill-down and are excluded from all calculations. This catches cases where warmup sets were logged without being flagged — if you see a set excluded that should count, check whether the weight was below 60% of your heaviest set that day.</P>
            <H>How to read the chart</H>
            <P>A rising trend over weeks is the primary signal of strength progress. Day-to-day variation is normal — fatigue, sleep, and nutrition all affect a given session. Look at the 4–8 week trend rather than individual data points.</P>
            <H>Realistic expectations</H>
            <P>Strength gains depend heavily on training age. Those in early training can see e1RM increases of 2–5% per week on compound lifts. Established lifters typically progress 1–2% per week averaged over a block. Advanced lifters may see 0.25–0.5% per week and need to plan training in deliberate phases to keep progressing.</P>
            <Ref href="https://pubmed.ncbi.nlm.nih.gov/14636102/">Epley (1985) — original formula derivation</Ref>
          </div>
        ),
      },
      {
        id: 'an-volume',
        title: 'Muscle volume — MEV, MAV, MRV',
        content: (
          <div className="space-y-3">
            <P>This chart shows your weekly set count per muscle group plotted against three thresholds from the volume landmark framework developed by Dr Mike Israetel and Renaissance Periodization.</P>
            <H>The three thresholds</H>
            <Ranges rows={[
              { label: 'MEV — Minimum Effective Volume', value: 'The floor. Below this, the muscle is not receiving a sufficient training stimulus to drive adaptation.', color: 'text-slate-300' },
              { label: 'MAV — Maximum Adaptive Volume', value: 'The target range. Most hypertrophy occurs between MEV and MAV.', color: 'text-emerald-400' },
              { label: 'MRV — Maximum Recoverable Volume', value: 'The ceiling. Above this, performance typically degrades and injury risk rises.', color: 'text-rose-400' },
            ]} />
            <P>Default values are built into the app and can be adjusted per muscle group in Settings. The defaults are conservative estimates that apply reasonably well to intermediate trainees. Secondary muscles contribute at half weight to avoid double-counting.</P>
            <H>How to read the chart</H>
            <P>The chart colour-codes each bar: grey below MEV, green within the productive range, amber between MAV and MRV, red above MRV. A muscle sitting grey for several consecutive weeks is being undertrained. Red for more than one week is a recovery risk worth addressing.</P>
            <Note>These thresholds are population averages from research on intermediate trainees. Individual variation is significant. Use them as starting points and adjust based on how you recover between sessions.</Note>
            <Ref href="https://renaissanceperiodization.com/hypertrophy-training-guide-central-hub/">Renaissance Periodization — Volume Landmarks Overview</Ref>
          </div>
        ),
      },
      {
        id: 'an-tonnage',
        title: 'Weekly tonnage',
        content: (
          <div className="space-y-3">
            <P>Tonnage is the total mechanical work performed in a week, calculated as weight × reps summed across every working set. All weights are normalised to kilograms for consistency.</P>
            <Formula>Weekly tonnage = Σ (weight_kg × reps) for all working sets</Formula>
            <P>Cardio sets, warmup sets, and deload sets are excluded.</P>
            <H>Why it matters</H>
            <P>Tonnage captures both the intensity and volume of training in a single number. Two weeks with the same set count but different tonnage represent genuinely different amounts of work. A rising tonnage trend over weeks is the clearest mechanical signal of progressive overload — you are doing more total work than before.</P>
            <H>How to read it</H>
            <P>The dashed line shows your average across completed weeks — the current partial week is excluded. Weeks meaningfully above the average represent higher-than-usual workload; weeks below represent deloads or missed sessions. A flat trend over several weeks despite consistent attendance suggests you have stopped progressively overloading — consider increasing weight, reps, or sets.</P>
            <H>Realistic progression</H>
            <P>A 5–10% increase in weekly tonnage per training block (typically 4–6 weeks) is a sustainable rate of progression for intermediates. Larger jumps are the primary driver of what the ACWR gauge tracks.</P>
          </div>
        ),
      },
      {
        id: 'an-acwr',
        title: 'Acute:Chronic Workload Ratio (ACWR)',
        content: (
          <div className="space-y-3">
            <P>ACWR compares your recent workload to your established training base. The gauge gives a snapshot of whether your current week is proportionate to what your body has adapted to.</P>
            <H>Two calculation modes</H>
            <P>The gauge uses one of two methods depending on how much RPE data is available. When at least half of your sessions in the past 28 days have been rated, it uses the Foster session load method — a more sensitive signal than raw tonnage. When RPE data is insufficient it falls back to tonnage.</P>
            <P>RPE-weighted mode:</P>
            <Formula>
              Session load = session RPE × session duration (minutes){'\n'}
              Acute load = mean daily session load over last 7 days{'\n'}
              Chronic load = mean daily session load over last 28 days{'\n'}
              ACWR = acute load ÷ chronic load
            </Formula>
            <P>Tonnage fallback mode:</P>
            <Formula>
              Acute load = mean daily tonnage over last 7 days{'\n'}
              Chronic load = mean daily tonnage over last 28 days{'\n'}
              ACWR = acute load ÷ chronic load
            </Formula>
            <H>Zone interpretation</H>
            <Ranges rows={[
              { label: 'Below 0.80', value: 'Under-trained — recent load is low relative to your base', color: 'text-sky-400' },
              { label: '0.80 – 1.30', value: 'Optimal — current load matches your fitness base', color: 'text-emerald-400' },
              { label: '1.30 – 1.50', value: 'High load — monitor recovery and sleep', color: 'text-amber-400' },
              { label: 'Above 1.50', value: 'Spike risk — acute load significantly above baseline', color: 'text-rose-400' },
            ]} />
            <H>Limitations</H>
            <Note>ACWR has attracted academic criticism, primarily because the acute window overlaps with the chronic window — a mathematical coupling issue that can produce spurious results. It is best treated as a directional indicator rather than a precise risk score. If you feel recovered, an amber gauge is not a reason to skip a session. If you feel beaten up and the gauge is red, that is worth taking seriously.</Note>
            <Ref href="https://pubmed.ncbi.nlm.nih.gov/27022673/">Hulin et al. (2016) — the original ACWR injury risk paper</Ref>
            <br />
            <Ref href="https://pubmed.ncbi.nlm.nih.gov/30765414/">Impellizzeri et al. (2019) — critical review of ACWR limitations</Ref>
          </div>
        ),
      },
      {
        id: 'an-deload',
        title: 'Deload Scheduler',
        content: (
          <div className="space-y-3">
            <P>The Deload Scheduler tracks where you are in your current loading block and tells you when a deload week is approaching, due, or overdue. It appears as a card in Stats → Train when action is warranted — it does not show when everything is on track.</P>
            <H>What a loading block is</H>
            <P>A loading block is the number of consecutive weeks of progressive training since your last deload. The scheduler counts weeks from either the last week containing explicit deload sets, or from the last week that had significantly reduced volume and low session RPE. If no deload has been detected, the entire training history is treated as one block.</P>
            <H>How the recommended length is set</H>
            <P>The target block length is 4–8 weeks, determined by your volume zone over the past 28 days. Higher volume means shorter blocks before a deload is recommended. If your session RPE trend has been rising over the past three weeks, the recommended length is shortened by one additional week — fatigue is accumulating faster than the volume zone alone suggests.</P>
            <Ranges rows={[
              { label: 'Approaching', value: 'Within 2 weeks of the recommended deload date', color: 'text-amber-400' },
              { label: 'Due', value: 'This week is the recommended deload week', color: 'text-orange-400' },
              { label: 'Overdue', value: 'The recommended deload date has passed', color: 'text-rose-400' },
            ]} />
            <H>What counts as a deload</H>
            <P>The scheduler clears as soon as deload sets are logged in the current week — you do not need to wait for the week to end. A deload week is also detected automatically from the heuristic: session count at or below 50% of your median weekly sessions combined with average session RPE of 6 or below. Flagging sets explicitly with the deload cycle (D/cyan) is more reliable than the heuristic, particularly if you train through a deload week with reduced loads rather than reduced frequency.</P>
            <Note>The deload scheduler requires at least three weeks of training history to make a recommendation.</Note>
          </div>
        ),
      },
      {
        id: 'an-consistency',
        title: 'Training calendar and consistency heatmap',
        content: (
          <div className="space-y-3">
            <P>IronFlow has two different frequency views depending on which layout you are using.</P>
            <H>Mobile — Training Frequency Map</H>
            <P>In Stats → Train on mobile, a monthly calendar shows each day of the current month. Days where you logged a session are highlighted with an emerald dot. Use the arrows to navigate between months. Tapping a session day opens the drill-down for that date.</P>
            <H>Desktop — Consistency Heatmap</H>
            <P>In the Performance Hub on desktop, a GitHub-style contribution grid shows a rolling 3-month, 6-month, or 1-year window. Each cell is one day — darker green means more tonnage logged that day, grey means no session. Hover over a cell to see the exercises and total tonnage for that day.</P>
            <H>How to read it</H>
            <P>Scan for gaps. A week-long gap is a deload or holiday — normal. A recurring gap on the same days each week may reveal a scheduling pattern worth addressing. Consistent coverage across weeks is the strongest predictor of long-term adaptation.</P>
          </div>
        ),
      },
      {
        id: 'an-patterns',
        title: 'Training day distribution and session duration',
        content: (
          <div className="space-y-3">
            <H>Day distribution</H>
            <P>Shows how many sessions you have logged on each day of the week across all recorded history. The highest bar is highlighted. This reveals your actual training schedule rather than your intended one — the two are often different.</P>
            <H>Session duration</H>
            <P>Plots your average session length in minutes per week over the last 12 weeks. Duration is captured from when you start a session to when you complete it.</P>
            <P>A shortening duration trend alongside flat or falling tonnage often indicates accumulated fatigue — sessions are getting cut short. A rising duration without rising tonnage suggests longer rest periods or more time spent between exercises.</P>
            <Note>Session duration requires the app to be open for the full session. If you close and reopen the app mid-session the timer resets.</Note>
          </div>
        ),
      },
    ],
  },
  {
    id: 'biometrics',
    label: 'Biometrics',
    icon: <Activity size={18} />,
    color: 'text-cyan-400',
    sections: [
      {
        id: 'bio-logging',
        title: 'Logging biometric data',
        content: (
          <div className="space-y-3">
            <P>The biometrics form accepts bodyweight, body fat percentage, height, and a set of circumference measurements. None of the fields are required — log what you have and the app derives whatever metrics are possible from the available data.</P>
            <P>For the most useful data, log bodyweight and body fat at the same time of day under consistent conditions — first thing in the morning, post-bathroom, before eating. Circumference measurements are best taken at the same point in the week and the same time of day, as hydration affects them significantly.</P>
            <H>Body fat input</H>
            <P>You can enter body fat from any source — DEXA, calipers, bioelectrical impedance, or your own estimate. If you have entered height, waist, and neck measurements (and hips if female), a Navy Method estimate is calculated and shown as a live preview at the bottom of the form.</P>
          </div>
        ),
      },
      {
        id: 'bio-navy',
        title: 'Navy Method body fat estimate',
        content: (
          <div className="space-y-3">
            <P>The US Navy circumference method estimates body fat from tape measurements. It requires height, waist circumference (measured at the navel), and neck circumference. Females additionally require hip circumference.</P>
            <H>Formula</H>
            <P>Male:</P>
            <Formula>BF% = 495 / (1.0324 − 0.19077 × log10(waist − neck) + 0.15456 × log10(height)) − 450</Formula>
            <P>Female:</P>
            <Formula>BF% = 495 / (1.29579 − 0.35004 × log10(waist + hips − neck) + 0.22100 × log10(height)) − 450</Formula>
            <P>All measurements in centimetres.</P>
            <H>Accuracy</H>
            <P>The Navy method has a standard error of roughly ±3–4% compared to hydrostatic weighing in the original validation study. It is reasonably accurate for the average person but tends to underestimate body fat in very lean individuals and overestimate it in very muscular ones. It is most useful as a consistency check against your entered body fat rather than as a standalone source of truth.</P>
            <Ref href="https://pubmed.ncbi.nlm.nih.gov/3880437/">Hodgdon & Beckett (1984) — original Navy method development</Ref>
          </div>
        ),
      },
      {
        id: 'bio-ffmi',
        title: 'FFMI — Fat-Free Mass Index',
        content: (
          <div className="space-y-3">
            <P>FFMI is a normalised measure of muscle mass relative to height. It requires bodyweight, body fat percentage, and height to calculate.</P>
            <Formula>
              Lean mass = weight × (1 − body fat / 100){'\n'}
              FFMI = lean mass (kg) / height (m)²{'\n'}
              Normalised FFMI = FFMI + 6.1 × (1.8 − height in metres)
            </Formula>
            <P>The normalisation factor adjusts for the fact that taller individuals tend to carry proportionally less muscle mass relative to their height squared. The value displayed in IronFlow is the normalised figure.</P>
            <H>Interpreting the value</H>
            <Ranges rows={[
              { label: 'Below 18', value: 'Slight build', color: 'text-slate-400' },
              { label: '18 – 20', value: 'Average athletic', color: 'text-slate-300' },
              { label: '20 – 22', value: 'Highly developed', color: 'text-emerald-400' },
              { label: '22 – 25', value: 'Near genetic limit (natural)', color: 'text-amber-400' },
              { label: 'Above 25', value: 'Exceeds natural upper bound in most studies', color: 'text-rose-400' },
            ]} />
            <P>FFMI has been used as an indirect indicator of natural versus enhanced status. Kouri et al. (1995) found that non-users of anabolic steroids rarely exceeded an FFMI of 25, while users frequently exceeded it. This is a population-level observation — individual outliers exist, particularly among very tall athletes.</P>
            <H>Realistic expectations</H>
            <P>Most natural male trainees reach their genetic FFMI ceiling somewhere between 22 and 25 after many years of training. Gaining 1 FFMI point requires roughly 5–7 kg of additional lean mass. Progress slows substantially as you approach your ceiling.</P>
            <Ref href="https://pubmed.ncbi.nlm.nih.gov/7550706/">Kouri et al. (1995) — FFMI and anabolic steroid use</Ref>
          </div>
        ),
      },
      {
        id: 'bio-ratios',
        title: 'Aesthetic ratios — SWR and CWR',
        content: (
          <div className="space-y-3">
            <P>These ratios measure structural proportions rather than body composition. They require circumference measurements logged in the biometrics form. Higher values indicate a more tapered frame — broader shoulders or chest relative to waist.</P>
            <H>Shoulder-to-Waist Ratio (SWR)</H>
            <Formula>SWR = shoulder circumference / waist circumference</Formula>
            <P>SWR measures the X-frame — how much wider the shoulders are than the waist. Available for both males and females. The golden ratio (~1.618) is commonly cited as the aesthetic ideal in physique sport.</P>
            <Ranges rows={[
              { label: 'Below 1.25', value: 'Developing foundation', color: 'text-slate-400' },
              { label: '1.25 – 1.43', value: 'Athletic proportions', color: 'text-slate-300' },
              { label: '1.43 – 1.61', value: 'Advanced V-taper', color: 'text-emerald-400' },
              { label: 'Above 1.61', value: 'Elite aesthetic peak', color: 'text-amber-400' },
            ]} />
            <H>Chest-to-Waist Ratio (CWR) — males only</H>
            <Formula>CWR = chest circumference / waist circumference</Formula>
            <P>CWR captures V-taper from the front — chest development relative to waist. Not shown for females as the anatomical interpretation differs significantly.</P>
            <Ranges rows={[
              { label: 'Below 1.05', value: 'Developing foundation', color: 'text-slate-400' },
              { label: '1.05 – 1.18', value: 'Athletic proportions', color: 'text-slate-300' },
              { label: '1.18 – 1.33', value: 'Advanced V-taper', color: 'text-emerald-400' },
              { label: 'Above 1.33', value: 'Elite aesthetic peak', color: 'text-amber-400' },
            ]} />
            <Note>These thresholds are based on aesthetic standards from competitive physique sport and research on physical attractiveness perception. They are descriptive benchmarks, not health metrics. Shoulder width is partly determined by clavicle structure and is not fully trainable — deltoid development improves the ratio, but there is a structural floor.</Note>
            <Ref href="https://pubmed.ncbi.nlm.nih.gov/17433560/">Tovée & Cornelissen (2007) — chest-to-waist ratio and perceived attractiveness</Ref>
          </div>
        ),
      },
      {
        id: 'bio-wthr',
        title: 'Waist-to-Height Ratio (WtHR)',
        content: (
          <div className="space-y-3">
            <Formula>WtHR = waist circumference / height</Formula>
            <P>WtHR is a simple measure of central adiposity — abdominal fat relative to height. It is one of the better anthropometric predictors of cardiometabolic risk and is considered more informative than BMI for this purpose by a number of health authorities.</P>
            <H>Interpreting the value</H>
            <Ranges rows={[
              { label: 'Below 0.43', value: 'Extremely lean', color: 'text-sky-400' },
              { label: '0.43 – 0.50', value: 'Healthy / ideal range', color: 'text-emerald-400' },
              { label: '0.50 – 0.53', value: 'Increased metabolic risk', color: 'text-amber-400' },
              { label: 'Above 0.53', value: 'High metabolic stress range', color: 'text-rose-400' },
            ]} />
            <P>The 0.5 threshold — keep your waist less than half your height — is a commonly cited rule of thumb that holds reasonably well across different populations and body sizes. Values below 0.5 are associated with substantially lower risk of cardiovascular disease, type 2 diabetes, and hypertension compared to values above 0.5, independent of BMI.</P>
            <Ref href="https://pubmed.ncbi.nlm.nih.gov/22245560/">Ashwell et al. (2012) — WtHR meta-analysis and the 0.5 boundary</Ref>
          </div>
        ),
      },
      {
        id: 'bio-relative-strength',
        title: 'Relative strength benchmarks',
        content: (
          <div className="space-y-3">
            <P>Relative strength is your estimated one-rep max for a key lift divided by your bodyweight. It allows meaningful strength comparisons across different body weights and over time as your bodyweight changes.</P>
            <Formula>Relative strength = e1RM (kg) / bodyweight (kg)</Formula>
            <P>IronFlow tracks this for bench press, squat, deadlift, overhead press, and barbell row. The app auto-detects these from exercise names — any exercise containing common variations of these movement names is mapped to the relevant standard. An exclusion list prevents false positives — hack squats, Romanian deadlifts, incline bench, and similar exercises that do not share the same strength standard are automatically excluded.</P>
            <H>Strength levels (male)</H>
            <Ranges rows={[
              { label: 'Bench — Foundations / Developing / Established / Forged / Elite', value: '0.5× / 0.75× / 1.0× / 1.5× / 2.0× BW', color: 'text-slate-300' },
              { label: 'Squat', value: '0.75× / 1.0× / 1.5× / 2.0× / 2.5× BW', color: 'text-slate-300' },
              { label: 'Deadlift', value: '1.0× / 1.25× / 1.75× / 2.25× / 3.0× BW', color: 'text-slate-300' },
              { label: 'OHP', value: '0.25× / 0.5× / 0.75× / 1.0× / 1.5× BW', color: 'text-slate-300' },
              { label: 'Barbell Row', value: '0.5× / 0.75× / 1.0× / 1.5× / 2.0× BW', color: 'text-slate-300' },
            ]} />
            <H>Strength levels (female)</H>
            <Ranges rows={[
              { label: 'Bench — Foundations / Developing / Established / Forged / Elite', value: '0.25× / 0.5× / 0.75× / 1.0× / 1.5× BW', color: 'text-slate-300' },
              { label: 'Squat', value: '0.5× / 0.75× / 1.0× / 1.5× / 2.0× BW', color: 'text-slate-300' },
              { label: 'Deadlift', value: '0.75× / 1.0× / 1.25× / 1.75× / 2.5× BW', color: 'text-slate-300' },
              { label: 'OHP', value: '0.15× / 0.3× / 0.5× / 0.65× / 1.0× BW', color: 'text-slate-300' },
              { label: 'Barbell Row', value: '0.25× / 0.5× / 0.75× / 1.0× / 1.5× BW', color: 'text-slate-300' },
            ]} />
            <P>These standards are derived from aggregated strength sport data. They represent population benchmarks — not competitive standards. Established means you are stronger than the majority of people who train consistently, not that you are ready to compete.</P>
            <H>Realistic progression</H>
            <P>Moving one level — say from Developing to Established on bench — typically takes 1–3 years of consistent training depending on starting point and genetics. The gap between levels compresses at higher levels: going from Foundations to Developing is faster than going from Forged to Elite.</P>
          </div>
        ),
      },
      {
        id: 'bio-projection',
        title: 'Body composition projection',
        content: (
          <div className="space-y-3">
            <P>The projection chart shows your historical bodyweight, lean mass, and fat mass as solid lines, then extends them as dashed lines 90 days into the future using linear regression on your logged entries.</P>
            <H>How the projection works</H>
            <P>Linear regression finds the straight line that best fits your historical data points and extends it forward. It needs at least three biometric entries to draw a projection line. The more entries you have logged, the more reliable the projection.</P>
            <Note>Linear trends in body composition do not continue indefinitely. The projection assumes your current diet and training remain constant — which they will not. Use it as a planning tool: "if I maintain my current deficit, where does this put me in 12 weeks?" rather than as a prediction. Changes in training, diet, or life circumstances will shift the trajectory.</Note>
            <H>Lean vs fat projection</H>
            <P>Lean mass and fat mass projections only appear if you have logged body fat percentage alongside bodyweight. Without body fat data, only total weight is projected. Body fat from any measurement method can be entered manually.</P>
          </div>
        ),
      },
      {
        id: 'bio-ifq',
        title: 'IronFlow Quotient (IFQ)',
        content: (
          <div className="space-y-3">
            <P>The IronFlow Quotient is a composite score from 0 to 100 that summarises how well your training, nutrition, and physical adaptation are aligned with your stated goal. It is not a standardised scientific metric — it is an in-app tool designed to give you a single meaningful signal about whether your inputs match your goal.</P>
            <H>Components</H>
            <Ranges rows={[
              { label: 'Training Consistency (35%)', value: 'Sessions per week over 28 days vs your 12-week baseline', color: 'text-slate-300' },
              { label: 'Metabolic Precision (30%)', value: 'Caloric intake vs goal-adjusted target over last 7 days', color: 'text-slate-300' },
              { label: 'Adaptation Alignment (35%)', value: 'Weight or composition movement over 28 days vs your stated goal', color: 'text-slate-300' },
            ]} />
            <P>If fuel data is not available, the score is split 50/50 between consistency and adaptation. If biometric trend data is not available, it is 55/45 between consistency and metabolic precision. If only training data is present, consistency alone drives the score.</P>
            <H>Score labels</H>
            <Ranges rows={[
              { label: '90 – 100', value: 'Peak Flow', color: 'text-emerald-400' },
              { label: '75 – 89', value: 'Strong Adaptation', color: 'text-emerald-400' },
              { label: '55 – 74', value: 'Developing Consistency', color: 'text-amber-400' },
              { label: '35 – 54', value: 'Misaligned Inputs', color: 'text-orange-400' },
              { label: '0 – 34', value: 'Stagnant', color: 'text-rose-400' },
            ]} />
            <H>Calibrating and Provisional states</H>
            <P>New users or those returning from a break will see "Calibrating" instead of a score. This happens when the 28-day training window contains less than 40% of the expected session signal — there is not enough data to produce a meaningful number. The score appears once the window is sufficiently populated, typically after 2–4 weeks of regular training.</P>
            <P>When there is enough data to score but the window is not fully populated, the label shows as Provisional. This means the score is real but should be treated as directional rather than definitive — it will stabilise as more sessions are logged.</P>
            <Note>The IFQ is most meaningful when all three data sources are active — training logs, nutrition logs, and biometric entries. A high score with only training data tells you that you are training consistently; it cannot tell you whether your nutrition and body composition are aligned with your goal.</Note>
          </div>
        ),
      },
      {
        id: 'bio-morphology',
        title: 'Morphology Lab',
        content: (
          <div className="space-y-3">
            <P>The Morphology Lab uses AI image analysis to assess visible muscle development across multiple muscle groups from reference photos. You can complete a 4-photo protocol or an 8-photo protocol for a more detailed analysis.</P>
            <H>Photo protocols</H>
            <P>The 4-photo protocol captures front, left side, back, and right side in a single pass. The 8-photo protocol runs two passes — upper body first (front, left, back, right), then lower body (front, left, back, right) — giving the AI separate upper and lower body images to assess each region properly. The 8-photo protocol produces more reliable lower body scores.</P>
            <P>Each scan produces scores from 0 to 100 per muscle group. These are qualitative assessments based on visible development — they reflect what is visible in the photos, not absolute muscle mass. Lighting, posing, and body fat level all affect the output.</P>
            <H>28-day scan interval</H>
            <P>A minimum of 28 days is enforced between scans. Meaningful changes in visible muscle development require at least this long — scanning more frequently would generate noise rather than signal. The next available scan date is shown when you are within the cooldown period.</P>
            <H>Pending scan state</H>
            <P>If photos are captured but the analysis fails — due to a network error or API issue — the photos are preserved locally. On next load, a pending state is shown with options to retry the analysis or discard the captured photos and start fresh. You do not need to repeat the photo sequence if the failure was on the API side.</P>
            <Note>The Morphology assessment is experimental. It is useful for identifying lagging muscle groups that benefit from rebalancing your program, but it should not be treated as a precise measurement. Use it alongside your training data and your own assessment.</Note>
          </div>
        ),
      },
    ],
  },
  {
    id: 'nutrition',
    label: 'Nutrition',
    icon: <Coffee size={18} />,
    color: 'text-orange-400',
    sections: [
      {
        id: 'nu-logging',
        title: 'Logging meals',
        content: (
          <div className="space-y-3">
            <P>There are four ways to log food in Fuel Depot. All four methods write to the same intake registry and count toward your daily totals.</P>
            <H>Narrative Synthesis</H>
            <P>Type what you ate in plain language and tap Send. The AI parses the description and returns estimated macros. You can edit any value before saving. Common foods are matched against a bundled Australian Food Composition Database (AFCD) dataset of 1,588 foods — these lookups happen locally without a network call. Packaged or branded products not in the AFCD are looked up via the Open Food Facts API.</P>
            <H>Barcode scan</H>
            <P>Tap the Scan button in the Narrative Synthesis heading row. Your camera opens in barcode mode. Align any EAN-13 or UPC barcode within the orange brackets — the scanner confirms the code over three consecutive frames before proceeding, which prevents misreads from partial alignment.</P>
            <P>The lookup runs in two stages. First, your local pantry is checked for an item with a matching barcode — if found, it is used immediately without a network request. If not found locally, the barcode is looked up against the Open Food Facts database, which covers tens of millions of packaged products worldwide. If the product is found, a confirmation screen shows the product name, brand, and macros per 100g. Set the quantity in grams — quick presets for 50, 100, 150, 200, and 250g are shown, or type any value — and a live macro preview updates as you adjust. Tap Log to Today to save the entry, or Log + Save to Pantry to log it and store the item (with its barcode) for instant recall next time. If the barcode is not in Open Food Facts, a not-found message is shown and you can enter the details manually.</P>
            <P>If your camera is not available or your browser does not support live barcode scanning, an Enter Code Manually field appears — type the barcode numbers directly and tap Look Up to proceed through the same confirmation flow.</P>
            <H>Food Pantry quick-log</H>
            <P>Frequently used foods saved to the Food Pantry can be logged directly without going through the AI parser, which is faster and more consistent for foods you eat regularly. Pantry items matched from a barcode scan are logged with a confidence of 1.0 and are marked with a verification badge in the intake registry.</P>
            <H>Confidence levels</H>
            <P>Each logged entry carries a confidence indicator reflecting how well the source data is known. Barcode-matched pantry items and barcode-confirmed Open Food Facts products log at 1.0. A well-known product matched via Narrative Synthesis logs at 0.8. An AI estimate where assumptions were made logs at 0.5 — if an entry shows 0.5 and the macros are nutritionally significant to you, review and edit them before saving. A dietary conflict (dairy for a lactose-intolerant profile, meat for a vegan profile) logs at 0.1 with a conflict warning.</P>
            <H>Dietary preference detection</H>
            <P>If your Narrative Synthesis entry includes goal, preference, or location statements — "I want to lose fat", "I am vegetarian", "I'm bulking", "high protein", "I am in the UK", "I live in Canada" — the AI reads these and updates your fuel profile automatically, adjusting the goal, dietary preferences, protein targets, and country accordingly. You do not need to go into settings to make these changes.</P>
            <P>Setting your country filters the Open Food Facts database to products sold in your market, which improves the accuracy of packaged food lookups. If no country is set, the search covers all markets worldwide.</P>
            <H>Food Pantry</H>
            <P>Frequently used foods can be saved to the Food Pantry for faster, more consistent logging. Each pantry item can have a barcode assigned to it — either automatically when you scan a product and tap Log + Save to Pantry, or manually by editing the item and entering the barcode number in the Barcode field. Once a barcode is assigned, scanning that product again matches directly to the pantry entry without any network request. Pantry items with a barcode show a last-four-digit indicator on their card. The Pantry also includes a separate nutrition label camera scan — point your camera at a printed nutrition panel and the AI reads the values directly into a new pantry item.</P>
          </div>
        ),
      },
      {
        id: 'nu-targets',
        title: 'Caloric and macro targets',
        content: (
          <div className="space-y-3">
            <P>Targets are calculated from your goal, biometric data, and the target multiplier slider in the Fuel settings. Your biological profile (gender and date of birth) set in Settings feeds into the BMR calculation.</P>
            <H>Caloric target</H>
            <P>The base caloric target uses a Mifflin-St Jeor BMR estimate multiplied by an activity factor, then adjusted for goal:</P>
            <Formula>
              BMR (male) = (10 × weight_kg) + (6.25 × height_cm) − (5 × age) + 5{'\n'}
              BMR (female) = (10 × weight_kg) + (6.25 × height_cm) − (5 × age) − 161{'\n'}
              {'\n'}
              Build Muscle: TDEE × activity + 300 kcal surplus{'\n'}
              Lose Fat: TDEE × activity − 500 kcal deficit{'\n'}
              Maintenance: TDEE × activity
            </Formula>
            <P>The target multiplier slider scales the final figure up or down. Use it to fine-tune the target based on how your weight is actually responding — if you are supposed to be in a deficit but your weight is stable, lower the multiplier.</P>
            <H>Protein target</H>
            <P>Protein targets are set by bodyweight using ISSN position stand figures as a base: 1.6 g/kg for muscle building, 1.8 g/kg for fat loss (higher protein preserves lean mass during a caloric deficit), and 1.2 g/kg for maintenance. Vegetarian preferences add an 8% uplift to account for lower plant protein bioavailability; vegan adds 15%. A high-protein preference floors the ratio at 2.2 g/kg regardless of goal. All values are clamped to a maximum of 2.8 g/kg. Protein targets are not affected by the calorie multiplier — they are set by bodyweight, not caloric intake.</P>
            <Ref href="https://pubmed.ncbi.nlm.nih.gov/28642676/">ISSN position stand — protein and exercise (2017)</Ref>
          </div>
        ),
      },
      {
        id: 'nu-radar',
        title: 'Macro balance radar chart',
        content: (
          <div className="space-y-3">
            <P>The radar chart shows your 7-day average intake across four axes — calories, protein, carbohydrates, and fat — expressed as a percentage of your calculated targets. The dashed outline represents 100% on each axis. Your actual intake is the filled shape inside it.</P>
            <H>How to read it</H>
            <P>A shape that closely approximates the dashed outline means your intake is well matched to your targets across all four macros. A shape significantly smaller on one axis — say protein — tells you that macro is consistently undershot. A shape that bulges beyond the outline on calories while matching protein indicates excess caloric intake from carbs or fat.</P>
            <P>The colour of each macro tile below the chart indicates status: green between 90% and 115% of target, blue significantly under (below 75%), amber for everything in between or above 115%.</P>
          </div>
        ),
      },
    ],
  },
  {
    id: 'backup',
    label: 'Backup and data',
    icon: <Shield size={18} />,
    color: 'text-emerald-400',
    sections: [
      {
        id: 'bk-ironsync',
        title: 'IronSync — Google Drive backup',
        content: (
          <div className="space-y-3">
            <P>IronSync connects to your Google Drive and mirrors your complete data store to a single JSON file in the app's private folder — not visible in your Drive's main file browser. The backup runs automatically after any data change: completing a workout, saving biometrics, editing a template, or changing settings.</P>
            <H>Connecting</H>
            <P>Open Settings and tap Connect IronSync (shown as Initialize Cloud Vault). You will be redirected to Google's OAuth consent screen. After authorising, you are redirected back and the connection is established. The OAuth token expires after one hour — IronSync attempts a silent refresh when the app loads.</P>
            <H>Device name</H>
            <P>When connected, you can set a device name (e.g. iPhone, Desktop) in the IronSync settings panel. This identifies which device performed the last backup — useful if you use IronFlow on multiple devices.</P>
            <H>Manual backup</H>
            <P>You can trigger a backup at any time from Settings by tapping Backup Now. Use this after making changes you want to preserve before closing the browser.</P>
            <H>Restoring</H>
            <P>Open Vault Backup → Restore from Cloud. This downloads your cloud backup and overwrites local data. The app reloads after a successful restore. Your connection settings are preserved — you will not need to reconnect.</P>
          </div>
        ),
      },
      {
        id: 'bk-vault',
        title: 'IronVault — local backup and restore',
        content: (
          <div className="space-y-3">
            <P>IronVault exports your complete data as a JSON file that you can save anywhere. This is your offline backup that does not depend on Google or any external service.</P>
            <P>To restore, open Vault Backup and drag your backup file onto the import area, or click to browse for it. The restore overwrites all current local data. The app reloads after a successful restore.</P>
            <Note>IronVault backups are complete snapshots — they include workout history, biometrics, nutrition logs, templates, settings, exercise library customisations, and food pantry items. All charts and analytics are derived from this data and will be fully reconstructed after a restore — nothing is lost.</Note>
          </div>
        ),
      },
      {
        id: 'bk-csv',
        title: 'CSV import and export',
        content: (
          <div className="space-y-3">
            <P>Manage Data (CSV) lets you export your workout history as a CSV file and import workout history from external CSV files. The export format is:</P>
            <Formula>Date, Exercise, Category, Weight, Weight Unit, Reps, Distance, Distance Unit, Time</Formula>
            <P>Imported CSVs are processed by the AI to resolve exercise names that do not exactly match the library — useful when importing from other apps that use different naming conventions. The AI maps ambiguous names to the closest matching exercise in the IronFlow library.</P>
          </div>
        ),
      },
      {
        id: 'bk-trash',
        title: 'Trash Can',
        content: (
          <div className="space-y-3">
            <P>Deleted templates are sent to the Trash Can rather than permanently removed. You can restore any deleted template from there. The Trash Can holds templates only — deleted workout history entries are permanently removed.</P>
          </div>
        ),
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings and AI',
    icon: <Bot size={18} />,
    color: 'text-violet-400',
    sections: [
      {
        id: 'st-settings',
        title: 'Settings reference',
        content: (
          <div className="space-y-3">
            <H>API key</H>
            <P>Your primary Gemini API key for all AI features. Stored only in your browser. A paid-tier fallback key can also be configured — IronFlow uses the free key first and switches to the paid key automatically when the free daily request limit is reached. Both keys are validated when entered.</P>
            <H>Biological Profile</H>
            <P>Gender and date of birth. Gender determines which Navy Method formula is used for body fat estimation (females require hip measurement) and which relative strength standards are shown. Date of birth feeds into the Mifflin-St Jeor BMR calculation used by the nutrition target and IFQ metabolic precision component. Set these before using the nutrition or biometrics features for accurate targets.</P>
            <H>Measurement system</H>
            <P>Switches the app between metric (kg, cm, km) and imperial (lb, in, mi). This affects display only — underlying data is stored in its logged unit and converted for display.</P>
            <H>Default rest timer</H>
            <P>The rest timer duration that starts automatically after each completed set, in seconds. Can be overridden mid-session.</P>
            <H>Keep Screen Awake</H>
            <P>When enabled, IronFlow requests a screen wake lock during active sessions — preventing the display from sleeping while you are training. The lock is released automatically when the session completes. Requires browser support for the Screen Wake Lock API; on unsupported browsers the toggle has no effect.</P>
            <H>Weekly workout goal</H>
            <P>The number of sessions per week you are aiming for. Used by the consistency streak counter and the anniversary card to determine whether a week counts as a successful training week.</P>
            <H>Exercise database</H>
            <P>The AI can expand your exercise library automatically. Set a target count and select the body parts you want covered, then tap Sync. The AI generates exercises up to the target, avoiding any already in your library. Each sync adds a maximum of 60 new exercises. Generated exercises include full instructions, muscle targets, setup cues, execution notes, tempo, breathing, and coaching cues — identical in structure to built-in exercises.</P>
            <H>MEV / MAV / MRV thresholds</H>
            <P>Custom volume thresholds per muscle group, overriding the built-in defaults. Available on desktop only, expandable from the Training Goals section. Adjust these if the defaults feel too conservative or too aggressive for your recovery capacity.</P>
            <H>AI personality</H>
            <P>Sets the tone of AI-generated content across the app. Options are Neutral (clinical and precise), Elite Coach (performance-focused, data-driven), Gym Bro (casual, hyped, gym slang welcome), and Custom (a short directive you write yourself, up to 200 characters, prepended to AI responses). The numbers and analysis remain accurate regardless of personality.</P>
          </div>
        ),
      },
      {
        id: 'st-ai',
        title: 'AI features overview',
        content: (
          <div className="space-y-3">
            <P>All AI features require a Gemini API key. Requests go directly from your browser to Google's API — they do not pass through any IronFlow server. The app uses different Gemini models depending on the task: the standard Flash model for program generation, template editing, morphology analysis, nutrition parsing, and workout discovery; the lighter Flash Lite model for exercise swap suggestions, per-exercise coaching tips, and the Evolution Review; and a third model reserved for features that combine live Google Search with structured data output.</P>
            <Ranges rows={[
              { label: 'Program Architect', value: 'Generates full training splits from a natural language brief', color: 'text-slate-300' },
              { label: 'Template editor AI', value: 'Modifies an existing template based on plain-language instructions', color: 'text-slate-300' },
              { label: 'Find a Workout', value: 'Generates a one-off session template from a description', color: 'text-slate-300' },
              { label: 'Exercise swap', value: 'Suggests alternative exercises for a given slot in a live session', color: 'text-slate-300' },
              { label: 'Exercise advice', value: 'Per-exercise AI coaching tip during a live session — Bot icon on each exercise', color: 'text-slate-300' },
              { label: "Architect's Evolution Review", value: 'Weekly check-in synthesising training, nutrition, biometrics, and current training protocols — in the Stats → Train view', color: 'text-slate-300' },
              { label: 'Food parser', value: 'Extracts macros from a natural language meal description', color: 'text-slate-300' },
              { label: 'Morphology analysis', value: 'Assesses muscle development from reference photos', color: 'text-slate-300' },
            ]} />
            <Note>AI costs are billed to your Gemini API key. Free-tier keys from aistudio.google.com provide a generous daily request allowance across the Gemini model family and are sufficient for normal use. If you hit rate limits the app will display an error and you can retry. Adding a paid-tier fallback key in Settings eliminates interruptions when the free daily limit is reached.</Note>
          </div>
        ),
      },
    ],
  },
];

// ── Main component ────────────────────────────────────────────────────────────

const HelpModal: React.FC<Props> = ({ onClose }) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string>('getting-started');
  const [activeSectionId, setActiveSectionId] = useState<string>('gs-overview');
  const [mobileView, setMobileView] = useState<'categories' | 'sections' | 'content'>('categories');

  const activeCategory = categories.find(c => c.id === activeCategoryId) ?? categories[0];
  const activeSection = activeCategory.sections.find(s => s.id === activeSectionId);

  const selectSection = (catId: string, secId: string) => {
    setActiveCategoryId(catId);
    setActiveSectionId(secId);
    setMobileView('content');
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          {mobileView !== 'categories' && (
            <button
              onClick={() => setMobileView(mobileView === 'content' ? 'sections' : 'categories')}
              className="lg:hidden p-2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h2 className="text-lg font-black text-slate-100 uppercase tracking-tight">Help & Reference</h2>
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">IronFlow Documentation</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 border border-slate-700 transition-all">
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Category sidebar ── */}
        <div className={`
          lg:flex flex-col w-full lg:w-52 shrink-0 border-r border-slate-800 overflow-y-auto
          ${mobileView === 'categories' ? 'flex' : 'hidden'}
        `}>
          <nav className="p-3 space-y-1">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategoryId(cat.id);
                  setActiveSectionId(cat.sections[0].id);
                  setMobileView('sections');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all
                  ${activeCategoryId === cat.id
                    ? 'bg-slate-800 border border-slate-700'
                    : 'hover:bg-slate-900 border border-transparent'}`}
              >
                <span className={`shrink-0 ${activeCategoryId === cat.id ? cat.color : 'text-slate-500'}`}>{cat.icon}</span>
                <span className={`text-[11px] font-black uppercase tracking-widest ${activeCategoryId === cat.id ? 'text-slate-100' : 'text-slate-400'}`}>
                  {cat.label}
                </span>
                <ChevronRight size={13} className="ml-auto text-slate-700 shrink-0" />
              </button>
            ))}
          </nav>
        </div>

        {/* ── Section list ── */}
        <div className={`
          lg:flex flex-col w-full lg:w-60 shrink-0 border-r border-slate-800 overflow-y-auto
          ${mobileView === 'sections' ? 'flex' : 'hidden'}
        `}>
          <div className="px-4 py-3 border-b border-slate-800 shrink-0">
            <span className={`text-[10px] font-black uppercase tracking-widest ${activeCategory.color}`}>
              {activeCategory.label}
            </span>
          </div>
          <nav className="p-3 space-y-1">
            {activeCategory.sections.map(sec => (
              <button
                key={sec.id}
                onClick={() => selectSection(activeCategory.id, sec.id)}
                className={`w-full text-left px-3 py-2.5 rounded-2xl transition-all
                  ${activeSectionId === sec.id
                    ? 'bg-slate-800 border border-slate-700'
                    : 'hover:bg-slate-900 border border-transparent'}`}
              >
                <span className={`text-xs font-bold ${activeSectionId === sec.id ? 'text-slate-100' : 'text-slate-400'}`}>
                  {sec.title}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* ── Content area ── */}
        <div className={`
          lg:flex flex-1 overflow-y-auto flex-col
          ${mobileView === 'content' ? 'flex' : 'hidden'}
        `}>
          {activeSection ? (
            <div className="max-w-2xl w-full mx-auto px-6 py-6">
              <h3 className="text-xl font-black text-slate-100 tracking-tight mb-5">{activeSection.title}</h3>
              {activeSection.content}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-700 text-sm font-black uppercase tracking-widest">
              Select a topic
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default HelpModal;
