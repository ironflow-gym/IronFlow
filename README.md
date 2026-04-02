# IronFlow

AI-powered training tracker. No account. No subscription. Your data stays on your device.

🔗 [ironflow-gym.github.io/IronFlow](https://ironflow-gym.github.io/IronFlow/)

---

## What it does

IronFlow tracks strength training, cardio, body composition, and nutrition. Before each session it suggests weights and reps based on your history. After each session it analyses your performance and flags personal records. Over time it tracks volume per muscle group against evidence-based thresholds and tells you when a deload is due.

It runs in your browser as a Progressive Web App — install it from Chrome or Safari, no app store required.

**Mobile** is built for the gym: logging sets, rest timer, cardio intervals, and session review.

**Desktop** adds a full analytics dashboard — strength trends, muscle volume charts, consistency heatmap, and a wider programme design workspace. Build your programme on desktop, sync to your phone via Google Drive, and train.

---

## Setup

### Install

1. Open [ironflow-gym.github.io/IronFlow](https://ironflow-gym.github.io/IronFlow/) in Chrome or Safari
2. **Mobile:** share icon → Add to Home Screen
3. **Desktop:** install icon in the address bar

IronFlow works offline once installed. AI features and cloud sync require a connection.

### API key

AI features need a free Google Gemini API key.

1. Go to [aistudio.google.com](https://aistudio.google.com) → Get API key
2. In IronFlow: Settings → AI Engine → Add API Key

The free tier covers typical daily use. If you hit the daily limit, add a paid fallback key in the same settings panel — IronFlow switches to it automatically when needed.

---

## Features

### Workout logging
- Set logging with weight, reps, rest timer, and RPE rating
- Warmup and deload set marking — excluded from relevant metrics automatically
- Cardio logging with distance and duration
- HIIT interval timer with automatic set logging
- Mid-session exercise swap with AI suggestions
- AI weight and rep suggestions based on your training history

### Performance tracking
- Personal records with month-over-month comparison
- Estimated one-rep max trend per exercise
- Strength benchmarks relative to bodyweight
- Weekly training volume per muscle group against MEV/MRV thresholds
- Acute:chronic workload ratio (ACWR) with RPE-weighted mode
- Deload scheduler based on block length, volume zone, and RPE trend
- Consistency streak

### Programme design
- AI programme generation — describe your goals and get a complete template
- Multi-session batch generation for full training weeks
- Natural language template refinement
- Available on both mobile and desktop

### Body composition
- Weight, body fat %, and measurement logging
- 30-day lean tissue and fat mass delta
- Navy method body fat estimate
- FFMI, waist-to-height ratio, and IronFlow Quotient

### Nutrition
- AI meal logging from plain-language descriptions
- Macro tracking against daily targets
- Food pantry for saved items

### Exercise library
- Default library with muscle tags
- Add custom exercises
- Edit primary and secondary muscle tags — changes backfill historical logs
- AI enhancement fetches technique data and adds missing secondary muscles
- Search for any exercise online and add it directly

### Data
- All data stored locally in your browser
- Export a full JSON backup at any time
- IronSync: automatic Google Drive backup after every session, restore on any device

---

## Moving data between devices

IronSync is the link between mobile and desktop.

1. Settings → IronVault: Cloud Backup → Initialize Cloud Vault (source device)
2. Authorise with Google — IronFlow syncs automatically from that point
3. On any other device: Settings → IronVault: Cloud Backup → Restore from Cloud

---

## Privacy

- Training data is stored in your browser's local storage
- IronSync backups go to your own Google Drive — IronFlow has no access to them
- AI requests use your own Gemini API key. On the free tier, Google may use prompts for model training; the paid tier opts out
- No analytics, no tracking

---

## Known issues (beta)

- IronSync tokens expire after one hour and refresh automatically. If a sync fails, reconnect in Settings
- iOS Safari has reduced PWA support — wake lock and background sync may not work as expected

---

[github.com/ironflow-gym/IronFlow](https://github.com/ironflow-gym/IronFlow)
