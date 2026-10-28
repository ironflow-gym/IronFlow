import { GettingStartedArticle, ChoosingWeightArticle, RestoreBackupArticle } from './help/ExampleArticles';
import { STRENGTH_STANDARDS } from '../src/utils';
import React, { useState, useEffect, useRef } from 'react';
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
  <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 my-3 font-mono text-xs text-emerald-400 leading-relaxed whitespace-pre-wrap break-words">
    {typeof children === 'string' ? children.replace(/\\n/g, '\n') : children}
  </div>
);

const Ref: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer"
    className="flex w-fit items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs font-bold transition-colors">
    {children}<ExternalLink size={10} />
  </a>
);

const Ranges: React.FC<{ rows: { label: string; value: string; color?: string }[] }> = ({ rows }) => (
  <div className="space-y-1.5 my-3">
    {rows.map(r => (
      <div key={r.label} className="flex flex-col sm:flex-row items-start sm:justify-between bg-slate-900 rounded-xl px-4 py-2.5 gap-2 sm:gap-3">
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest min-w-0">{r.label}</span>
        <span className={`text-xs font-bold sm:text-right min-w-0 ${r.color ?? 'text-slate-200'}`}>{r.value}</span>
      </div>
    ))}
  </div>
);

// ── Content ──────────────────────────────────────────────────────────────────

const section = (id: string, title: string, ...parts: React.ReactNode[]): Section => ({
  id, title, content: <div className="space-y-3">{parts.map((part, index) => <React.Fragment key={index}>{typeof part === 'string' ? <P>{part}</P> : part}</React.Fragment>)}</div>,
});

const categories: Category[] = [
  { id: 'getting-started', label: 'Getting Started', icon: <BookOpen size={18} />, color: 'text-emerald-400', sections: [
    section('gs-overview', 'Start your first workout', <GettingStartedArticle />),
    section('gs-data', 'Your data and privacy',
      'Your workout history, routines, training blocks, calendar, food, pantry, saved meals, measurements and preferences live in this browser’s storage. Different browsers and devices have separate copies. There is no IronFlow account or application backend storing your records.',
      'AI requests send task-relevant descriptions, records or images to Google Gemini. Barcode and packaged-food searches may contact Open Food Facts. Connecting IronSync sends backup data to Google Drive. The app also loads resources such as Google fonts and sign-in scripts; it is not accurate to describe all app traffic as local.',
      'API keys and connection credentials are stored in this browser. Keep JSON backups private: they contain personal records and preferences. Clearing site data, changing browsers, private-browsing cleanup or device loss can remove local records. A local save is not a separate backup.',
      'IronSync backs up device snapshots; it does not continuously merge devices. Google Calendar integration is not currently implemented.'),
    section('gs-offline', 'Offline use, installation and updates',
      'IronFlow is a progressive web app. Where supported, use your browser’s install or Add to Home Screen option. Installation does not move records to a server or make another browser share them.',
      'Once the app and needed resources are available locally, routine logging, calendar management, blocks, existing history, progression calculations, manual food entries, saved meals and existing pantry items can work without AI or network access.',
      'AI requests, new online food lookups, Google authorisation and Drive transfers require a connection. Browser caching and offline startup vary; open the app before relying on it offline. A timer notification or wake lock is not guaranteed while the browser is suspended.',
      'After an update, reopen or reload when convenient. Wait for local saving to finish first, and keep backups. Browser storage is tied to the site and browser profile; an installed copy is not an independent recovery copy.'),
    section('gs-saving', 'Saving, failed saves and recovery',
      'Changes autosave locally. Watch the saving, saved or failed status. On failure, keep the tab open and choose Retry save. Failed writes are retained in memory for retry, but cannot survive closing the tab if browser storage cannot accept them.',
      'The app warns about leaving with unsaved changes. If the initial database read fails, autosave is blocked to avoid overwriting existing records. Resolve the storage/read problem before continuing.',
      'Drive uploads follow successful local saves through a queue. Pending backup revisions survive reconnects when local storage is working. A cloud failure does not mean the local save failed, and a local saved indicator does not prove that Drive has the latest copy.',
      'If something looks missing, avoid clearing site data or using Master Reset. Check that you are in the same browser/profile/site and review a known backup before replacing anything.'),
  ]},
  { id: 'training', label: 'Training', icon: <Dumbbell size={18} />, color: 'text-emerald-400', sections: [
    section('tr-today', 'Today and choosing a workout',
      'Today prioritises an unfinished workout, then an explicit scheduled workout or rest day. Otherwise it offers the next unresolved active-block session, or the next routine in the ordinary rotation. If no routine exists, choose or create one.',
      'The workout card shows exercises, working sets, an estimated duration and the last recorded performance where available. Preview lets you inspect the session before starting. Choose another and Manage routines keep unscheduled training available.',
      'Weekly progress compares completed sessions with the current goal. Missed appointments remain visible until you reschedule or skip them. Review this week opens the factual weekly review; it does not require AI.'),
    section('tr-calendar', 'Training calendar and day markers',
      'The calendar is on Today. Use previous/next week or This week. Mobile has a horizontally scrollable day strip and appointments for the selected day; desktop shows the week’s day panels.',
      'Each mobile day shows weekday, date and month. One or two emerald dots mean pending scheduled workouts; 3+ means three or more. A tick means completed training, including unscheduled sessions. An amber ! marks unresolved missed workouts; a dash marks planned rest. Mixed days retain multiple markers. Today has an emerald outline; the selected day has a filled background.',
      'Schedule workout or rest adds an appointment for a local calendar date. Choose an existing routine or an explicit rest day, with optional weekly repetition. Multiple workouts on one date are supported. Edit / reschedule moves or replaces an appointment; Remove deletes the selected occurrence or recurrence scope.',
      'For weekly repetitions, choose This occurrence or This and future occurrences. Past completed occurrences retain their records. Skipping resolves that appointment without counting as training; Undo skip makes it planned again. Missed workouts never shift automatically.',
      'Appointments link to routine IDs. Renaming a routine updates future planning without rewriting historical workout names. A deleted routine shows Routine unavailable so you can replace or remove the appointment. An already-started workout keeps its exercise snapshot.',
      'Completion fulfils the specific appointment attached when the workout started. A matching name or date alone does not assign an unscheduled workout. A workout performed on another date remains recorded on its actual completion date.'),
    section('tr-blocks', 'Goal-based training blocks',
      'Open Today → Manage routines → Create training block. Choose the goal, training days per week, different workouts per round, number of rounds, session length, experience, equipment and optional priorities. Sport/event preparation also asks for event context. Returning after a break informs the plan.',
      'The goal catalogue covers strength, muscle growth, fat loss, recomposition, general fitness, cardiovascular endurance, muscular endurance, power, mobility, healthy ageing/everyday function, sport/event preparation and maintaining fitness.',
      'Days per week and different workouts are independent: four workouts across a three-day week continue into the next week. Rounds repeat those distinct workouts. Choose saved routines, build manually or generate the coordinated programme with AI. The AI receives the selected setup; changing setup after generation requires regenerating or replacing those generated workouts.',
      'Review before starting. Only one block can be active. Blocks continue until sessions are completed or explicitly skipped, rather than expiring after a calendar duration. Scheduling is optional and supports several appointments on a day; review conflicts before applying dates.',
      'View block provides session actions, skip/undo, results, scheduling and future-workout edits. Out-of-order training is supported. Only an explicitly assigned workout resolves that block session. A partial workout asks whether to count it or log it only. Started/completed snapshots and source routines remain unchanged by future edits.',
      'When all sessions are resolved, finish explicitly. You can end early or reuse the programme for a new block; unfinished workouts need deliberate handling. Calendar changes never silently advance the block.',
      'Power, mobility, endurance and sport goals use fixed prescriptions with manual adjustment. Ordinary resistance goals use the existing working-set progression. Timed exercises record seconds without strength progression.',
      'Goals with a Food proposal show a current-versus-proposed comparison. Food settings change only with explicit approval. Review block nutrition in Food or the block manager offers a comparison before restoring previous settings, including when you have since edited targets.',
      "To attach an ordinary unfinished workout, open View block → the intended unresolved session → Session details and options → Assign current workout, then confirm. The workout must not already belong to a block. Assignment links it explicitly without replacing its exercises or values; partial completion still asks whether to count it.",
      "Schedule remaining sessions asks for a start date and exactly the configured number of training weekdays. Preview appointments shows the workout order spanning weeks. Existing workouts/rest days remain; overlapping dates require Keep existing appointments and add these sessions before saving. An individual session can instead use Schedule or Reschedule for its chosen date."),
    section('tr-block-ai', 'Correcting AI-generated block workouts',
      'AI generation inside block creation first validates the programme and attempts one automatic correction for ambiguous or inconsistent exercise targets. Harmless dash and seconds formatting can be normalised.',
      'If a structurally valid programme still needs target corrections, it remains an unsaved draft. Marked workouts show the exercise name, the AI’s original target, the specific problem and prescription fields. Choose reps or time and enter a clear target and starting value. For example, use 8-12 reps or 30 seconds, rather than an ambiguous mixed instruction.',
      'Review and block creation remain blocked until required corrections are resolved. You can also edit or remove the affected workout. Nothing is saved as a usable block before final approval.',
      'Unreadable JSON, missing structures, invalid numeric values or an incorrect workout count cannot be safely staged. The error explains the cause and next action; existing staged workouts and saved records are retained. Generate again or choose/build workouts manually.',
      'This correction flow applies only to generation within the block builder. Other AI workout features retain their existing strict validation and may reject an invalid response outright.'),
    section('tr-templates', 'Routines, programmes and workout discovery',
      'A routine/template is a named list of exercises with sets, targets, starting values and rest. Manage routines supports manual creation, editing, starting and deletion. Excluding a routine from rotation keeps it saved without making it the ordinary next-workout choice.',
      'Program Architect generates coordinated workouts from your brief and requested session count. Review the returned templates before saving. AI editing modifies a routine from your instructions; preview/check the result rather than assuming the AI understood every constraint.',
      'Find a Workout can offer single sessions or multi-day programmes; it is not limited to one-off workouts. Review the proposal and its days before using or saving it. Generation requires a Gemini key and network access.',
      'On desktop the template editor has a library, exercise canvas and detail/history panel, with drag/add and resizable panels. Mobile uses a compact editor. Choose repetition or timed tracking and review working-set counts, starting values, targets and rest. Warmups are separate from prescribed working sets.',
      "In Program Architect, choose Session or Program and the requested cycle length. Generation can run a second pre-flight check and show changes or an unavailable-check warning. The result still needs your review. Global Cycle Guidance refines the staged programme as a whole; edit individual days before Commit Full Program. Single-session results have their own save/start actions.",
      "Neural Refresh is the circular refresh action on a saved routine. It uses AI and recorded history to re-optimise the routine, then saves the returned revision directly. It is not the local suggestion shown during a workout and does not use the block builder’s manual correction flow. Review the saved routine afterward; keep a backup before revisions you may want to undo.",
      "The template editor’s AI audit returns feedback about the proposed routine in its programme context; it is separate from AI editing. Desktop multi-day editing offers day tabs and an add-day action where available. Opening a saved named multi-day programme can load sibling days; review whether the save action applies to one routine or all days. Unsaved editor changes ask before discarding.",
      "Find a Workout retains discovery results with their last-refresh time. Refresh requests new AI suggestions. For a multi-day result, Save All Days stores every returned day, while Start Day 1 starts only the first. A single result offers Save to Plans and Initialize Session. Starting and saving are separate actions."),
    section('tr-logging', 'Logging and finishing a session',
      'Start from Today, the calendar, a routine or Workout. Tick each set only when completed. Weight is edited by tapping its number. Reps have inline minus/plus controls where space permits, including press-and-hold; tap the rep number for the focused editor. Very narrow screens use tap-to-edit for both values.',
      'The compact header keeps elapsed duration, Adapt this workout and Finish available. Rest appears in that header. Finish becomes available after a completed set and records completed sets only; remaining uncompleted sets are not invented as history. Session effort is optional.',
      'The workout draft is saved locally so you can resume. Its original start time is retained, so elapsed session duration includes time away from the app. Discard workout asks before removing the draft. Wait for a successful local save before closing.',
      'Each exercise has compact Change exercise and Increase weight actions. More options contains coaching, history and instructions. Previous matching set values include dates and converted units. A dated exception identifies comparisons taken from another session.',
      'Add sets or exercises as needed. Current-workout changes do not automatically edit future routine defaults. Ending a partial block workout may require the separate count-towards-block decision.'),
    section('tr-sets', 'Working, warmup and deload sets',
      'Tap the set-number circle to cycle Working → Warmup → Deload → Working. Enter or Space cycles it from a keyboard. Hold an unfinished set number to arm deletion, then tap its red tick/delete control. Delete on the keyboard arms the same action; Escape or another number tap cancels. Completed sets cannot be deleted from the active session.',
      'Copy set, Copy warmup and Copy deload copy the immediately preceding set’s values literally. They do not copy completion or change the receiving set’s classification. Check the label if the preceding set has a different classification.',
      'Warmup and deload flags keep sets out of automatic progression qualification and many strength/volume summaries. They do not erase a recorded session. Some workload charts intentionally include deload work; see the individual analytics topics rather than assuming one filter applies everywhere.',
      'Some historical strength views also infer statistical warmups at or below 60% of that day’s peak load. This inference is not a universal rule and does not replace explicit set classification.'),
    section('tr-progression', 'Choosing your next weight', <ChoosingWeightArticle />),
    section('tr-equipment', 'Equipment, units and plate loading',
      'Open Library, select an exercise and review its equipment configuration. Set the unloaded/base weight, available increment and whether plates load singly or as a pair. Equipment values are stored in kg and converted when using imperial display.',
      'Suggestions follow base weight plus achievable increments. For example, a 22.56 kg machine plus 5 kg and 2.5 kg totals 30.06 kg. Paired loading applies the increment on both sides; single loading applies it once. Configure the actual equipment rather than relying on a generic rounded weight.',
      'Dumbbell weights are per hand. Assistance weight means support being removed as you get stronger. Timed/cardio values have different meanings and should not be treated as resistance loads.',
      'Tap weight for the focused editor; expand Plate loading for the calculator and tap its preview for loading details. It subtracts the configured base and can show plates to leave, add or remove relative to a previous completed set. It may favour stripping and reloading when that takes fewer movements.',
      'The plate calculator uses the app’s available plate denominations; the increment/base configuration does not define a complete inventory of plates in your gym. Check the displayed loading and total against the equipment you actually have.'),
    section('tr-library', 'Exercise library and instructions',
      'Open Library from the main menu or desktop sidebar. Search and filter exercises, then open a detail to review muscles, instructions, benefits and risks. Enhanced entries can include setup, execution, tempo, breathing and coaching cues.',
      'Library management supports custom entries and exercise edits/deletion. Most library edits affect future catalogue selection. Changing the primary muscle also updates the matching historical primary-muscle assignments and can recalculate muscle-volume analytics; recorded weights and reps are kept. Equipment configuration is stored per exercise. Keep names consistent if you want history matching to find the same movement.',
      'Enhance with AI or database expansion requires a key and connection. Instructions are reference material, not live assessment of your form. Verify generated descriptions, category and muscle mappings before relying on their analytics.',
      "Search Global Database requests online/AI exercise results beyond your saved catalogue. Opening a result does not save it: use Add to Database to retain it. Create Custom Exercise lets you supply a name, category, primary/secondary muscles and instructions without AI.",
      "In exercise details, edit primary and secondary muscle tags when the mapping is wrong. Saving the primary tag retargets matching historical primary-muscle records; secondary mappings can affect analytics that consult the current library. This does not rename the exercise or change recorded loads/reps. Deleted exercises can be restored from Trash Can; see its current deletion limitation."),
    section('tr-adaptation', 'Adaptation, exercise changes and coaching',
      'Adapt this workout lets you preview changes for available time, low energy or replacements. Normal adaptation works locally from the session and exercise library; AI alternative suggestions are optional.',
      'Change exercise (rotating arrows) opens the focused exercise flow. Choose from the library or request AI alternatives. Completed work is protected, and started exercises have replacement restrictions. Review the comparison and apply explicitly. If the session changed while you were reviewing, generate a fresh comparison.',
      'Time estimates include work and rest. The app may remove pending working sets while keeping protected work; it can report that the requested limit cannot be met. It does not promise an exact finish time.',
      'Applied adaptations affect this workout and are recorded in Changes made. Routine defaults remain unchanged. The robot/coaching action is under exercise options and requires AI; it returns advice, not an automatic prescription change.'),
    section('tr-timers', 'Rest, intervals and keeping the screen awake',
      'Completing a set starts rest. A positive exercise-specific rest prescription takes precedence over the default in Settings. Warmup transitions can shorten rest; without prescribed rest, missed rep targets or exercise transitions may extend it. You can adjust or dismiss the timer.',
      'Rest appears in the compact workout header and turns red at zero. Browser audio, vibration and background timing depend on device permissions and suspension; a notification is not guaranteed when the app is hidden.',
      'Cardio exercises can use the Interval control to set work/rest seconds. Start begins work; when the work countdown expires, the set is completed and rest begins. Start the next interval explicitly. Cardio records distance/intensity and duration, while timed holds use seconds rather than strength reps.',
      'Keep Screen Awake in Settings requests a browser wake lock during a session. It requires browser support and can be interrupted by backgrounding or device power behaviour. The elapsed workout timer uses the saved start time, including breaks.',
      "During ordinary between-set rest, Save rest to protocol (the bookmark/book icon) explicitly saves the exercise rest prescription to a saved routine matching the current workout name and exercise name. This changes future rest settings; simply adjusting or dismissing the timer does not. Interval-rest countdowns do not offer this save action, and a block snapshot or renamed/ad-hoc session may have no matching saved routine."),
    section('tr-rpe', 'Session RPE rating',
      'After Finish, optionally rate the overall session effort from 1 to 10 or Skip. This is one rating for the workout, not a reps-in-reserve score for each set.',
      <Ranges rows={[{ label: '1–3', value: 'Easy overall effort' }, { label: '4–6', value: 'Moderate overall effort' }, { label: '7–8', value: 'Hard overall effort' }, { label: '9–10', value: 'Very hard to maximal overall effort' }]} />,
      'Use a consistent personal interpretation after the session settles. No single range is a universal target for every workout or goal.',
      'The app stores session duration and, when rated, session load = RPE × elapsed minutes. Workload and recovery panels use available ratings. Long pauses count in elapsed duration, so this is an estimate of session demand, not a physiological measurement.'),
    section('tr-history', 'Correcting recorded workouts',
      'In Stats → Train, open a recorded date/session and use the edit action for Session Surgery. Correct logged weights, reps and set flags, then save. Historical changes affect the analytics recalculated from those records.',
      'Exercise drill-down supports relabelling selected historical entries when the same movement was logged under different names. Review the selected records before applying a bulk rename; numeric performance remains recorded.',
      'Historical workout names are snapshots and are not rewritten simply because you rename a routine. Deleting workout history is different from deleting a routine: the template Trash Can is not a recovery bin for logged sets. Keep a JSON backup before substantial historical corrections.',
      "Archive as Protocol in the date drill-down creates a saved routine from that date’s recorded exercises, skipping explicit warmups and using recorded set counts and starting values. It groups by date, not a distinct session ID: multiple workouts on that date may be combined. Inspect the new Protocol: date routine in Manage routines before using it.",
      "Session Surgery also supports Add Historical Set, removing sets and Re-map Exercise through the library. Cardio groups expose distance/duration fields. Saving after removing every set deletes the selected date’s records. These are historical edits, not changes to an unfinished workout; Discard leaves the saved history unchanged."),
  ]},
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} />, color: 'text-emerald-400', sections: [
    section('an-overview', 'Stats overview and smart cards',
      'Mobile Stats has Train, Nutrition and Bios. Desktop provides more detailed training, workload and biometric panels. Missing data can hide a card or show an insufficient-history message; scheduling a session is not the same as completing it.',
      'Mobile Train starts with recent progress, then the existing reviews, smart cards and history tools. All-time totals are expandable. Consistency, imminent milestones and yearly anniversaries appear only when their data conditions are met.',
      'Anniversary cards summarise recorded training and available changes around the anniversary of the first log. Milestone cards extrapolate qualifying recent e1RM improvement toward a round-number target; they are estimates, not promises.',
      'Volume landmark dots provide a compact muscle-group view and open supporting details. Dates, units, measurement coverage and filtering matter: different panels do not all count or filter history identically.',
      "Desktop sections can be expanded or collapsed to focus the dashboard. The Analytics Widgets popover currently displays e1RM, muscle-volume and heatmap visibility states but does not provide functioning visibility toggles; do not treat those displayed options as working customisation controls."),
    section('an-recent', 'Recent progress and weekly reviews',
      'Recent training covers the last 28 local calendar dates. It counts distinct session IDs separately, including multiple sessions on one day; legacy rows without IDs are conservatively grouped by date. Weekly consistency uses calendar-week segments of the same window, identifying partial/current weeks and comparing with your current goal, not a reconstructed old goal.',
      'Up to two load comparisons use best working sets at exactly the same reps, exercise/category and identifiable routine context. Warmups, deloads, timed/cardio and assisted sets are excluded. Units are converted and dates shown. Ambiguous same-day order cannot establish an improvement. This is a recorded-load comparison, not a change to progression rules.',
      'Today → Review this week is a local factual review: completed versus current goal, planned versus fulfilled appointments, skipped/missed sessions, volume and supporting records. Optional suggestions link back to their facts and never apply changes.',
      'Architect’s Evolution Review in Train is a separate optional AI synthesis of training, food, biometrics and routines. Force Recalibration requests a fresh review. It can suggest explanations, but cannot establish why a lift stalled or diagnose a nutritional deficiency.'),
    section('an-e1rm', 'e1RM — estimated one-rep max',
      'Select an exercise to inspect its estimated maximum over time. The app uses Epley: weight × (1 + reps / 30), with reps capped at 36. A single rep uses the logged weight directly. Dates generally use the best qualifying set.',
      <Formula>e1RM = weight × (1 + min(reps, 36) / 30)\nFor 1 rep: e1RM = weight</Formula>,
      'Filtering differs between strength views: the detailed desktop e1RM chart excludes explicit warmups but currently retains deloads and calculates using numeric loads as logged, without normalising mixed kg/lb entries. Its unit label follows Settings, so use the recorded units to interpret mixed-unit history carefully. Some older views also infer statistical warmups at or below 60% of that date’s peak exercise load and label them Stat-Warmup. Explicit lighter working sets remain relevant to progression even when an older chart filters them.',
      'Compare like-for-like technique, equipment and range of motion. Higher-rep estimates are less dependable. An e1RM is not a tested maximum, a required next load or a guarantee of progress. Dumbbell values use per-hand loads as recorded.',
      "In Performance Analytics, choose an exercise and 1M, 3M, 6M or ALL. Volume toggles recorded load × reps; Intensity toggles estimated maximum load; Relative toggles that estimate divided by the available bodyweight. Warmups changes volume inclusion but does not make warmup sets qualify for the strength estimate. Assisted-exercise estimates represent assistance, where lower is the better direction. The fullscreen control expands the chart. Cardio selections show distance and pace instead. These are view controls, not edits to recorded sets."),
    section('an-volume', 'Muscle volume — MEV, MAV and MRV',
      'Volume panels count sets assigned to muscle groups using exercise/category and library muscle mappings. Where supported, secondary muscles receive half-set credit. Warmups and deloads are excluded from the muscle set-count summaries.',
      <Ranges rows={[{ label: 'MEV', value: 'Minimum Effective Volume: an app reference for the lower volume landmark' }, { label: 'MAV', value: 'Maximum Adaptive Volume: an app reference for a higher productive-volume landmark' }, { label: 'MRV', value: 'Maximum Recoverable Volume: an app reference for the upper landmark' }]} />,
      'Below MEV is grey, the productive range green, heavier volume amber and excess red. The compact landmark summary uses a 28-day rolling average; weekly charts show their own periods. Check library muscle assignments if the distribution seems wrong.',
      'Settings → Training Goals offers per-muscle threshold editing on desktop. These configurable defaults are planning heuristics, not measurements of your personal recovery capacity. A colour alone cannot establish that you are undertraining or at risk of injury.'),
    section('an-tonnage', 'Tonnage and differences between summaries',
      <Formula>Recorded load-volume = Σ (weight in kg × repetitions)</Formula>,
      'The detailed weekly tonnage chart offers 8, 12 or 24 weeks. It excludes warmups and timed/cardio sets, includes logged deload loads, and uses positive recorded loads/reps. Its average excludes the current partial week and weeks with no positive tonnage.',
      'The factual weekly review excludes warmups, deloads, cardio and assistance weights. Mobile comparable-load summaries have their own stricter matching rules. Totals between these views can therefore differ legitimately.',
      'Assistance loads in older tonnage views are recorded support, not lifted load. Dumbbell loads are per hand as logged; totals are not automatically doubled. Tonnage is a load-volume proxy, not mechanical work in joules, muscle gain or a complete workload measure.',
      'Compare similar exercises and recording conventions. More tonnage is not always the goal: changed exercises, lighter sessions or fewer sets can all change the total without proving improvement or regression.'),
    section('an-acwr', 'Acute:Chronic Workload Ratio (ACWR)',
      'The workload gauge compares mean daily load over 7 days with mean daily load over 28 days, including the overlapping recent week. Missing log days contribute no recorded load.',
      <Formula>ACWR = (last 7 days’ recorded load / 7) ÷ (last 28 days’ recorded load / 28)</Formula>,
      'When at least half of the recorded training dates in the recent window have RPE ratings, the app selects stored RPE × elapsed-duration load. Otherwise it uses tonnage excluding warmups and timed/cardio but retaining deload loads. The older RPE path takes a stored session load per date rather than summing separate same-day sessions, so multi-session days may be underrepresented.',
      <Ranges rows={[{ label: 'Below 0.80', value: 'Displayed as Under-trained: lower recent recorded load' }, { label: '0.80–1.30', value: 'Displayed as Optimal: recent load near its recorded baseline' }, { label: '1.30–1.50', value: 'Displayed as High Load' }, { label: 'Above 1.50', value: 'Displayed as Spike Risk' }]} />,
      'Those labels are app heuristics. ACWR does not measure fitness, readiness or an individual probability of injury. The overlapping windows and incomplete logs limit interpretation. No gauge result automatically changes your workout.'),
    section('an-deload', 'Recovery guidance',
      'Recovery guidance separates a genuinely recorded lighter-session date, based on explicit deload flags, from inferred quieter periods. Open How this is calculated for estimated elapsed interval, volume and exertion signals. Insufficient history is stated rather than inventing a recommendation.',
      'The heuristic needs at least three recorded dates spanning three weeks. It looks back for explicit deload sets or quieter seven-day periods: training-day count at or below half the usual median, with low recorded exertion. Missing logs can resemble rest; an inferred boundary is not proof that you recovered.',
      'The review interval is generally 4–8 weeks based on the volume zone; a rising RPE trend can shorten it. Approaching means within two weeks, Due means the estimated interval is reached, and Overdue means it has passed. Recent explicit deload flags can clear an alert.',
      'These estimates are independent of your goal-based block’s rounds and sessions. Guidance never advances, skips or changes a block, calendar or workout. Use your actual circumstances when deciding whether to train lighter.'),
    section('an-consistency', 'Frequency maps and consistency streaks',
      'Mobile Train’s Training Frequency Map shows logged days by month; arrows change the month and tapping a recorded date opens history. Desktop’s Training Heatmap offers approximately 3 months, 6 months or a year, with brighter green indicating more logged load-volume. Hover for date details.',
      'These maps show recorded activity, not planned calendar appointments. An empty date means no recorded activity; it cannot distinguish a rest day, holiday, incomplete log or missed workout.',
      'The weekly goal streak counts qualifying weeks, using distinct session IDs and conservative per-date legacy grouping. The current partial week is skipped until its goal is met. Other older frequency charts still count training dates, so they may differ from session totals after two workouts on one day.',
      "In a date’s Session Drill-down, Protocol groups recorded sets by exercise while Timeline displays their recorded order. The summary includes recorded volume, peak e1RM, available RPE/duration and PR information. Date grouping can combine multiple workouts; timestamps and session metadata may be incomplete in older imports.",
      "PR Count and the PR breakdown compare qualifying estimated strength against prior recorded dates, generally using a 90-day lookback and requiring at least two prior qualifying training dates. They do not report a tested lifetime maximum. The displayed kJ/energy estimate uses simplified movement-distance assumptions; it is not measured energy expenditure and should not be added to a food calorie budget."),
    section('an-patterns', 'Training days and session duration',
      'Training Days distributes recorded training dates across weekdays over all history. Despite the chart’s session label, multiple workouts on a date count as one in this older chart.',
      'Session Duration shows weekly average recorded elapsed minutes over the selected history window. The current implementation takes the longest stored session duration per date before averaging, rather than averaging all distinct same-day sessions.',
      'Elapsed duration runs from the saved workout start time to completion and survives resuming a draft. It includes time away, long rests and interruptions. Imported records may have no duration. A duration change alone does not demonstrate fatigue, fitness or session quality.'),
  ]},
  { id: 'biometrics', label: 'Biometrics', icon: <Activity size={18} />, color: 'text-cyan-400', sections: [
    section('bio-logging', 'Logging and correcting measurements',
      'Open mobile Stats → Bios or desktop Biometrics. Choose a date, enter bodyweight and any available height, body-fat percentage or circumferences, then save. Bodyweight is needed to save the manual entry; the other measurements are optional.',
      'Selecting an existing date loads its values. Saving replaces that date’s measurement entry rather than adding another entry for the same date. Check the date and weight unit before confirming. Existing charts recalculate from your saved measurements.',
      'Use consistent measurement conditions to make comparisons useful. You may enter body fat from another measurement method. Height, waist and neck (plus hips for the female formula) enable a Navy estimate; this is not a substitute for the body-fat measurement you chose to enter.',
      'Some derived metrics require height and body fat together with weight. Empty or sparse history cannot support every card. Optional AI measurement entry requires a key and internet; review extracted values before saving.',
      "Biometric Evolution offers 1M, 3M, 6M and ALL ranges and a fullscreen chart. Tap the IFQ, FFMI, waist-to-height or proportion cards for their explanation/advice, then close the diagnostic overlay to return. Those interpretations are app guidance derived from entered measurements.",
      "The measurement registry groups entries by month. Expand a month to find Edit entry or Delete entry beside a date. Deletion removes that measurement from the history and recalculates derived charts; it does not go to Trash Can. Keep a backup if you may need to recover it."),
    section('bio-trend', 'Mobile bodyweight and waist trends',
      'The mobile bodyweight summary shows the latest actual measurement, its date and age, followed by a 28-day chart. Grey points are recorded weights; cyan is a trailing seven-day average only where at least three distinct measurement days support it.',
      'A week-to-week average comparison requires enough measurements in both adjacent seven-day windows. Without that coverage, the summary uses an explicitly dated recorded change rather than pretending to have a smoothed trend. Sparse older data uses the latest two available readings where possible; one reading cannot establish a change.',
      'Missing measurements remain gaps, future-dated entries are excluded from this summary, and units are converted. Waist change is secondary, with dates and cm/in units. This summary does not infer body-fat or muscle changes from scale weight.'),
    section('bio-navy', 'Navy Method body-fat estimate',
      'This circumference estimate requires height, waist and neck; the female formula also requires hips. Internal measurements use centimetres. Biological profile selection in Settings determines the formula.',
      <Formula>Male: BF% = 495 / (1.0324 − 0.19077 × log10(waist − neck) + 0.15456 × log10(height)) − 450\n\nFemale: BF% = 495 / (1.29579 − 0.35004 × log10(waist + hips − neck) + 0.22100 × log10(height)) − 450</Formula>,
      'Measure consistently and check units and sites. The result is an estimate from body circumferences, not a direct fat measurement. Individual body proportions and measurement error can produce large differences from another method; do not interpret a small change as certain fat loss.'),
    section('bio-ffmi', 'FFMI — Fat-Free Mass Index',
      'FFMI uses entered weight, height and body-fat percentage to estimate fat-free mass relative to height. Fat-free mass includes more than muscle, so the displayed Lean Density label is shorthand rather than a direct muscle-density measurement.',
      <Formula>Fat-free mass (kg) = weight_kg × (1 − body fat / 100)\nFFMI = fat-free mass / height_m²\nDisplayed normalised FFMI = FFMI + 6.1 × (1.8 − height_m)</Formula>,
      'The app bands are below 18, 18–20, 20–22, 22–25 and 25+. Labels include Slight Build, Average Athletic, Highly Developed, Near Genetic Limit and Enhanced Baseline / Elite. These are built-in reference labels, not individual diagnoses or evidence of drug use.',
      'Measurement error, sex, frame and population differences limit interpretation. A threshold cannot establish your genetic limit or whether someone is enhanced. Changes in entered body fat directly change FFMI.'),
    section('bio-wthr', 'Waist and body-proportion ratios',
      <Formula>Waist-to-height ratio = waist / height\nChest-to-waist ratio = chest / waist\nShoulder-to-waist ratio = shoulders / waist</Formula>,
      'Measurements must use the same units. Waist-to-height uses 0.5 as a reference boundary in the app. Chest/shoulder ratios summarise proportions where measurements are present.',
      'These are descriptive screening/proportion indicators, not direct measurements of visceral fat, metabolic efficiency or medical risk. Missing circumferences leave the corresponding metric unavailable. Use the same tape placement and technique when comparing dates.'),
    section('bio-relative-strength', 'Relative strength benchmarks',
      'Relative strength divides an estimated one-rep maximum by recorded bodyweight. The app recognises common names for bench press, squat, deadlift, overhead press and barbell row, with exclusions for variations that do not match the same benchmark.',
      <Formula>Relative strength = estimated 1RM in kg / bodyweight in kg</Formula>,
      'Thresholds below are the actual built-in values, in the order Foundations / Developing / Established / Forged / Elite. Biological profile selection chooses the reference set. These are base thresholds: date-of-birth age adjustments reduce them to 95% at 40+, 90% at 50+, 85% at 60+ and 80% at 70+. The panel uses best qualifying performance over the last 90 days and the latest bodyweight, with the most recent lift date shown separately. This particular benchmark calculation doubles recognised per-hand dumbbell loads to compare them with bilateral standards; ordinary progression remains per hand.',
      <H>Male reference thresholds</H>,
      <Ranges rows={Object.values(STRENGTH_STANDARDS).map(standard => ({ label: standard.label, value: standard.male.map(value => `${value}×`).join(' / ') }))} />,
      <H>Female reference thresholds</H>,
      <Ranges rows={Object.values(STRENGTH_STANDARDS).map(standard => ({ label: standard.label, value: standard.female.map(value => `${value}×`).join(' / ') }))} />,
      'These app references are not competition qualification standards. Name matching can miss or misclassify a lift; equipment, technique and measurement age matter. An estimated maximum and a reference label do not prove a tested performance.'),
    section('bio-projection', 'Body composition projection',
      'The detailed chart shows recorded weight and, where body fat is available, calculated lean and fat mass. With at least three entries and a usable weight regression, it extends a straight-line trend roughly 90 days beyond the last entry.',
      'Lean/fat projections require enough corresponding body-fat readings. They derive from the entered body-fat percentage, not a separate measurement of muscle gain or fat loss.',
      'Linear extrapolation is a scenario, not a prediction. More entries do not guarantee accuracy if measurements are inconsistent or circumstances change. The compact mobile seven-day average and the detailed projection use different methods and windows.'),
    section('bio-ifq', 'IronFlow Quotient (IFQ)',
      'IFQ is a proprietary 0–100 summary of recorded consistency, calorie alignment and bodyweight/composition movement relative to the Food goal. It is not a validated scientific score, diagnosis or score of your personal worth.',
      <Ranges rows={[{ label: 'Consistency · 35%', value: 'Recent 28-day training-day frequency versus the earlier portion of a 12-week window; a three-day/week fallback when no baseline exists' }, { label: 'Calorie alignment · 30%', value: 'Recorded intake versus a goal-adjusted calorie estimate' }, { label: 'Adaptation · 35%', value: 'Available weight/composition change relative to the selected goal' }]} />,
      'Without food data, weights become 50/50 consistency/adaptation. Without a biometric trend, they become 55/45 consistency/calorie alignment. Training-only uses consistency, with a floor for some provisional readings. This older score counts training dates rather than all distinct same-day sessions.',
      'Calibrating suppresses the score when recent history has less than 40% of its expected signal. Provisional indicates limited coverage; there is no fixed number of weeks that guarantees activation.',
      'Labels are Peak Flow (90+), Strong Adaptation (75+), Developing Consistency (55+), Misaligned Inputs (35+) and Stagnant (below 35). Missing logs and approximate nutrition/body-fat inputs can materially change the score. Its calorie component follows the same goal/activity/multiplier formula but has its own input and averaging logic; it is not simply a percentage of today’s Food total.'),
    section('bio-morphology', 'Morphology Lab',
      'Morphology Lab uses Gemini to assess visible development from reference photos. Choose four views (front, left, back, right) or an eight-photo upper/lower sequence. Review the photos before analysis; capturing photos requires camera access and analysis requires AI/network access.',
      'Scores are qualitative 0–100 estimates per muscle group, affected by pose, lighting, clothing and body fat. They do not directly measure muscle volume, strength or body-fat percentage, and extra photos do not guarantee accuracy.',
      'The result includes a body map, symmetry views and a KDI index: a weighted average of the AI muscle scores, with change against a previous scan. These are app-specific summaries of the same qualitative assessment, not independent measurements.',
      'The app enforces a 28-day interval between completed scans. Failed analysis can retain a pending photo set locally for retry or discard. Open the pending scan controls rather than assuming a failed scan was saved as a completed assessment.',
      'Photos sent for analysis leave the device for Google Gemini. Pending captures are device-local and are not part of the standard JSON/Drive backup key set. Completed assessment scores are backed up; the completed record does not retain the raw photo set. Browser cleanup can remove a pending capture.',
      "During capture, Switch Camera changes the available lens; zoom controls appear only on supported cameras. Start initiates the guided capture sequence. At review, Discard & Retake repeats capture; Approve & Next Phase continues an eight-photo sequence and Approve & Synthesize submits the reviewed set for analysis.",
      "Thermal colours the AI development scores; it is not a thermal-camera measurement. Symmetry compares the assessment’s balance. Vectors provides another graphical view of the scores. Evolution compares with the previous completed scan and is unavailable without one. None of these views measures live movement or temperature."),
  ]},
  { id: 'nutrition', label: 'Nutrition', icon: <Coffee size={18} />, color: 'text-orange-400', sections: [
    section('nu-logging', 'Adding, editing and deleting food',
      'Food is the main entry screen. In Add food, Log food manually, Scan barcode and Food pantry share a row; Describe food (AI) is below. All confirmed entries feed the same dated food log and daily totals.',
      'Manual entry records nutrition totals for the actual amount eaten. Enter date, name, calories, protein, carbs and fats. Use an explicit zero only when known to be zero; unknown values need correction rather than silently becoming zero.',
      'Review the amount and date before adding. Edit an existing entry to correct it; delete removes it from totals. Food history provides previous dates. Changing an old log does not rewrite a saved meal or pantry definition.',
      'Changed food editors and unconfirmed AI reviews ask before discarding; Keep editing preserves the current form. Confirmed entries autosave. Save failures and Retry save are shown in the food workflow; keep the tab open until the save succeeds.'),
    section('nu-meals', 'Repeat food and saved meals',
      'Repeat beside an entry, or an older entry in Food history, opens a review of the date and amount. Adjust amount offers Half, Same, Double or your own multiplier: 0.5 means half the recorded amount, 2 means double. Calories and macros scale together; the original log remains.',
      'Saved meals can contain one food or a group. Name the meal, choose a log date and select foods; add foods from other dates if needed. Review amounts before Save meal. View saved meals lets you log a reviewed copy; Options contains Edit and Delete.',
      'Saved meals preserve nutrition snapshots, including estimates. Later pantry edits, saved-meal edits or deletion do not change previously logged meals. Repeating and logging saved meals work locally without AI and are included in JSON/Drive backups.'),
    section('nu-ai', 'Describe food and review AI entries',
      'Describe what you ate and choose Review food entries. AI proposes a batch; nothing is logged until you confirm Add N foods. Expand Edit food to correct a proposed entry, remove unwanted foods, or choose a suggested/searchable pantry match. Check batch calories and each portion.',
      'AI may also propose goal, dietary preference or region changes from your description. These are separate from the food batch and apply only if you choose Apply these profile changes. Review the comparison rather than assuming a statement in your description silently changed settings.',
      'Nutrition estimates are not measurements. Review confidence/source information and dietary-conflict warnings. Source labels do not certify accuracy. A key, connection and available API quota are required; malformed responses can be rejected without changing the log.'),
    section('nu-barcode', 'Barcode scanning and portion basis',
      'Scan barcode uses the camera for supported EAN/UPC products; Enter code manually is available if the camera is unavailable. Keep leading zeros. A matching pantry barcode is checked first; otherwise lookup contacts Open Food Facts.',
      'Review what the label values describe: per 100 g, per 100 ml or per serving. The app does not infer this from a vague serving description. Complete missing nutrients and confirm the amount/date. Per-serving data needs a usable serving basis; grams and millilitres are not interchangeable without suitable information.',
      'A new product’s Continue to amount does not save a pantry definition. Also save this food to pantry is optional on the logging screen. Matching an existing pantry item can work without a new network lookup; unknown products need internet.',
      'Open Food Facts is a product database, not a guarantee that the label, region or serving values are current. Check the package. A successful barcode match alone is not confirmation that the nutrition is correct.'),
    section('nu-pantry', 'Food pantry, database and label import',
      'Food pantry stores reusable food definitions. Add pantry food saves a definition, not a meal. Log food reviews the amount before adding an entry. Find pantry food searches your saved definitions; Options lets you edit or delete them.',
      'Definitions specify whether nutrients are per 100 g, per 100 ml or per serving. Set the corresponding portion information and optionally a barcode. Editing or deleting a definition leaves existing logs and saved-meal snapshots unchanged.',
      'Find or import foods searches the bundled Australian Food Composition Database and can supplement it with Open Food Facts products. A configured country can filter product searches; it does not alter a scanned product’s label or guarantee a match.',
      'Product-page and label-image imports may use AI. Review the selected nutrition column, basis, serving information and all extracted values before saving. Food database search and barcode lookup do not themselves require a Gemini key; AI imports do.'),
    section('nu-targets', 'Calorie, protein, carb and fat targets',
      'Food → Today’s totals and targets uses your Food goal/preferences, measurements and biological profile. The current goal is Build Muscle, Lose Fat or Maintenance. Describe a goal/preference/region change with AI and explicitly accept its proposed profile update; there is no separate manual goal/preferences form in the current Food screen. A relevant training block can also propose a Food change, but cannot apply it without approval.',
      <Formula>BMR = 10 × weight_kg + 6.25 × height_cm − 5 × age + sex constant\nSex constant: male +5; female −161\nDaily calories = (BMR × activity factor + goal adjustment) × multiplier</Formula>,
      <Ranges rows={[{ label: 'Build Muscle', value: 'Activity 1.55; adjustment +300 kcal' }, { label: 'Lose Fat', value: 'Activity 1.4; adjustment −500 kcal' }, { label: 'Maintenance', value: 'Activity 1.375; adjustment 0 kcal' }]} />,
      'The multiplier ranges from 0.7 to 1.3. The Calorie adjustment slider previews a target; Apply target adjustment saves it. Missing inputs use fallback values (75 kg, 175 cm and age 30 where needed); an unset sex uses the male constant. The target is marked estimated when profile information is incomplete. These fixed activity factors are not measured from your workouts.',
      'Protein uses bodyweight × the saved target-protein ratio. Default ratios are 1.6 g/kg for muscle, 1.8 for fat loss and 1.2 for maintenance, with preference-based adjustments. Vegetarian adds 8%, vegan 15%, high-protein sets a minimum of 2.2; the derived default is capped at 2.8. A saved/approved ratio can override the derived default.',
      'Protein calories use 4 kcal/g. Remaining nonnegative calories split between carbs/fat: 58%/42% for muscle/maintenance, 45%/55% for fat loss, or 8%/92% for keto/low-carb preference. Carbs use 4 kcal/g and fat 9 kcal/g. The multiplier changes calorie allocation, not the bodyweight protein target.',
      'These are app planning defaults rather than individual prescriptions. Reassess using actual trends and appropriate professional guidance where needed; the app does not measure energy expenditure.'),
    section('nu-radar', 'Nutrition review and macro radar',
      'Stats → Nutrition reviews recorded intake and shared Food targets. Use Food for entering or correcting meals. Date coverage matters: an unlogged day is not proof that you ate nothing.',
      'The radar averages recorded intake across logged days within the last seven local calendar dates, including today, then expresses calories, protein, carbs and fat as percentages of current targets. It does not divide by seven regardless of missing days. The dashed outline is 100%; the filled radar shape is capped at 150% for display, so inspect the numeric intake for larger overshoots.',
      'Macro tiles are green at 90–115%, blue below 75%, and amber otherwise. These are display bands, not clinical adequacy limits. A partial day and an incomplete food log can appear low despite adequate actual intake. Historical intake is compared with current targets rather than reconstructed old settings.'),
  ]},
  { id: 'backup', label: 'Backup and data', icon: <Shield size={18} />, color: 'text-emerald-400', sections: [
    section('bk-ironsync', 'IronSync — Google Drive backup',
      'Settings → IronSync connects Google Drive; the connection button may be labelled Initialize Cloud Vault. Authorise the app’s private Drive app-data access. This connection does not grant or implement Google Calendar access.',
      'Each browser/device instance has its own named snapshot file in the app’s private Drive folder, not one shared file for all devices. Set a recognisable device name in Settings. These files are normally hidden from Drive’s main file browser.',
      'Uploads run after successful local saves through a serialised queue. Edits made during an upload remain pending for a later upload. Pending revisions can resume after reconnecting; the app needs to be open and online to transfer them.',
      'Backup Now requests an upload; check the result. Google tokens expire and a silent reconnect may be attempted, but browser restrictions or expired authorisation can require reconnecting manually. Disconnecting does not erase locally saved records.',
      'IronSync is device backup and restore, not continuous cross-device merging. Restore a chosen device snapshot explicitly; concurrent edits on different devices are not automatically reconciled. Backups pause persistently after restore until you choose Back up restored data.'),
    section('bk-vault', 'JSON backup contents and export',
      'Open Vault Backup → Download JSON backup. Save the file somewhere separate from this browser/device. JSON is the complete supported record format; CSV is only a workout-history interchange format.',
      'Snapshots include workout history, routines/trash, custom library/deletions, measurements, completed body assessments, food entries/profile, pantry, saved meals, saved reviews, calendar, training blocks and settings. Local JSON export currently omits the unfinished workout; finish or retain its local draft rather than treating that file as a session-recovery copy. Drive snapshots can contain the saved unfinished workout.',
      'Pending morphology captures, API keys and Google tokens are not part of the normal snapshot key set. Internal save/backup queue state, local restore recovery copies and the post-restore Drive pause are also excluded. Do not assume a JSON file reproduces the entire browser environment.',
      'Device settings are included for snapshot compatibility but retained from the receiving device during restoration. Keys, authorisation and device identity are not transferred as a sign-in mechanism. Keep exported records private and verify you can locate your backup.'),
    section('bk-restore', 'Restore a backup', <RestoreBackupArticle />),
    section('bk-csv', 'CSV import and export',
      'Open Manage Data for workout-history CSV import/export. Export writes the recorded history; it is not a complete app backup and does not preserve every session identity, block link, set flag or other JSON-only field.',
      <Formula>Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time</Formula>,
      'Import expects this column order. Review parsed exercises and name mappings. Exact library names are matched locally; unmatched names request AI matching and therefore need a key/network. Review the selected existing or new exercise names before confirming.',
      'Conflicts are detected by date. Merge Records appends entries; Overwrite replaces records on dates present in the CSV, retaining other dates. Merging is not automatic duplicate detection; importing the same file twice can duplicate sets. Review the action carefully and keep a JSON backup first.',
      'The legacy CSV reader mainly rebuilds date, exercise, category, weight/unit and reps. Do not rely on a CSV round trip to retain distance/time or all historical metadata even though those columns appear in the export. Use JSON for full restoration.'),
    section('bk-trash', 'Trash Can and destructive actions',
      'Deleted routines/templates and library exercises appear in separate Trash Can tabs. Restore makes them available again. Routine permanent deletion removes the trashed routine. Current limitation: permanent deletion or Empty Trash Can for exercises clears their hidden/deleted markers, so the exercises can reappear in Library; do not rely on those actions to erase library definitions. It is not a general recycle bin for food logs, historical sets or measurements. Deleting a routine does not delete already-recorded workouts; future appointments can show Routine unavailable.',
      'Settings → Danger Zone → Master Reset requires a second confirmation and clears local app records and local preferences/credentials. It is not a troubleshooting step that preserves your workout history. Export a JSON backup before considering it.',
      'A cloud snapshot and a downloaded JSON file are separate recovery options, but their existence and age must be checked. The local restore-undo copy is lost when browser data is cleared.'),
  ]},
  { id: 'settings', label: 'Settings and AI', icon: <Bot size={18} />, color: 'text-violet-400', sections: [
    section('st-settings', 'Settings reference',
      <H>Biological profile and units</H>,
      'Sex/profile selection affects Navy estimates, relative strength references and calorie calculations; date of birth supplies age. Measurement system controls metric/imperial entry and display. Existing records retain their logged units; stored circumferences/equipment are converted as needed rather than being rewritten as new performances.',
      <H>Training preferences</H>,
      'Default rest applies when no positive exercise-specific rest is set. Keep Screen Awake requests a supported wake lock during workouts. Weekly workout goal drives current-goal comparisons and streaks; it is separate from block days/week. On desktop, Training Goals exposes per-muscle MEV/MAV/MRV thresholds.',
      <H>Exercise database and equipment</H>,
      'Auto-populate Target Count and Included Body Parts request additional AI library entries, up to 60 per sync. Review generated instructions before relying on them. Library exercise details hold equipment base/increment/loading configuration; database expansion is not required for manual routine creation.',
      <H>AI preferences and keys</H>,
      'Configure a primary Gemini key and optional paid fallback. Personality choices change tone: Neutral, Elite Coach, Gym Bro or a custom directive. Tone settings do not guarantee accurate analysis or safe prescriptions.',
      <H>Backup and reset</H>,
      'IronSync controls connection, device name and manual backup/resume after restore. Save preferences to apply settings changes. Master Reset is destructive; see Backup and data before using it.'),
    section('st-ai', 'AI features, keys and limitations',
      'AI requires a Gemini API key, internet and available quota. You can dismiss first-run key setup and use manual tracking. Keys are held in this browser and sent to Google; requests do not pass through an IronFlow backend.',
      'AI features include programme/block generation, routine editing/auditing, workout discovery, optional exercise alternatives/coaching, Evolution Review, food description/import, measurement extraction, morphology assessment and unmatched CSV exercise-name mapping. Local progression, normal session adaptation, factual weekly reviews and manual food logging do not require AI.',
      'Different tasks use different configured Gemini models, which may change between releases. The optional paid fallback can be used for supported quota/rate-limit conditions; it is not a guarantee against invalid keys, provider outages, model limits or network failures. Charges follow your Google account and key configuration.',
      'Structured results are validated before normal workflows use them. Invalid output may be rejected; only the block builder has the manual target-correction recovery described under Training. Validation checks structure and supported values, not factual truth, suitability or the quality of exercise technique.',
      'Review generated plans, food amounts and image interpretations. The app cannot verify that an exercise is suitable for your circumstances or that an image/description gives an accurate measurement.'),
    section('st-troubleshooting', 'Troubleshooting and reference limits',
      'For a failed local save, keep the tab open, resolve browser storage problems and Retry save. For a Drive error, check connectivity/authorisation and reconnect; do not assume uploading and local saving are the same state. A restore pause is intentional until explicitly resumed.',
      'For AI errors, distinguish invalid/missing key, quota/rate limit, network/provider failure and invalid response. Retry when appropriate or use a manual workflow. Block-generation errors identify reviewable targets or explain why a programme could not be staged.',
      'If a chart is empty, check its period, required measurements, units and exclusions. Timed exercises do not generate strength estimates. Legacy records can lack identity/prescription/duration fields, and some older panels still group by day. Help documents those differences rather than silently altering your data.',
      'Calculations are app models of recorded data, not clinical measurements. General background reading can help interpret them, but it does not validate every app default, cutoff, score or AI recommendation.',
      <Ref href="https://pubmed.ncbi.nlm.nih.gov/28642676/">ISSN position stand: protein and exercise (2017)</Ref>,
      <Ref href="https://renaissanceperiodization.com/hypertrophy-training-guide-central-hub/">Renaissance Periodization: training-volume background</Ref>),
  ]},
];

// ── Main component ────────────────────────────────────────────────────────────

const HelpModal: React.FC<Props> = ({ onClose }) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string>('getting-started');
  const [activeSectionId, setActiveSectionId] = useState<string>('gs-overview');
  const [mobileView, setMobileView] = useState<'categories' | 'sections' | 'content'>('categories');

  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = previousOverflow; if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
  }, []);
  const contentPanel = useRef<HTMLDivElement>(null);
  useEffect(() => { if (contentPanel.current) contentPanel.current.scrollTop = 0; }, [activeSectionId, mobileView]);

  const activeCategory = categories.find(c => c.id === activeCategoryId) ?? categories[0];
  const activeSection = activeCategory.sections.find(s => s.id === activeSectionId);
  const isExample = ['gs-overview', 'tr-progression', 'bk-restore'].includes(activeSectionId);

  const selectSection = (catId: string, secId: string) => {
    setActiveCategoryId(catId);
    setActiveSectionId(secId);
    setMobileView('content');
  };

  return (
    <dialog ref={dialog} aria-label="Help and Reference" onCancel={event => { event.preventDefault(); onClose(); }} className="fixed inset-0 z-[200] m-0 h-dvh w-full max-h-none max-w-none border-0 p-0 text-slate-100 bg-slate-950/95 backdrop-blur-xl open:flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-4 border-b border-slate-800 shrink-0">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {mobileView !== 'categories' && (
            <button
              aria-label={mobileView === 'content' ? 'Back to help topics' : 'Back to help categories'}
              onClick={() => setMobileView(mobileView === 'content' ? 'sections' : 'categories')}
              className="lg:hidden min-h-11 min-w-11 flex items-center justify-center p-2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-100 uppercase tracking-tight">Help & Reference</h2>
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">IronFlow Documentation</p>
          </div>
        </div>
        <button aria-label="Close help" onClick={onClose} className="min-h-11 min-w-11 flex items-center justify-center p-2.5 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 border border-slate-700 transition-all">
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
                className={`w-full min-h-11 flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all
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
                className={`w-full min-h-11 text-left px-3 py-2.5 rounded-2xl transition-all
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
        <div ref={contentPanel} className={`
          lg:flex min-w-0 flex-1 overflow-y-auto flex-col
          ${mobileView === 'content' ? 'flex' : 'hidden'}
        `}>
          {activeSection ? (
            <div className="max-w-2xl min-w-0 w-full mx-auto px-4 sm:px-6 py-6 [overflow-wrap:anywhere]">
              <h3 className={`${isExample ? 'text-2xl font-semibold tracking-normal' : 'text-xl font-black tracking-tight'} text-slate-100 mb-5`}>{activeSection.title}</h3>
              {activeSection.content}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-700 text-sm font-black uppercase tracking-widest">
              Select a topic
            </div>
          )}
        </div>

      </div>
    </dialog>
  );
};

export default HelpModal;
