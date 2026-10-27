# Training blocks — approved implementation

Release 2.5.0 on branch `2.4`; deployment and user review pending. See [implementation and checks](2.5.0-plan.md).

## Confirmed behaviour

- Full twelve-goal catalogue: strength, muscle/bulk, fat loss, recomposition, general fitness, cardiovascular endurance, muscular endurance, power, mobility, healthy ageing/function, sport/event, maintenance.
- One active block. Ask separately for days/week, different workouts per round, rounds, session minutes, experience, return after a break, available equipment and optional priorities/event context. Four workouts at three days/week carry across weeks.
- Saved routines, manual creation and the existing multiday AI generator share a review before creation. AI receives the choices automatically; schema/count validation rejects incomplete results. Block workouts are independent copies with stable identities and per-session snapshots.
- Completion-based sequence. Explicit assignment only; unrelated workouts never match by name/date. Out-of-order sessions are allowed; earliest unresolved stays next. Explicit partial-workout choice, skip/undo, explicit finish/end, review and repeat.
- Unfinished workouts and explicit appointments/rest keep Today priority. Optional individual calendar appointments, multiple same-day sessions, and weekday-based bulk scheduling with conflict review. No automatic missed-session shifting.
- Future workout edits preserve started/completed snapshots and historical names. Source routines remain independent. To change block goal or round structure, end the block and create/reuse a programme.
- Existing all-working-sets progression for ordinary resistance goals. Approved fixed/manual prescriptions for power, mobility, cardio endurance, muscular endurance and sport. Timed exercises use seconds and are excluded from strength estimates/tonnage.
- Approved Food policies: reuse existing Food calculation; fat loss → Lose Fat, muscle/bulk → Build Muscle, recomposition/maintenance → Maintenance. Other goals leave Food unchanged. Every change needs opt-in after current/proposed comparison. Preserve previous settings and offer restoration anytime with comparison against current manual changes and explicit acceptance.
- Atomic local autosave, JSON, Drive, restore comparison and undo include blocks. Older backups remain accepted. Saved/manual blocks work without AI/network once the app is loaded offline.

## Research and limits

Detailed automatic goal-specific progression beyond existing resistance rules remains deferred. WHO/PubMed/search access returned HTTP 403 during planning. Background references: ACSM 2009 progression position stand (PMID 19204579); resistance-training prescription network meta-analysis (doi:10.1136/bjsports-2023-106807); WHO 2020 physical activity guidance. These were not freshly retrieved or represented as a current comprehensive literature review. The implementation does not claim logged volume proves muscle growth, timed practice proves mobility improvement, or gym performance establishes sport outcomes.

Cross-device merging, selective restore/merge and redesigned calorie/activity calculations remain outside this release.
