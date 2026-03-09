   [![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)


# IronFlow


A self-hosted strength training tracker with AI-assisted programming, biometric analysis, and nutrition logging. Built as a progressive web app — installable on desktop or mobile, works offline, and stores all data locally in your browser.

No accounts. No subscription. Your data stays on your device unless you choose to back it up.

---

## Mobile and desktop

The app works on both. On a phone it is a clean, focused logging tool. On a wider screen it unlocks a more detailed analytics dashboard and a three-panel template editor with drag-and-drop, resizable panels, and an inline exercise library. Everything you can do on mobile you can do on desktop — the desktop just gives you more room to work with.

---

## What it does

**Training**

Log workouts from saved templates or from scratch. Each set records weight, reps, and rest time. Cardio exercises capture distance and duration instead. The app tracks personal bests automatically and flags them during active sessions.

The Program Architect generates custom training splits based on your goals, available days, and equipment. Templates can be edited manually or by prompting the AI directly — plain instructions like "increase volume on chest day" or "swap the isolation work for compound movements" both work.

**Analytics**

The performance dashboard surfaces information that is genuinely useful:

- e1RM trends per exercise over whatever time window you choose
- Weekly tonnage (sets × reps × weight) as a progressive overload signal, with an 8, 12, or 24-week range toggle
- Acute:Chronic Workload Ratio — compares your last seven days of training against your 28-day rolling baseline, shown as a gauge with colour-coded zones and plain-English descriptions
- Muscle group volume charted against MEV/MAV/MRV thresholds
- Training frequency by day of week across all recorded history
- Average session duration by week over 12 weeks
- Consistency heatmap

**Biometrics**

Log bodyweight, body fat percentage, and measurements. The app derives FFMI, waist-to-height ratio, and aesthetic ratios (shoulder-to-waiste and chest-to-waiste) from whatever fields you provide. A 90-day body composition projection extrapolates your current trend using linear regression — shown as a dashed line and clearly labelled as a planning tool.

Relative strength benchmarks compare your estimated 1-rep max on key compound lifts against published gender standards, expressed as a bodyweight multiple on a beginner-to-elite scale.

The Morphology Lab accepts 4 or 8 reference photos and uses the AI to assess visible muscle development by group. A 28-day cooldown is enforced between scans.

**Nutrition**

Log meals by describing what you ate in plain language. The AI parses the entry and returns macro estimates with a confidence score. A bundled dataset of Australian AFCD nutritional data covers common whole foods locally without a network call; Open Food Facts is queried as a fallback for packaged products.

The macro balance radar chart shows your 7-day average intake against your calculated targets across calories, protein, carbs, and fat.

**History archives**

Both the nutrition log and the biometric history group entries by month and year. The most recent month is open by default; older months are collapsed. This keeps both archives manageable as data accumulates over time.

**IronSync**

Optional Google Drive backup. Connects via OAuth and mirrors your full data store to a single JSON file in the app's folder in your Drive. The backup runs automatically after each completed workout when connected. You can also trigger it manually or restore from cloud at any time.

---

## Running locally

**Requirements:** Node.js 18 or later.

```bash
git clone https://github.com/ironflow-gym/IronFlow.git
cd IronFlow
npm install
npm run dev
```

The app opens at `http://localhost:5173`.

**API key**

On first launch you will be prompted to enter a Gemini API key. This is stored in your browser's local storage and never transmitted anywhere other than to Google's API directly from your browser. Keys are free to obtain at [aistudio.google.com](https://aistudio.google.com) under the free tier, which covers normal use comfortably.

If you prefer to bake a key into the build rather than supply it at runtime, create a `.env.local` file in the project root:

```
GEMINI_API_KEY=your_key_here
```

Then rebuild. Note that this embeds the key in the compiled output — do not do this for a publicly hosted deployment.

---

## Deployment

### GitHub Pages

The repository includes a GitHub Actions workflow at `.github/workflows/deploy.yml` that builds and deploys automatically on push to the configured branch.

To use it in your own fork:

1. Go to your repository Settings → Pages → Source and select "GitHub Actions"
2. Push to your branch — the workflow handles the rest

The build uses `base: './'` in `vite.config.ts`, which makes the output portable regardless of repository name or subdirectory path.

No API key is embedded in the default workflow. Users supply their own key at runtime via the in-app onboarding flow. If you want a pre-baked key for a private deployment, add an `API_KEY` secret to your repository and uncomment the relevant lines in the workflow file.

### Netlify

A `netlify.toml` is included. Connect your repository in the Netlify dashboard and it will pick up the build configuration automatically. The redirect rule ensures client-side routing works correctly.

Build command: `npm run build`  
Publish directory: `dist`

### Self-hosting

The build output in `dist/` is a standard static site. Serve it from any web server or CDN — Nginx, Caddy, S3 + CloudFront, Cloudflare Pages, or anything else that can serve static files with a fallback to `index.html` for unknown paths.

Example Nginx location block:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

The service worker handles offline caching. Bump the `CACHE_NAME` version string in `public/sw.js` after any deployment to force clients to fetch the updated assets rather than serving stale ones from cache.

---

## Data and privacy

All workout logs, biometric entries, nutrition data, and settings are stored in IndexedDB in the user's browser. Nothing is sent to any server by default.

The only external network calls the app makes:

- **Gemini API** — for all AI features (workout generation, food parsing, session summaries, morphology analysis). Requests go directly from the browser to Google's API using the user's own key.
- **Open Food Facts API** — queried as a fallback when a food item is not found in the bundled AFCD dataset. No personal data is included in these requests.
- **Google Drive** — only if IronSync is connected. Uses OAuth with a scope limited to the app's own folder in your Drive.

The app works fully offline for all non-AI features once the service worker is installed.

---

## Tech stack

- React 19, TypeScript
- Vite with Tailwind CSS v4
- Recharts for data visualisation
- IndexedDB (via a thin custom wrapper) for local storage
- Gemini 2.5 Flash for all AI features
- PWA with service worker caching

---

## Project structure

```
├── App.tsx                   Root component, state management, IronSync startup
├── types.ts                  All TypeScript interfaces
├── components/
│   ├── stats/                Desktop analytics widgets
│   │   ├── StatsDashboard    Three-tab performance hub (Train / Biometrics / Fuel)
│   │   ├── E1RMChart
│   │   ├── MuscleVolumeChart
│   │   ├── ConsistencyHeatmap
│   │   ├── TonnageTrendChart
│   │   ├── ACWRGauge
│   │   ├── TrainingPatternCharts
│   │   ├── RelativeStrengthPanel
│   │   ├── BodyCompositionProjection
│   │   └── MacroRadarChart
│   ├── DesktopSidebar        Collapsible icon sidebar (desktop only)
│   ├── ActiveWorkout         Live workout screen with rest timer and interval support
│   ├── WorkoutHistory        Performance charts, drill-down, session history
│   ├── BiometricsLab         Biometric tracking and dimensional indices
│   ├── MorphologyLab         AI photo-based muscle assessment
│   ├── FuelDepot             Nutrition logging
│   ├── ProgramCreator        Template browser and AI program generation
│   ├── TemplateEditor        Routes to desktop or mobile editor based on screen width
│   └── TemplateEditorDesktop Three-panel desktop editor with drag-and-drop
├── services/
│   ├── geminiService         All Gemini API calls
│   ├── ironSyncService       Google Drive backup via OAuth redirect flow
│   └── storageService        IndexedDB wrapper
├── src/
│   └── utils.ts              Shared computation: e1RM, tonnage, ACWR, streak, etc.
└── public/
    ├── sw.js                 Service worker (cache-first PWA strategy)
    └── manifest.json         PWA manifest
```

---

## Building from source

```bash
npm run build      # TypeScript compile + Vite bundle → dist/
npm run preview    # Serve the dist/ output locally to verify the build
npm run lint       # ESLint
```

The build output in `dist/` is self-contained and requires no server-side runtime.
