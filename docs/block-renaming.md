# Rename a training block

View block now has a labelled 44px pencil button alongside its summary. Rename opens a focused dialog with the current name selected. Save name trims whitespace and rejects an empty name; Cancel or Escape keeps the existing name. Both active and past blocks can be renamed.

The name-only callback updates the matching block by ID using the existing persisted block state. It does not invoke block status/scheduling transitions or change sessions, routine names, appointments, Food settings, workout drafts or historical records. Existing autosave, retry and backup handling apply without a schema change. Help guidance is updated.

Validation: TypeScript/production build passed; the 14 existing training-block browser workflows passed, and two additional rename workflows passed. Rename coverage checks 320px layout, focus/return focus, cancellation, blank validation, trimming, reopening after reload, unchanged linked data and past-block status. The 320px editor was visually reviewed. Release 2.5.9 push to `2.4` authorised by the user; GitHub checks, deployment and user review pending.
