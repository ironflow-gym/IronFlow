# Help & Reference audit — 28 October 2026

Scope: audit the in-app guide against the current application, then update all categories. No training, nutrition, progression, backup or analytics algorithms changed. No Google Calendar integration added. The guide now has 51 focused topics across the existing seven categories. Existing long training/food topics were split into discoverable tasks; formulas and references were checked against implemented calculations rather than copied from earlier prose.

## Coverage and implementation sources

| Category | Topics reviewed and documented | Implementation checked |
| --- | --- | --- |
| Getting Started | Navigation and first use; data/privacy; installation, offline use and updates; local save failure/retry | App, index.html, service worker, storageService, backupQueue, ironSyncService |
| Training | Today priority; calendar/recurrence/markers; full goal catalogue and block lifecycle; block-only AI correction; templates/programmes/discovery; session logging and recovery; set gestures/copy; progression/choices/manual increase; equipment/units/plate loading; library; adaptation/swap/coaching; rest/interval/wake lock; RPE; historical edits | TodayScreen, scheduling/calendarDay, TrainingBlockBuilder/Manager, trainingBlocks/blockAIReview, ProgramCreator/WorkoutDiscovery, TemplateEditor/Desktop, ActiveWorkout/SetMarker, progression/equipment, Library/ExerciseDetailContent, SessionAdaptation/sessionAdaptation, HistoryEditor, WorkoutHistory |
| Analytics | Stats/smart cards; recent progress and factual vs AI reviews; e1RM; muscle volume; tonnage; ACWR; recovery estimates; frequency/streaks; duration/training-day distributions | StatsDashboard, WorkoutHistory, stats components, mobileStats, weeklyReview, utils and sessionIdentity |
| Biometrics | Measurement entry/correction; mobile weight/waist summary; Navy formula; FFMI; body proportions; actual relative-strength thresholds/age adjustments; projections; IFQ; morphology/KDI/pending photos | BiometricsLab, MorphologyLab, MobileProgressSummary/mobileStats, RelativeStrengthPanel/BodyCompositionProjection, utils and types |
| Nutrition | Manual/edit/delete; repeat/grouped saved meals; AI batch/profile approval; barcode/portion basis; pantry/database/label import; shared targets and defaults; Nutrition review/radar coverage | FuelDepot and food forms, SavedMeals/repeat dialogs, FoodBatchReview/FoodPantry/BarcodeFoodLog, food/meals/nutritionTargets, MacroRadarChart/NutritionReview, Gemini/food lookup services |
| Backup and data | Per-device Drive backups; local JSON contents/exclusions; restore comparison/recovery/undo/pause; CSV actual fields/import conflicts; routine/exercise Trash and reset | ironSyncService, backupQueue/backupService, BackupManager, backupRestore, storageService.restoreWithRecovery, CSVManager/App import handler, TrashCan, SettingsModal |
| Settings and AI | All settings groups; local versus AI features; keys/fallback/personality; failure causes, required data and reference limits | SettingsModal, GeminiService/aiValidation, relevant feature callers |

## Corrected inaccuracies

- Drive uses per-instance named snapshot files, not one shared multi-device mirror. It does not merge devices or sync Google Calendar.
- Saved session start time survives resumption; elapsed duration includes time away.
- CSV export has no filtering and writes blank distance/time columns. Its reader chiefly restores six basic fields; it cannot replace JSON backup.
- CSV conflict actions are merge and overwrite by imported dates; no skip-conflicts action is exposed.
- Local JSON export omits the active session; Drive can contain it. Neither backs up pending morphology captures, API keys or Google tokens.
- Trash holds both routines and library exercises, not templates alone.
- Manual measurement saving requires weight; other measurements are optional.
- Food calorie formula applies the activity factor once. Documented multiplier, fixed factors, missing-input defaults, protein override, and remaining-calorie carb/fat splits.
- Relative-strength tables now read the actual exported constants; previous help contained incorrect squat, deadlift, OHP and row thresholds. Age adjustment, 90-day performance window and bilateral dumbbell treatment are explicit.
- e1RM, volume, tonnage, workload and recent comparisons do not share a universal warmup/deload filter. Help describes actual differences.
- Unverified original-source citations and deterministic growth/injury/genetic-limit claims were removed. App-specific scores/labels are distinguished from validated measurements. Retained links are general background, not validation of every app rule.

## Existing behaviour documented, not changed

These findings warrant a separate functional review if desired; changing them during a reference update would alter established calculations or backup compatibility:

- Detailed desktop e1RM uses logged numeric loads without mixed-unit normalisation and retains deloads; other strength views filter differently.
- Detailed tonnage includes deload and assistance loads; the factual weekly review excludes them.
- ACWR RPE selection/load, training-day distribution, session-duration aggregation and IFQ still use day grouping in places, unlike new distinct-session totals. Duration takes the maximum per day.
- CSV export/import omits fields advertised by its nine-column header and does not preserve session/block metadata.
- Current local JSON export omits the unfinished session; supported Drive/restore snapshots can include it.
- Food goal/preferences/region currently change through approved AI profile proposals or relevant block Food proposals, rather than a separate manual preferences form.

## Help presentation

The category → topic → article flow remains. Narrow reference rows stack, formulas wrap and preserve line breaks, and the content panel returns to the top when changing topic. Back/close controls have readable accessible labels and 44px targets. A native modal provides focus isolation and Escape dismissal without changing other application workflows.

Final validation: 97 unit tests and TypeScript/production build passed. Seven browser workflows passed, including opening and reading every one of the 51 topics at both 320px and 1440px, checking for horizontal overflow, topic scroll reset, Escape dismissal, unchanged saved data and existing navigation/draft preservation. Existing mixed-import/bundle-size warnings remain. Nothing pushed or deployed as part of this audit.

## Reverse feature-to-help pass

A second pass started from reachable app actions rather than existing article titles. The 51-topic structure is retained, with these additions inside existing topics:

| App feature | Help topic extended |
| --- | --- |
| Session/Program generation, pre-flight result, whole-programme refinement, single/batch save | Routines, programmes and workout discovery |
| Neural Refresh directly saves AI routine revisions | Routines, programmes and workout discovery |
| AI editor audit, desktop multi-day tabs and save scope | Routines, programmes and workout discovery |
| Discovery refresh/cache and Save All Days versus Start Day 1 | Routines, programmes and workout discovery |
| Save rest to protocol, matching by routine/exercise name | Rest, intervals and keeping the screen awake |
| Archive as Protocol, including date grouping across same-day sessions | Correcting recorded workouts |
| Add/remove historical sets, remap exercises, cardio edits and removing every set | Correcting recorded workouts |
| Online library search, Add to Database, custom creation and muscle tags | Exercise library and instructions |
| Explicit current-workout assignment and weekday/start-date bulk scheduling | Goal-based training blocks |
| Chart ranges, metric definitions/toggles, warmup visibility, fullscreen and cardio plots | e1RM — estimated one-rep max |
| Protocol/Timeline history, PR interpretation and simplified kJ estimate | Frequency maps and consistency streaks |
| Measurement chart controls, diagnostic cards and deletion | Logging and correcting measurements |
| Camera switch/zoom, capture review/retake and four result modes | Morphology Lab |

Corrected the blanket claim that future routine changes require the routine editor: explicit rest saving and Neural Refresh are separate future-setting actions. Corrected library-history wording: primary-muscle tag edits retarget historical primary-muscle records and can affect analytics while preserving recorded loads/reps.

Two existing implementation issues are described as limitations, not presented as working capabilities: the desktop Analytics Widgets popover has no visibility-toggle handlers; permanently deleting/emptying exercise trash clears exclusion markers so those definitions can reappear. Neither behaviour was changed.

Reverse-pass validation: 97 unit tests, seven Help/navigation browser workflows and production build passed. Following the final chart-definition clarification, both comprehensive Help workflows passed again, covering every topic at 320px and 1440px. No horizontal overflow or saved-data changes were detected. No commit, push or deployment performed.

Release 2.5.6 includes this audit and the contextual information modals. Push to `2.4` authorised by the user; deployment and user review pending.
