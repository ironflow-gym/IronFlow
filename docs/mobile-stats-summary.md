# Mobile Stats summaries — release 2.5.3

Approved scope: recent training and body-weight summaries, accurate session counts, and clear recovery wording. Nutrition is unchanged. No data schema or backup changes; summaries are computed locally and do not require AI. Push to branch `2.4` authorised by the user.

## Train

A compact summary precedes the existing AI review and analytics. The total covers the 28 local calendar dates ending today. This week's count uses local Monday–Sunday boundaries. Expandable consistency covers the same 28-day total using calendar weeks, marking partial weeks at either edge and the current week incomplete; the current goal is explicitly used for comparison because historical goal settings are unavailable. All-time totals remain under a disclosure.

Session IDs distinguish multiple workouts on one day. Rows without IDs are one conservative group per date; names and timestamps never invent extra legacy sessions. Stats totals, current-week counts, weekly streaks and anniversary workout counts share that identity rule. Future rows are excluded from current totals/streaks.

Up to two positive comparisons use best working loads at exactly the same rep count, exercise/category and stable routine ID (or historical routine name when IDs are missing). Units are converted; warmups, deloads, timed/cardio and assisted sets are excluded. Ambiguous same-day ordering cannot establish improvement. Dates and context are visible. This is a recorded-set comparison, not a physiological claim or an automatic progression decision.

## Bios

The latest actual measurement, date and age precede a small 28-day chart. A trailing seven-day average requires at least three distinct measurement days in its window; comparing adjacent seven-day periods requires that coverage in each. Missing readings remain gaps. Sparse history shows a dated recorded change, using first/latest in 28 days or the latest two older readings when needed. Future readings are excluded; one reading per date is used, and weight units are normalised. Waist change is secondary, with dates and cm/in units. No extrapolation or body-fat/muscle inference. The existing detailed charts remain available; desktop keeps its detailed panels.

## Recovery

The existing recovery recommendation mathematics are unchanged. The misleading loading-block progress bar/labels are replaced with Recovery guidance. Explicit deload flags supply the real marked date; inferred quieter periods are not presented as recorded sessions. Calculation details retain estimated timing, volume and exertion signals. Guidance is advisory and never changes blocks, appointments, progression rules or workouts.

Focused tests cover identity, same-day sessions, legacy grouping, comparable sets and unit conversion, ambiguous ordering, rolling-average coverage, duplicates, gaps, future/stale entries, waist data, recovery provenance and weekly streaks. Browser checks cover mobile Train/Bios, sparse data, block preservation and desktop panels. Final validation is reported after the complete regression run.

Date-dependent summaries refresh on returning to the app and across local midnight. Load comparisons require an identifiable routine context rather than assuming missing routine information means the same programme.

The body chart uses dated x-axis values and guards empty tooltip labels during relayout. Date rollover is exercised in browser coverage, including a previously future-dated record becoming eligible on the new local date. The final focused Stats workflows passed twice consecutively after this correction.

Final validation: all **95 Chromium workflows**, **91 unit tests**, and TypeScript/production build passed. Mobile Train and Bios were reviewed at narrow widths with no horizontal overflow; browser coverage includes desktop panel retention, same-day sessions, sparse/stale/future measurements, date refresh and preservation of training-block records. Existing build size/mixed-import warnings remain. Release 2.5.3 is prepared for the authorised push; GitHub checks, deployment and user review remain pending.
