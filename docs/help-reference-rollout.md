# Plain-language Help rollout

Extends the approved three-article pilot to all 51 Help topics. The original three annotated examples remain; the other 48 topics now lead with an everyday explanation, three or four practical steps and a visible reminder. Complete feature coverage, calculation formulas, thresholds and known limitations remain in expandable reference sections. Technical terms in that reference have also been simplified where they are not app labels or named methods.

Important save-failure, privacy, destructive-action and AI limitations are repeated outside disclosures so users do not need to expand the reference to discover a consequence. Restore retains its prominent replacement warning and Drive-pause explanation.

## Finding information

Keep the seven familiar categories and stable topic IDs. Instead of adding more navigation levels, group the long Training list into Plan your training, During a workout, After a workout, and Exercises and adjustments, ordered by use. Add a labelled topic search covering titles, guide text and reference prose, with contextual category labels, an empty state and direct article navigation. The three pilot articles have additional search keywords because their bodies are separate components. Search is local and requires neither AI nor network access.

Mobile retains one panel at a time and Back navigation. Desktop retains category/topic/article columns. Navigation and reference headings use quieter sentence-case styling, larger readable text and at least 44px interactive targets. Opening another article resets its disclosures and scroll position. Article selection moves keyboard focus to its heading; closing Help preserves the existing focus restoration.

## Visual examples

Retain the actual annotated Today, weight-choice and restore screenshots from the pilot. Add small labelled illustrations for calendar symbols, a four-workout/two-round block, and a grouped saved breakfast. These are explanatory examples, not controls or personal records. Calendar meaning is conveyed with text and symbols as well as colour. Avoid adding decorative images to every topic.

## Scope and checks

No training, nutrition, persistence, backup, AI or chart calculations change. Existing documented limitations remain documented. Originally prepared locally for review. The user subsequently authorised release 2.5.8 and a push to branch `2.4`.

Validation covers all 51 topics at 320px and 1440px, opening their full reference and checking overflow, navigation and unchanged saved records. Additional checks cover search by reference-only terms, no-result recovery, correct category navigation, the pilot screenshots, visible restore consequences and the existing main navigation workflows. Unit tests and TypeScript/production build also run. Visual previews of Training navigation and the calendar article are checked at 320px and 1440px.

Results: 97 unit tests, all 11 scoped Help/navigation browser workflows, and TypeScript/production build passed. The final mobile search Back adjustment was rechecked in both search workflows (2 passed). Existing build warnings remain about bundle size and mixed static/dynamic ExerciseLibrary imports. Changes remain local for review.

## Annotated screenshots for priority workflows

User-approved addition: 18 new real UI crops across eight articles. Logging covers values, exercise icons, and rest/Finish; set types show actual short-tap warmup/deload states and long-press armed deletion; blocks show structure and active-session actions; calendar shows a populated week; meals show Repeat, amount review and grouped saving; barcode shows label basis and amount/totals; equipment shows configuration and detailed plate loading; IronSync shows mock-connected settings and an actual post-restore pause. The calendar and saved-meal sketches are replaced by these screenshots; the block-round diagram remains useful alongside the captures.

Each image has lettered annotations, descriptive alt text, a caption explaining the marked controls and an explicit fictional-records notice. Save/destructive/privacy reminders appear before the screenshots. Intrinsic width/height reserve space before lazy loading; Vite's base URL supports Pages hosting. New assets total roughly 0.5 MB, and they are loaded only when the Help images are requested.

Regenerate with `npm run dev -- --host 127.0.0.1 --port 5174 --strictPort`, then `node scripts/capture-help-workflows.mjs`. The capture script uses a fresh isolated browser context per workflow, fixed Brisbane dates and fictional records. All external traffic is blocked except locally mocked barcode/Drive responses. It never authenticates with a real account or calls AI. It performs a local restore only inside its disposable context to demonstrate the durable pause. Annotations are DOM overlays captured with the browser; app source and controls are not redesigned. Image dimensions are regenerated in `components/help/workflowImageSizes.json` after successful capture.

Screenshot validation: all 13 scoped Help/navigation browser workflows passed, including loading and accessible captions for all 18 new images at 320px and 1440px, matching intrinsic dimensions, visible reminders before the images, and no horizontal overflow. All 97 unit tests and TypeScript/production build passed. Raw captures and an integrated 390px Help view were visually reviewed. Existing build warnings are unchanged. Release 2.5.8 push subsequently authorised; GitHub checks and deployment remain unverified.
