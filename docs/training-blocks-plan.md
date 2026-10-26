# Training blocks — next design stage

No training-block implementation is part of 2.4.7. The user explicitly selected progression first and blocks in a subsequent release.

## Confirmed decisions

- One active block at a time; other/unscheduled workouts remain available.
- Blocks continue until their prescribed sessions are finished. Show Session N of total rather than misleading calendar-week progress. Missed calendar appointments do not shift automatically.
- Resistance progression uses every prescribed working set reaching the upper target in one completed session, with an explicit manual load-increase option (implemented separately in 2.4.7).

## Proposed goal catalogue (needs final programme design)

Strength; muscle growth; fat loss; muscle gain with fat loss; general fitness; cardiovascular endurance; muscular endurance; power; mobility; healthy ageing/everyday function; sport/event preparation; maintenance. Returning after a break, experience, equipment and time availability modify a selected goal. The catalogue was proposed, not individually approved as implemented programme templates.

Use goal-specific prescriptions and outcome measures. Weight/rep progression must not be applied indiscriminately to cardio, power or mobility. One goal entry point with common options first and More goals avoids a dense setup form. Manual/existing-routine creation and optional AI generation should share the same explicit programme review.

Build on Today, routine management, calendar, exact session links and existing Stats. Store block prescriptions separately from source routine changes; started/completed sessions retain snapshots. Persist block data in local autosave, JSON and Drive, restore comparisons and local recovery. Older backups must remain readable.

A grounded current literature review is still needed before selecting detailed goal prescriptions. Live WHO/PubMed/search access returned HTTP 403 during the planning session. Background references supplied were ACSM's 2009 progression position stand (PMID 19204579), the resistance-training prescription network meta-analysis (doi:10.1136/bjsports-2023-106807), and WHO 2020 physical activity guidance. These were not represented as freshly retrieved current literature.
