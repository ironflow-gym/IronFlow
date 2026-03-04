import React, { useState } from 'react';
import { X, ChevronRight, ChevronDown, BookOpen, Dumbbell, BarChart3, Activity, Coffee, Shield, Database, Bot, Zap, Info, ExternalLink, ArrowLeft } from 'lucide-react';

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
      <div key={r.label} className="flex items-center justify-between bg-slate-900 rounded-xl px-4 py-2.5">
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{r.label}</span>
        <span className={`text-xs font-bold ${r.color ?? 'text-slate-200'}`}>{r.value}</span>
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
            <P>The three main views are Plan (your templates and programs), Workout (the active session screen), and Stats (all performance, biometric, and nutrition data). On mobile these are the bottom tabs; on a wider screen they move to the left sidebar.</P>
            <H>First steps</H>
            <P>Start by going to Plan and either generating a program with the AI or creating a template manually. Once you have at least one template, tap it to start a session. After a few sessions the Stats tab will start to populate with meaningful data.</P>
            <P>If you want the full picture — IronFlow Quotient, body composition projection, macro balance — you will also need to log at least one biometric entry in Stats → Bios and enable the nutrition log in Stats → Fuel.</P>
            <H>API key</H>
            <P>All AI features require a Gemini API key. If no key is configured, a setup prompt appears on load — you can dismiss it and configure the key later in Settings. The key is stored only in your browser and is sent directly to Google's API — it does not pass through any IronFlow server. AI features are unavailable until a key is provided. Free-tier keys from <Ref href="https://aistudio.google.com">aistudio.google.com</Ref> are sufficient for normal use.</P>
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
            <P>Because data lives in your browser, clearing your browser data will erase it. Use IronVault (Vault Backup in the menu) to keep a local JSON backup, and consider connecting IronSync for automatic cloud mirroring.</P>
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
            <P>A template is a named list of exercises with suggested sets, reps, and starting weights. You can create them manually, generate them with the AI Program Architect, or discover specific workouts using the Find a Workout feature.</P>
            <H>Program Architect</H>
            <P>The AI generates a full training split based on the goals, available days, and equipment you describe. The output is a set of templates — one per training day — that you can use immediately or edit first. You can prompt the AI to modify any template after the fact with plain instructions.</P>
            <H>Template editor (desktop)</H>
            <P>On a wide screen, editing a template opens a three-panel interface. The exercise library is on the left — drag exercises directly onto the canvas in the centre, or click to add them. The right panel shows exercise detail and your e1RM history for that movement when an exercise is selected. Panels are resizable by dragging the dividers.</P>
            <H>Workout discovery</H>
            <P>Find a Workout lets you describe what you want — "a 45-minute upper body session with dumbbells only" — and the AI generates a one-off template for it. This is separate from your saved programs and is useful for filling in around your main plan or for travel sessions.</P>
          </div>
        ),
      },
      {
        id: 'tr-logging',
        title: 'Logging a session',
        content: (
          <div className="space-y-3">
            <P>Tap a template to start a session, or start an ad-hoc session from the Workout tab if you want to log without a template. Each exercise shows a row per set. Enter weight and reps and tap the checkmark to log the set.</P>
            <H>Warmup sets</H>
            <P>Short-tap the set number circle (the round button to the left of the weight and rep fields) to toggle a set as a warmup. The circle turns amber and shows "W" when marked. Warmup sets are excluded from all analytics — they do not affect e1RM calculations, tonnage figures, or MEV/MRV counts. Long-pressing the same circle will flag the set for deletion instead. This matters: if you log warmup sets as working sets, every metric will be inflated.</P>
            <H>Rest timer</H>
            <P>The rest timer starts automatically after each completed set. The default duration is set in Settings. You can adjust it mid-session using the timer controls. When the timer reaches zero it pulses red — tap it to dismiss or let it sit if you are still resting.</P>
            <H>Interval timer</H>
            <P>For cardio exercises, an interval timer can be configured per-exercise directly in the active session. On cardio exercises a gear icon labeled 'Interval' appears in the exercise header — tap it to set the work and rest durations in seconds. Tap the Start button to begin the work phase countdown. When work time expires, the set is automatically completed and the rest countdown begins. Tap Start again for the next set.</P>
            <H>Exercise advice</H>
            <P>The Bot icon on each exercise in an active session triggers an AI coaching note specific to that movement. It takes into account your recent sets and history for that exercise and returns a short tip — a form cue, a load recommendation, or a technique note.</P>
            <H>Session Surgery</H>
            <P>Past sessions can be edited after the fact. From Stats → Train, drill down into any session date and tap the edit icon. This opens Session Surgery, which lets you correct weights, reps, or warmup flags on any logged set. Useful for fixing logging errors without deleting the whole session.</P>
            <H>Bulk rename</H>
            <P>If you have logged an exercise under an inconsistent name — say "Incline Press" and "Incline Bench Press" — you can relabel historical entries from the exercise drill-down view in Stats. Select the sessions to update and enter the new name. This rewrites the exercise name in your history without affecting the logged data.</P>
            <H>Cardio exercises</H>
            <P>Exercises categorised as cardio capture distance and duration instead of weight and reps. Logging a cardio set records distance, distance unit, and elapsed time rather than weight and reps. The interval timer (see above) is only available on cardio exercises.</P>
            <H>AI weight suggestions</H>
            <P>For resistance exercises, the app pre-populates the weight field from your training history. The default is your most recent logged working weight for that exercise. For templates that have been AI-optimised within the past 24 hours, the AI-recommended starting weight is used instead. Adjust it freely — it is a starting point, not a prescription.</P>
            <H>Exercise swap</H>
            <P>Tap the swap icon on any exercise to get AI-generated alternatives. The AI considers the muscle group and movement pattern and suggests exercises you can actually do as substitutions. The swap is applied to the current session only and does not modify your template.</P>
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
        id: 'an-e1rm',
        title: 'e1RM — Estimated one-rep max',
        content: (
          <div className="space-y-3">
            <P>The e1RM chart tracks your estimated one-rep maximum for a selected exercise over time. Select an exercise from the drill-down list to populate it.</P>
            <H>How it is calculated</H>
            <P>IronFlow uses the Epley formula, one of the most widely validated rep-max estimators in the literature:</P>
            <Formula>e1RM = weight × (1 + reps / 30)</Formula>
            <P>Reps are capped at 36 in the calculation to avoid extrapolation artefacts at very high rep ranges where the formula becomes unreliable. If you log a single rep, that weight is used directly as the e1RM.</P>
            <P>Only working sets are included — warmup sets are excluded. For each date, the highest e1RM across all sets for that exercise is used.</P>
            <H>How to read it</H>
            <P>A rising trend over weeks is the primary signal of strength progress. Day-to-day variation is normal — fatigue, sleep, and nutrition all affect a given session. Look at the 4–8 week trend rather than individual data points.</P>
            <H>Realistic expectations</H>
            <P>Strength gains depend heavily on training age. Beginners can see e1RM increases of 2–5% per week on compound lifts in the early months. Intermediates typically progress 1–2% per week averaged over a training block. Advanced lifters may see 0.25–0.5% per week and need to plan training in deliberate phases to keep progressing.</P>
            <Ref href="https://pubmed.ncbi.nlm.nih.gov/14636102/">Epley (1985) — original formula derivation</Ref>
          </div>
        ),
      },
      {
        id: 'an-volume',
        title: 'Muscle volume — MEV, MAV, MRV',
        content: (
          <div className="space-y-3">
            <P>This chart shows your weekly set count per muscle group plotted against three thresholds derived from the volume landmark framework popularised by Dr Mike Israetel and Renaissance Periodization.</P>
            <H>The three thresholds</H>
            <Ranges rows={[
              { label: 'MEV — Minimum Effective Volume', value: 'The floor. Below this, the muscle is not accumulating a training stimulus sufficient to drive adaptation.', color: 'text-slate-300' },
              { label: 'MAV — Maximum Adaptive Volume', value: 'The target range. Most hypertrophy occurs between MEV and MAV.', color: 'text-emerald-400' },
              { label: 'MRV — Maximum Recoverable Volume', value: 'The ceiling. Above this, performance typically degrades and injury risk rises.', color: 'text-rose-400' },
            ]} />
            <P>Default values are built into the app and can be adjusted per muscle group in Settings. The defaults are conservative estimates that apply reasonably well to intermediate trainees.</P>
            <H>How to read it</H>
            <P>The chart colour-codes each bar: grey below MEV, green within the MAV range, amber between MAV and MRV, red above MRV. A muscle group sitting grey for several consecutive weeks is being undertrained. Red for more than one week is a recovery risk.</P>
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
            <P>Cardio sets and warmups are excluded.</P>
            <H>Why it matters</H>
            <P>Tonnage captures both the intensity and volume of training in a single number. Two weeks with the same set count but different tonnage represent genuinely different amounts of work. A rising tonnage trend over weeks is the clearest mechanical signal of progressive overload — you are doing more total work than before.</P>
            <H>How to read it</H>
            <P>The dashed line shows your average across completed weeks — the current partial week is excluded. Weeks meaningfully above the average represent higher-than-usual workload; weeks below represent deloads or missed sessions. A flat trend over several weeks despite consistent attendance suggests you have stopped progressively overloading — consider increasing weight, reps, or sets.</P>
            <H>Realistic progression</H>
            <P>A 5–10% increase in weekly tonnage per training block (typically 4–6 weeks) is a sustainable rate of progression for intermediates. Larger jumps are associated with increased injury risk and are the primary driver of what the ACWR gauge tracks.</P>
          </div>
        ),
      },
      {
        id: 'an-acwr',
        title: 'Acute:Chronic Workload Ratio (ACWR)',
        content: (
          <div className="space-y-3">
            <P>ACWR compares your recent workload (acute load) to your established training base (chronic load). The gauge gives you a snapshot of whether your current week is proportionate to what your body has adapted to.</P>
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
            <Note>ACWR has attracted academic criticism, primarily because the acute window overlaps with the chronic window (a mathematical coupling issue that can produce spurious results). It is best treated as a directional indicator rather than a precise risk score. If you feel recovered, the gauge being amber is not a reason to skip a session. If you feel beaten up and the gauge is red, that is worth taking seriously.</Note>
            <Ref href="https://pubmed.ncbi.nlm.nih.gov/27022673/">Hulin et al. (2016) — the original ACWR injury risk paper</Ref>
            <br />
            <Ref href="https://pubmed.ncbi.nlm.nih.gov/30765414/">Impellizzeri et al. (2019) — critical review of ACWR limitations</Ref>
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
            <P>In the Stats → Train view on mobile, a monthly calendar shows each day of the current month. Days where you logged a session are highlighted with an emerald green dot. Use the left and right arrows to navigate between months. Tapping a session day opens the drill-down for that session.</P>
            <H>Desktop — Consistency Heatmap</H>
            <P>In the Performance Hub on desktop, a GitHub-style contribution grid shows a rolling 3-month, 6-month, or 1-year window. Each cell is one day — darker green means more tonnage logged that day, grey means no session. Hover over a cell to see the exercises and total tonnage for that day.</P>
            <H>How to read it</H>
            <P>Scan for gaps. A week-long gap is a deload or holiday — normal. A recurring gap on the same days each week might reveal a scheduling pattern worth addressing. Consistent coverage across weeks is the strongest indicator of the training frequency that drives long-term adaptation.</P>
          </div>
        ),
      },
      {
        id: 'an-patterns',
        title: 'Training day distribution and session duration',
        content: (
          <div className="space-y-3">
            <H>Day distribution</H>
            <P>Shows how many sessions you have logged on each day of the week across all recorded history. The highest bar is highlighted. This is purely observational — it reveals your actual training schedule rather than your intended one, and the two are often different.</P>
            <H>Session duration</H>
            <P>Plots your average session length in minutes per week over the last 12 weeks. Duration is captured from the time you start a session to when you complete it.</P>
            <P>A shortening duration trend alongside a flat or falling tonnage trend often indicates accumulated fatigue — sessions are getting cut short. A rising duration without rising tonnage suggests increasing rest periods or more time spent between exercises.</P>
            <Note>Session duration requires the app to be open for the full session to capture an accurate figure. If you close and reopen the app mid-session the timer resets.</Note>
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
            <P>The biometrics form accepts bodyweight, body fat percentage, height, and a set of circumference measurements. None of the fields are required — log what you have and the app will derive whatever metrics are possible from the available data.</P>
            <P>For the most useful data, log bodyweight and body fat at the same time of day under consistent conditions — first thing in the morning, post-bathroom, before eating. Circumference measurements are best taken at the same point in the week (same day relative to training, same time of day) as hydration affects them.</P>
            <H>Body fat input</H>
            <P>You can enter body fat from any source — DEXA, calipers, bioelectrical impedance, or your own estimate. If you have entered height, waist, and neck measurements (and hips for females), a Navy Method estimate is calculated and shown as a live preview at the bottom of the measurements form.</P>
          </div>
        ),
      },
      {
        id: 'bio-navy',
        title: 'Navy Method body fat estimate',
        content: (
          <div className="space-y-3">
            <P>The US Navy circumference method estimates body fat from tape measurements. It requires height, waist circumference (at the navel), and neck circumference. Females additionally require hip circumference.</P>
            <H>Formula</H>
            <P>Male:</P>
            <Formula>BF% = 495 / (1.0324 − 0.19077 × log10(waist − neck) + 0.15456 × log10(height)) − 450</Formula>
            <P>Female:</P>
            <Formula>BF% = 495 / (1.29579 − 0.35004 × log10(waist + hips − neck) + 0.22100 × log10(height)) − 450</Formula>
            <P>All measurements in centimetres.</P>
            <H>Accuracy</H>
            <P>The Navy method has a standard error of roughly ±3–4% compared to hydrostatic weighing in the original validation study. It is reasonably accurate for the average person but tends to underestimate body fat in very lean individuals and overestimate it in very muscular ones. It is most useful as a consistency check against your entered body fat rather than as a standalone truth.</P>
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
            <P>FFMI has been used as an indirect indicator of enhanced versus natural status. Kouri et al. (1995) found that non-users of anabolic steroids rarely exceeded an FFMI of 25, while users frequently exceeded it. This is a population-level observation — individual outliers exist, particularly among very tall athletes.</P>
            <H>Realistic expectations</H>
            <P>Most natural male trainees reach their genetic FFMI ceiling somewhere between 22 and 25 after many years of training. Gaining 1 FFMI point requires roughly 5–7 kg of additional lean mass. Reaching 20 from a starting point of 17–18 typically takes 3–5 years of consistent training. Progress slows substantially as you approach your ceiling.</P>
            <Ref href="https://pubmed.ncbi.nlm.nih.gov/7550706/">Kouri et al. (1995) — FFMI and anabolic steroid use</Ref>
          </div>
        ),
      },
      {
        id: 'bio-ratios',
        title: 'Aesthetic ratios — SWR and CWR',
        content: (
          <div className="space-y-3">
            <P>These ratios measure structural proportions rather than body composition. They require circumference measurements logged in the biometrics form. Higher values mean a more tapered frame — broader shoulders or chest relative to waist.</P>
            <H>Shoulder-to-Waist Ratio (SWR)</H>
            <Formula>SWR = shoulder circumference / waist circumference</Formula>
            <P>SWR measures the X-frame — how much wider the shoulders are than the waist. A higher ratio means more dominant shoulder width. Available for both males and females. The golden ratio (~1.618) has long been cited as the aesthetic ideal in physique sport.</P>
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
            <P>The 0.5 threshold ("keep your waist less than half your height") is a commonly cited rule of thumb that holds reasonably well across different populations and body sizes. Values below 0.5 are associated with substantially lower risk of cardiovascular disease, type 2 diabetes, and hypertension compared to values above 0.5, independent of BMI.</P>
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
            <P>IronFlow tracks this for bench press, squat, deadlift, overhead press, and barbell row. The app auto-detects these from exercise names — any exercise containing "bench", "squat", "deadlift", "overhead press", "OHP", "military press", "barbell row", "bent-over row", or common close variations (such as "chest press", "trap bar", "strict press", "Pendlay row") is mapped to the relevant standard. An exclusion list prevents false positives — hack squats, Romanian deadlifts, incline bench, and similar exercises that do not share the same strength standard are automatically excluded.</P>
            <H>Strength levels (male)</H>
            <Ranges rows={[
              { label: 'Bench — Beginner / Novice / Intermediate / Advanced / Elite', value: '0.5× / 0.75× / 1.0× / 1.5× / 2.0× BW', color: 'text-slate-300' },
              { label: 'Squat', value: '0.75× / 1.0× / 1.5× / 2.0× / 2.5× BW', color: 'text-slate-300' },
              { label: 'Deadlift', value: '1.0× / 1.25× / 1.75× / 2.25× / 3.0× BW', color: 'text-slate-300' },
              { label: 'OHP', value: '0.25× / 0.5× / 0.75× / 1.0× / 1.5× BW', color: 'text-slate-300' },
              { label: 'Barbell Row', value: '0.5× / 0.75× / 1.0× / 1.5× / 2.0× BW', color: 'text-slate-300' },
            ]} />
            <H>Strength levels (female)</H>
            <Ranges rows={[
              { label: 'Bench — Beginner / Novice / Intermediate / Advanced / Elite', value: '0.25× / 0.5× / 0.75× / 1.0× / 1.5× BW', color: 'text-slate-300' },
              { label: 'Squat', value: '0.5× / 0.75× / 1.0× / 1.5× / 2.0× BW', color: 'text-slate-300' },
              { label: 'Deadlift', value: '0.75× / 1.0× / 1.25× / 1.75× / 2.5× BW', color: 'text-slate-300' },
              { label: 'OHP', value: '0.15× / 0.3× / 0.5× / 0.65× / 1.0× BW', color: 'text-slate-300' },
              { label: 'Barbell Row', value: '0.25× / 0.5× / 0.75× / 1.0× / 1.5× BW', color: 'text-slate-300' },
            ]} />
            <P>These standards are derived from aggregated powerlifting and strength sport data. They represent reasonable population benchmarks — not competitive standards. An "Intermediate" rating means you are stronger than the majority of people who train consistently, not that you are ready to compete.</P>
            <H>Realistic progression</H>
            <P>Moving one level — say from Novice to Intermediate on bench — typically takes 1–3 years of consistent training depending on starting point and genetics. The gap between levels compresses at higher levels: going from Beginner to Novice is faster than going from Advanced to Elite.</P>
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
            <P>Linear regression finds the straight line that best fits your historical data points and extends it forward. It needs at least 3 biometric entries to draw a projection line. The more entries you have, the more reliable the projection.</P>
            <Note>Linear trends in body composition do not continue indefinitely. The projection assumes your current diet and training remain constant — which they will not. Use it as a planning tool: "if I maintain my current deficit, where does this put me in 12 weeks?" rather than as a prediction. Changes in training, diet, or life circumstances will shift the trajectory.</Note>
            <H>Lean vs fat projection</H>
            <P>Lean mass and fat mass projections only appear if you have logged body fat percentage alongside bodyweight. Without body fat data, only total weight is projected. Body fat from any measurement method (DEXA, calipers, bioimpedance, Navy estimate) can be entered manually.</P>
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
            <P>The score has three components that are weighted based on what data is available:</P>
            <Ranges rows={[
              { label: 'Training Consistency (35%)', value: 'Sessions per week over 28 days vs your 12-week baseline', color: 'text-slate-300' },
              { label: 'Metabolic Precision (30%)', value: 'Caloric intake vs goal-adjusted target over last 7 days', color: 'text-slate-300' },
              { label: 'Adaptation Alignment (35%)', value: 'Weight/composition movement over 28 days vs your stated goal', color: 'text-slate-300' },
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
            <H>Calibrating state</H>
            <P>New users or those returning from a break will see "Calibrating" instead of a score. This happens when the 28-day training window contains less than 40% of the expected session signal — in other words, there is not enough data to produce a meaningful number. The score appears once the window is sufficiently populated (typically 2–4 weeks of regular training).</P>
            <Note>The IFQ is most meaningful when all three data sources are active — training logs, nutrition logs, and biometric entries. A high score with only training data tells you that you are training consistently; it cannot tell you whether your nutrition and body composition are aligned with your goal.</Note>
          </div>
        ),
      },
      {
        id: 'bio-morphology',
        title: 'Morphology Lab',
        content: (
          <div className="space-y-3">
            <P>The Morphology Lab uses AI image analysis to assess visible muscle development across 13 muscle groups from reference photos. You can submit 4 photos (front, back, left side, right side) or 8 photos for a more detailed analysis.</P>
            <P>Each scan produces scores from 0 to 100 per muscle group. These are qualitative assessments based on visible development — they reflect what is visible in the photos, not absolute muscle mass. Lighting, posing, and body fat level all affect the output.</P>
            <H>28-day cooldown</H>
            <P>A 28-day minimum is enforced between scans. Meaningful changes in visible muscle development require at least this long — running the scan weekly would generate noise rather than signal. Four weeks is also roughly the minimum adaptation window for hypertrophy to be measurable.</P>
            <Note>The Morphology assessment is experimental. It is useful for identifying lagging muscle groups that benefit from rebalancing your program, but it should not be treated as a precise measurement. Use it alongside your training data and your own assessment in the mirror.</Note>
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
            <P>Type what you ate in plain language and tap Send. The AI parses the description and returns estimated macros with a confidence score. You can edit any value before saving.</P>
            <P>Common foods are matched against a bundled Australian AFCD (Australian Food Composition Database) dataset of 1,588 foods — these lookups happen locally without a network call. Packaged or branded products that are not in the AFCD are looked up via the Open Food Facts API.</P>
            <H>Confidence score</H>
            <P>The confidence score on each log entry reflects how well the AI could match your description to known nutritional data. A score above 80% indicates a confident match. Below 50% means the AI made significant assumptions — review and edit the macros if the entry is nutritionally important to you.</P>
            <H>Food Pantry</H>
            <P>Frequently used foods can be saved to the Food Pantry. Pantry items can be logged directly from the pantry view without going through the AI parser, which is faster and more consistent for foods you eat regularly. The Pantry also includes a camera scan feature — point your camera at a nutrition label and the AI reads the values directly into a new pantry item.</P>
          </div>
        ),
      },
      {
        id: 'nu-targets',
        title: 'Caloric and macro targets',
        content: (
          <div className="space-y-3">
            <P>Targets are calculated from your goal, biometric data, and the target multiplier slider in the Fuel settings.</P>
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
            <P>Protein targets are set by bodyweight using ISSN position stand figures as a base: 1.6 g/kg for muscle building, 1.8 g/kg for fat loss (higher protein helps preserve lean mass during a deficit), and 1.2 g/kg for maintenance. Vegetarian preferences add an 8% uplift to account for lower plant protein bioavailability; vegan adds 15%. A high-protein preference floors the ratio at 2.2 g/kg regardless of goal. All values are clamped to a maximum of 2.8 g/kg. Protein targets are not affected by the calorie multiplier — they are set by bodyweight, not by caloric intake.</P>
            <Ref href="https://pubmed.ncbi.nlm.nih.gov/28642676/">ISSN position stand — protein and exercise (2017)</Ref>
          </div>
        ),
      },
      {
        id: 'nu-radar',
        title: 'Macro balance radar chart',
        content: (
          <div className="space-y-3">
            <P>The radar chart shows your 7-day average intake across four axes — calories, protein, carbohydrates, and fat — expressed as a percentage of your calculated targets. The dashed outline represents 100% on each axis (your target). Your actual intake is the filled shape inside it.</P>
            <H>How to read it</H>
            <P>A shape that closely approximates the dashed target outline means your intake is well matched to your targets across all four macros. A shape that is significantly smaller on one axis — say protein — tells you that macro is consistently undershot. A shape that bulges beyond the outline on calories while matching protein indicates excess caloric intake from carbs or fat.</P>
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
            <P>IronSync connects to your Google Drive and mirrors your complete data store to a single JSON file in the app's private folder (not visible in your Drive's main file browser). The backup runs automatically after any data change — completing a workout, saving biometrics, editing a template, or changing settings.</P>
            <H>Connecting</H>
            <P>Open Settings and tap Connect IronSync. You will be redirected to Google's OAuth consent screen. After authorising, you are redirected back and the connection is established. The OAuth token is stored locally and expires after one hour — IronSync attempts a silent refresh when the app loads.</P>
            <H>Manual backup</H>
            <P>You can trigger a backup at any time from Settings → IronVault: Cloud Backup → Backup Now. Use this after making changes you want to preserve before closing the browser.</P>
            <H>Restoring</H>
            <P>Open Vault Backup → Restore from Cloud. This downloads your cloud backup and overwrites local data. The app reloads after a successful restore. Your current connection settings are preserved across the restore — you will not need to reconnect.</P>
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
            <Note>IronVault backups are complete snapshots — they include workout history, biometrics, nutrition logs, templates, settings, and session summaries. Keep at least one recent backup on a device other than the one you train with.</Note>
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
            <H>Units</H>
            <P>Switches the app between metric (kg, cm, km) and imperial (lb, in, mi). This affects display only — underlying data is stored in its logged unit and converted for display.</P>
            <H>Default rest timer</H>
            <P>The rest timer duration that starts automatically after each completed set, in seconds. Can be overridden mid-session.</P>
            <H>Weekly workout goal</H>
            <P>The number of sessions per week you are aiming for. Used by the week streak counter and the session frequency display in the Performance Hub to determine whether a week counts as a successful training week.</P>
            <H>Exercise database</H>
            <P>The AI can expand your exercise library automatically. Set an auto-populate target count and select the body parts you want covered, then tap Sync. The AI generates exercises up to the target, avoiding any that are already in your library. Each sync adds a maximum of 60 new exercises. If the target is lower than the current library size, the oldest custom entries are trimmed to match. The generated exercises include full instructions, muscle targets, setup cues, execution notes, tempo, breathing, and coaching cues — identical in structure to built-in exercises.</P>
            <H>MEV/MRV thresholds</H>
            <P>Custom volume thresholds per muscle group, overriding the built-in defaults. Adjust these if the defaults feel too conservative or too aggressive for your recovery capacity.</P>
            <H>Desktop widget visibility</H>
            <P>Each section of the Performance Hub can be collapsed or expanded by clicking its section header. The collapsed state resets when you reload the page.</P>
            <H>AI personality</H>
            <P>Sets the tone of AI-generated content — session summaries, evolution reviews, program rationale. Options are Neutral, Elite Coach, Gym Bro, and Custom. Custom allows you to write a short personality brief that the AI follows.</P>
          </div>
        ),
      },
      {
        id: 'st-ai',
        title: 'AI features overview',
        content: (
          <div className="space-y-3">
            <P>All AI features require a Gemini API key. Requests go directly from your browser to Google's API — they do not pass through any IronFlow server. The app uses different Gemini models depending on the task: Flash for program generation, template editing, morphology analysis, nutrition parsing, and workout discovery; and Flash Lite for lighter tasks including exercise swap suggestions, per-exercise coaching tips, session summaries, and the Evolution Review.</P>
            <Ranges rows={[
              { label: "Program Architect", value: "Generates full training splits from a natural language brief", color: 'text-slate-300' },
              { label: "Template editor AI", value: "Modifies an existing template based on instructions", color: 'text-slate-300' },
              { label: "Find a Workout", value: "Generates a one-off session from a description", color: 'text-slate-300' },
              { label: "Exercise swap", value: "Suggests alternative exercises for a given slot", color: 'text-slate-300' },
              { label: "Exercise advice", value: "Per-exercise AI coaching tip during a live session (Bot icon on each exercise)", color: 'text-slate-300' },
              { label: "Architect's Session Wrap", value: "AI summary of a completed session, generated from the drill-down view", color: 'text-slate-300' },
              { label: "Architect's Evolution Review", value: "Weekly check-in based on recent training data, in the Stats → Train view", color: 'text-slate-300' },
              { label: "Food parser", value: "Extracts macros from a natural language meal description", color: 'text-slate-300' },
              { label: "Morphology analysis", value: "Assesses muscle development from reference photos", color: 'text-slate-300' },
            ]} />
            <Note>AI costs are billed to your Gemini API key. Free tier keys from aistudio.google.com are sufficient for normal use — the free tier provides a generous daily request allowance across the Gemini model family. If you hit rate limits the app will display an error and you can retry.</Note>
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['gs-overview']));
  const [mobileView, setMobileView] = useState<'categories' | 'sections' | 'content'>('categories');

  const activeCategory = categories.find(c => c.id === activeCategoryId) ?? categories[0];
  const activeSection = activeCategory.sections.find(s => s.id === activeSectionId);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectSection = (catId: string, secId: string) => {
    setActiveCategoryId(catId);
    setActiveSectionId(secId);
    setExpandedSections(prev => new Set([...prev, secId]));
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
