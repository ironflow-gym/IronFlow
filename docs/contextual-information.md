# Contextual information modals

The shared InfoButton shows a 17px information icon inside a 44px button. Native top-layer dialogs provide a titled, scrollable explanation, explicit Close, keyboard focus isolation and Escape dismissal. Buttons use type=button; click handling prevents accidental form submission or disclosure toggling. Local modal state does not replace or reset the owner’s draft, selections, slider positions or scrollable records. Closing returns focus to the trigger.

## Screen coverage

- Today: next-workout priority and calendar behaviour; date/status markers remain visible.
- Block builder/manager: days versus workouts/rounds, block advancement, future edits and Food comparison/restoration. Counts, scheduling conflicts, AI errors/corrections, estimates, approval controls and actual session results stay visible.
- Workout preview/active session: existing exercise Why? and More flows retained without extra set-row icons. Adaptation has method help; manual load increase keeps actual before/after loads and scope visible with an optional progression explanation.
- Food: targets/formulas/defaults/preferences; saved/repeated amount conventions; manual-entry totals; pantry definitions and portion basis. Actual dates, totals, source/estimate labels, missing-nutrient errors, explicit basis/zero conventions and non-conversion warning remain visible. Food goal restoration retains comparisons and approval.
- Stats: the existing weekly consistency disclosure retains actual records; its calculation prose moves to info. Recovery and body-trend methods move to info while dates, counts, partial/stale coverage, units and current recovery status remain inline.
- Desktop charts: old positioned popovers for muscle volume, tonnage, ACWR, projection and strength references become accessible shared modals with audited content. Empty chart states also provide information where applicable. Metric calculations are unchanged.
- Biometrics: existing metric-specific interpretation content is retained in the standard modal instead of the previous custom overlay.
- Settings/equipment: AI fallback, wake lock, volume landmarks and loading conventions gain contextual help. Field labels/units, equipment examples and connection state remain. Exercise instructions and current coaching/AI results remain content rather than generic help.
- Backup/CSV: optional format/contents/recovery explanation is available; destructive replacement, unfinished-session, missing-category and persistent Drive-pause warnings remain visible.

One info action is used per relevant section rather than beside every field. Full Help & Reference remains available; method explanations use the audited terminology and distinguish estimated values from measured outcomes. No underlying training, nutrition, storage or backup algorithms are changed.

## Verification

Focused browser checks cover nested food help without discard, block setup preservation, unapplied Food slider preservation, 44px targets, narrow layout, keyboard close/focus return, read-only behaviour and desktop chart help. Existing Stats method checks now open the information dialog rather than the old disclosure. Final validation: 97 unit tests, all 103 Chromium workflows and TypeScript/production build passed. The full run includes the previously prepared Help updates. Narrow-screen Data Manager was also visually checked at 320px: title, info and Close remain usable without page overflow. Existing build warnings about bundle size and mixed imports remain. Release 2.5.6: push to branch `2.4` authorised by the user; GitHub checks, deployment and user review pending.
