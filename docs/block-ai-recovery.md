# Block-builder AI generation recovery

Scope: only AI generation requested within Create training block. Ordinary Find a workout, programme generation, AI editing and other structured-response validation retain their strict behaviour. No persistence schema changes.

The block builder uses a separate generation entry point. It retains bounded string rep/time targets for review after validating the surrounding programme against the existing response schema. Unknown model fields and IDs are still discarded. Missing structures, wrong types, invalid numeric values and incorrect workout counts are rejected with readable explanations; existing staged workouts and saved records are retained.

Harmless dash/seconds formatting is normalised. Ambiguous targets and inconsistent tracking/starting reps or seconds are flagged without guessing a prescription. One corrective generation is attempted; if it fails or remains invalid, the original structurally validated draft is retained. The draft is never autosaved as a usable block.

Only affected workouts reveal correction panels. Each shows the exercise name, original AI target, specific reason and existing prescription fields. Reordering/removing workouts keeps issues associated with stable local IDs. Full-editor saves recompute issues to avoid stale exercise positions after deletion/reordering. Both review and final creation check unresolved issues. A replacement generation cannot erase the staged draft when its response is unusable. Ordinary manual/saved routines retain their existing behaviour.

Validation includes malformed responses, numeric/structural rejection, session counts, unit/target consistency, one correction attempt, fallback on correction failure, non-block strict validation, narrow-screen manual correction and preservation of staged/saved workouts. AI browser responses are mocked; this does not establish live provider compliance.

Final local validation: 95 unit tests and all 97 Chromium workflows passed, including existing AI adaptation/edit rejection, training blocks, persistence, backup/restore and active-workout workflows. TypeScript and production build passed; existing mixed-import and bundle-size warnings remain. The new recovery UI passed at 320px without horizontal overflow. Release 2.5.4: push to branch `2.4` authorised by the user; GitHub checks, deployment and user review pending.
