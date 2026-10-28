# Plain-language Help pilot

Scope: three representative Help articles only. The remaining articles, category structure, app behaviour and calculations are unchanged.

- Getting Started → Start your first workout: a short introduction, three practical steps, an annotated Today screenshot, and optional navigation/connectivity detail.
- Training → Choosing your next weight: three steps using the actual Why?/choice labels, current-workout scope in the main text, an annotated real suggestion, and expandable progression/equipment/starting-load information.
- Backup and data → Restore a backup: four steps, an always-visible replacement/Missing warning, an annotated comparison, an explicit Drive-pause outcome, and optional undo/compatibility detail. Making a separate backup is recommended before replacing current records; finishing a workout is not presented as protection from replacement.

Presentation uses sentence-case, semibold headings; comfortable body text; numbered steps; neutral spacing and minimal colour. Formulas and technical exceptions do not lead the article. Existing topic IDs and all 51 topics are retained.

Screenshots in public/help are actual application captures from isolated fictional data, with A/B markers and matching captions. They include alt text and use Vite's base URL for GitHub Pages compatibility. scripts/capture-help-examples.mjs regenerates the examples against a local dev server on port 5174 (or CHROMIUM_EXECUTABLE_PATH for a different Chromium executable). No Drive/AI connection is made. The fixed sample date makes the captures reproducible; captions identify them as examples.

Validation: 97 unit tests, TypeScript/production build and nine Help/navigation Chromium workflows passed. All topics were checked at 320px and 1440px; the three pilot articles have additional checks for steps, loaded images/alt text, disclosures, visible restore consequences and overflow. A 390px visual preview was reviewed. Release 2.5.7: push to `2.4` authorised by the user; GitHub checks, deployment and review pending.
