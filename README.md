# Nourish AI

A personal health assistant that plans, nudges and explains, so you don't have to.
It knows your goal **and why it matters to you**, and each day it tells you the one thing to do next.

| | |
|---|---|
| **Web** (desktop + phone browsers) | https://nourish.mavinash.in |
| **API** | https://api.nourish.mavinash.in/health |
| **Android APK** (46.5 MB, arm64) | [Diawi](https://i.diawi.com/Uk9xZs) · [Expo build](https://expo.dev/accounts/dipeshmishra/projects/nourish-ai/builds/2dfc8f87-c1f9-49f3-9f1e-eab1039a723d) |
| **App map (all screens)** | [Excalidraw mind map](https://excalidraw.com/#json=WkD8OECSJP1zc3rk2Cd4Z,sa1Uf7skBt0_kLKg_NhlYQ) |
| **Walkthrough (Loom)** | _link added on submission_ |

No sign-up: pick or create a profile on the welcome screen. Data lives in Postgres, so it survives reinstalls and works across devices.

---

## The product

### The problem
Most health apps are logging apps: the user does the work (search the food, type the grams, check the chart) and the app stores numbers. People quit within weeks.

The test I designed against: **a good personal assistant does the heavy lifting.** Like a PA who knows your schedule and likings and brings you only what matters, the app should know your goal, your reason and your day, and hand you one clear next step.

### The four flows I chose (and why)

1. **Onboarding → a plan built on your "why"**
   Six one-question screens (about you, body, activity, food, goal, **why**), then the AI writes a plan: journey and BMI, a calorie ring with macros, habits, a sample day, and 6 challenges to accept.
   *Why:* the brief's "WHAT to improve and WHY" starts here. The "why" is stored and quoted back on the dashboard and in every nudge.

2. **Log a meal in one photo**
   Snap → the AI lists items with portions → review (tap an item to change the amount, or type a food) → save. Calories, macros and challenge progress update together.
   *Why:* food tracking is the core daily habit, and typing grams is where people give up.

3. **The daily briefing (the PA)**
   The top card on the dashboard picks **one** insight for right now (morning sleep, open meal window, protein behind pace, water behind for the hour, streak at risk in the evening…) with a one-tap action. A small line underneath says why it matters *to you*.
   *Why:* the app should come to the user, not wait to be opened and read.

4. **Talk to Nourish (assistant chat)**
   Text or hold-to-talk voice. It answers about your own day ("how am I doing on protein?"), suggests workouts, and **proposes** logs as cards you confirm with a photo ("log 2 rotis and dal").
   *Why:* the fastest input for people who'd rather say it than tap through screens.

Around them: **burn tracking** (resting + sleep + activity, week chart), an **exercise library** (876 public-domain exercises, voice search), and **challenges** with streaks.

### Motivation and delight
- **Mochi, a companion cat** you can adopt. Mochi's mood follows your challenges: happy when you're on track, crying if you missed yesterday, and gone after 3 missed days in a row.
- Streaks, a 7-day consistency card, confetti when the day is done, rolling numbers, haptics.
- **Mochi's Club** (₹149/month, Razorpay test mode): the free plan gets 5 assistant messages, Club is unlimited. Nothing else is behind the paywall.

### What I cut, and why
- **Health report upload.** It would mean a PDF/OCR pipeline plus medical-marker rules, and doing it well would take the time the four core flows needed. The data model leaves room for it (targets are per goal, so markers could adjust them later).
- **Wearable integrations.** They need native modules (dev builds). The app stays Expo Go compatible; activity is logged with a photo instead.
- **Login.** Per the brief: profiles on the device, a JWT per profile.

### Self-check against the brief
| Question | Answer in the app |
|---|---|
| 2017 tracker or assistant era? | Photo and voice in, the AI proposes, you confirm. The briefing comes to you. |
| Onboarded with clear goals? | The plan reveal walks through the target, the timeline and the reason. |
| WHAT and WHY? | Every nudge has an action and a personal "why" line. |
| Who does the work? | The assistant picks the next step, estimates portions, and drafts logs. |
| Motivation? | Mochi, streaks, confetti, consistency pills. |
| Simple? | One question per screen, 1–2 word labels, bottom sheets, one primary button. |

---

## Tech

### Stack
| Part | Tech |
|---|---|
| App | Expo SDK 58 (**Expo Go compatible**), Expo Router, TypeScript, React 19 + React Compiler, NativeWind, Reanimated 4, Gesture Handler 3, TanStack Query, Zustand |
| Server | Node, Express 5, TypeScript, Drizzle ORM, PostgreSQL (Neon), zod 4, Redis |
| AI | Gemini 3.5 Flash → Flash Lite → Groq (gpt-oss-120b text, Qwen vision) fallback chain; Groq Whisper for speech |
| Storage | S3-compatible private bucket, signed URLs only |
| Payments | Razorpay Subscriptions (test mode) + webhooks |
| Hosting | API: Docker Compose on EC2 behind nginx + Let's Encrypt. Web: Vercel |

### Architecture
```
mobile/ (Expo)                         server/ (Express)
 app/        screens (Expo Router)      routes/       paths + validation middleware
 components/ ui primitives + features   controllers/  HTTP in/out only
 api/        TanStack Query hooks  ───▶ services/     business logic + DB
 lib/        api client, config         validators/   zod schemas (types inferred)
 store/      Zustand (session, gates)   db/           Drizzle schema + migrations  
```
- **Server layers:** `routes → controllers → services → db`. Errors are thrown as `AppError` and one handler turns them into `{ error: { message, details } }`. Multi-table writes run in transactions.
- **App state:** server data in TanStack Query (mutations invalidate the day's query, so the dashboard always shows the latest), app state in small Zustand stores, the token in SecureStore.

### Decisions worth calling out
- **Numbers are computed in code, never by the AI.** Calories (4·P + 4·C + 9·F), BMI, weeks to goal, burn (MET × kg × hours) and challenge amounts are all code. The AI writes text, picks items and portions, and proposes; zod validates every answer, and a bad answer falls through to the next provider.
  I learned this the hard way: an AI rewrite once turned "99 g protein short, add dal" into "dal will cover it". Now the rules own the advice and the AI writes only the "why" line (digits rejected).
- **The assistant proposes, the user confirms.** Chat logs are cards with numbers computed on the server. Confirming claims the row in one `UPDATE`, so a double tap can't log twice. Logs need a photo the vision model accepts.
- **AI never blocks the app.** Each call has a 15 s timeout and a fallback chain (Gemini → Gemini Lite → Groq → rules/templates). Plans, briefings and nudges still work with no AI key at all.
- **Payments that can't double-charge.** Webhooks are idempotent (unique event id) and ordered by paid count, so stale retries never roll access back. A Redis lock (`SET NX` + compare-and-delete) makes two quick taps on Join, even from two phones, reuse one subscription.
- **Version kill switch.** Builds at or below a version set by an admin route get `426` on every call and see "Time to update". The rule is cached in Redis and the cache is cleared when it changes.
- **Files:** a private bucket; the DB stores keys only, the API returns 1-hour signed URLs, and uploads are checked by their magic bytes.
- **Your calendar, not the server's.** The app sends its local date and timezone, so "today", streaks and nudges follow the user.

### Edge cases handled
Offline (banner, fast-fail requests), timeouts, AI down or returning invalid JSON, photos that aren't food or don't prove the challenge, food off your diet or allergies (counted as calories, never as challenge credit), double taps on logs and payments, expired or deleted-profile sessions (back to the picker), name clashes, empty days, reduced motion, payments confirmed only by webhook (the app asks the server before showing "failed").

### Mobile and desktop
The same codebase runs on Android, iOS and the web. On a desktop browser the app renders in a phone-sized frame, with sheets and dialogs kept inside it. I chose this over a separate desktop layout to keep one consistent experience in the time available. Payments and voice notes are phone-only (the Club page says so on web).

---

## Run it locally

**Requirements:** Node 22+, a Postgres URL, Redis (for checkout locks), and API keys (see `server/.env.example`).

```bash
# API
cd server
cp .env.example .env          # fill in DATABASE_URL, JWT_SECRET, AI and storage keys
npm install
npm run db:migrate
npm run dev                   # http://localhost:4000/health

# App
cd mobile
npm install
npx expo start                # scan with Expo Go; press w for web
```
The app finds the API on your laptop automatically through Expo. Set `EXPO_PUBLIC_API_URL` to point it somewhere else.

**Checks:** `npm run typecheck` and `npm test` in `server/`; `npx tsc --noEmit` and `npx expo lint` in `mobile/`.

### Deployment
- **API:** `server/Dockerfile` + `server/docker-compose.yml` (API + its own Redis) on one EC2 box, nginx with Let's Encrypt in front. Update: `git pull && docker compose up -d --build`.
- **Web:** Vercel, root `mobile/` (`mobile/vercel.json`).
- **Android:** EAS (`mobile/eas.json`, `preview` profile for the APK).

`AGENTS.md` holds the full engineering notes: conventions, feature reference, and gotchas.
