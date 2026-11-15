# Nourish AI

A personal health assistant that plans, nudges and explains, so you don't have to.
It knows your goal **and why it matters to you**, and each day it tells you the one thing to do next.

| | |
|---|---|
| **Web** (desktop + phone browsers) | https://nourish.mavinash.in |
| **API** | https://api.nourish.mavinash.in/health |
| **Android APK** (46.5 MB, arm64) | [Diawi](https://i.diawi.com/Uk9xZs) · [Expo build](https://expo.dev/accounts/dipeshmishra/projects/nourish-ai/builds/2dfc8f87-c1f9-49f3-9f1e-eab1039a723d) |
| **App map (all screens)** | [Excalidraw mind map](https://excalidraw.com/#json=qCmSingB_UCbDygJGHdyF,xyXajJBgWpVWmEfoqatQyw) |
| **Demo video** (the app, end to end) | [Watch on Google Drive](https://drive.google.com/file/d/1qdICUPqpktAGBg6irmT6ldgt6-PqAzze/view?usp=sharing) |
| **Mind map walkthrough** ⭐ _Recommended_ (all screens, dashboards, Razorpay) | [Watch on Google Drive](https://drive.google.com/file/d/1vFf-FyQxtB3XP7W6_QuZMtOoixr2gUeU/view?usp=sharing) |

No sign-up: pick or create a profile on the welcome screen. Data lives in Postgres, so it survives reinstalls and works across devices.

---

## The product

### The problem
Most health apps are logging apps: the user does the work (search the food, type the grams, check the chart) and the app stores numbers. People quit within weeks.

The test I designed against: **a good personal assistant does the heavy lifting.** Like a PA who knows your schedule and likings and brings you only what matters, the app should know your goal, your reason and your day, and hand you one clear next step.

### 1.1: what changed after the review
The 1.0 review said, fairly, that it was "not a PA yet". 1.1 is the answer, point by point:

| Review point | 1.1 |
|---|---|
| Is the PA proactive, or does the user put in the effort? | **Push nudges at the right moment** (your clock and timezone, quiet 22–07, each kind once a day) that open the exact screen. Reminders fire at the minute you set. Steps and sleep fill in from Health Connect, and pinned places check you in when you arrive. A new user starts with **the PA's three picks, one tap to start**. |
| "Vitamin D → raise your energy": motivate by feeling | Every challenge carries a **feel line** ("steady energy all afternoon"). Finishing one says it ("Done · steady energy all afternoon"). Report tips lead with the feeling ("For more energy, add palak to lunch… your report showed low iron"). The briefing's personal line ties it to *your* reason. |
| Photo proof is pointless without competition | Removed. Habits log in one tap. Photos are only for meals, because the plate *is* the data. |
| The same boring sheet for every habit | **One interaction per habit:** pour a glass of water, a breathing orb, a live walk map, a timed workout with the exercise's photos, a sleep arc, check in at a pinned place. |
| "Me identifying goals" | Say what you want (voice, text, photo or a **lab report PDF**). The PA proposes 1–3 challenges, never one you already have. |
| Is my health improving? | **Your week:** this week against last, the best habit, one fix, and **goals that follow progress**: a perfect week offers the next step ("Level up: 25 min"), a slipping habit gets one tap to make it easier. Your **reports, area by area** (Iron: Low → Normal). |
| Too much text, consistency as stats | A text pass on every screen. Consistency is now Mochi's garden: one plant a day. |

### The flows
1. **Onboarding → a plan built on your "why".** Six one-question screens, then the AI writes a plan: journey and BMI, a calorie ring with macros, focus habits. The dashboard opens with the PA's first three challenges, ready to start.
2. **Log a meal in one photo.** Snap → the AI lists items with portions → adjust if needed → save. Calories, macros and any food challenge update together.
3. **The daily briefing (the PA).** The top card picks **one** thing for right now (sleep in the morning, a meal window, protein behind pace, water behind for the hour, a report tip at the right meal, a streak at risk, rest at night), says why it matters to you, and does it in one tap. The same rules drive the push nudges.
4. **Health reports.** Share a lab report (PDF or photo) in the + sheet or in chat. The AI reads the markers; the PA turns them into challenges and food tips that fit your diet and allergies, stays quiet once today's meals cover it, and tracks each area across reports.
5. **Talk to Nourish.** Text or hold-to-talk. It answers about your own day, remembers what you said you care about ("my knees hurt on stairs"), and proposes logs as cards you confirm.

Around them: **burn tracking** (resting + sleep + activity), an **exercise library** (876 public-domain exercises) with timed workouts, and walks that keep tracking when the app is closed.

### Motivation and delight
- **Mochi, a companion cat.** Her mood follows your challenges: purring when the day is done, crying if you missed yesterday, gone after 3 missed days in a row.
- **Forgiving streaks.** One missed day a week is a rest day: the streak holds, and Mochi tells you she kept it ("just this once"). A streak that dies on one miss is harsher than the habit it's meant to build.
- **Mochi's room**, drawn in code: every good week (5 of 7 full days) brings her something new (a rug, a cushion, a plant…), and the next item waits as a faint outline. It rewards weeks, not taps, and nothing earned is ever taken away.
- **Level up:** the day a habit hits a full week in a row, the PA offers the next step in one tap. It starts tomorrow, so finished days stay finished.
- **Mochi's garden** for the week, confetti when the day is done, walk and workout **trophy cards you can share**, rolling numbers, haptics.
- **Mochi's Club** (₹149/month, Razorpay test mode): the free plan gets 5 assistant messages, Club is unlimited. Nothing else is behind the paywall.

### What I cut, and why
- **iOS in 1.1.** Background location, Health Connect and push need native builds; I focused on Android and the web.
- **Login.** Per the brief: profiles on the device, a JWT per profile.
- **Medical interpretation.** The app never diagnoses: it reads which markers are out of range and suggests food and habits, and says to see a doctor for anything alarming.

### Self-check against the brief
| Question | Answer in the app |
|---|---|
| 2017 tracker or assistant era? | Photo, voice and reports in. The PA proposes, nudges and fills in what it can (steps, sleep, places). |
| Onboarded with clear goals? | The plan shows the target, the timeline and your reason, then the PA starts you with three picks. |
| WHAT and WHY? | Every challenge has a feel line; the briefing ties the next step to your own reason. |
| Who does the work? | The PA picks the next step, reads reports, estimates portions, and logs walks, steps and sleep for you. |
| Motivation? | Mochi and her room, level ups, forgiving streaks, the garden, trophies, confetti. |
| Is it improving? | Your week, and report markers over time. |
| Simple? | One question per screen, 1–2 word labels, bottom sheets, one primary button. |

---

## Tech

### Stack
| Part | Tech |
|---|---|
| App | Expo SDK 58 **dev builds** (Android + web), Expo Router, TypeScript, React 19 + React Compiler, NativeWind, Reanimated 4, Gesture Handler 3, TanStack Query, Zustand, expo-notifications, expo-location (background tasks), Health Connect, MapLibre (no API key) |
| Server | Node, Express 5, TypeScript, Drizzle ORM, PostgreSQL (Neon), zod 4, Redis, **BullMQ worker** for nudges, Expo push |
| AI | Gemini 3.5 Flash → Flash Lite → Groq (gpt-oss-120b text, Qwen vision) fallback chain; Groq Whisper for speech; Gemini reads PDF reports |
| Storage | S3-compatible private bucket, signed URLs only |
| Payments | Razorpay Subscriptions (test mode) + webhooks |
| Hosting | API + worker: Docker Compose on EC2 behind nginx + Let's Encrypt. Web: Vercel |

### Architecture
```
mobile/ (Expo)                         server/ (Express)
 app/        screens (Expo Router)      routes/       paths + validation middleware
 components/ ui primitives + features   controllers/  HTTP in/out only
 api/        TanStack Query hooks  ───▶ services/     business logic + DB (pure *.rules.ts inside)
 lib/        native modules (.web.ts)   validators/   zod schemas (types inferred)
 store/      Zustand (session, gates)   workers/      queue consumers (nudges)
                                        db/           Drizzle schema + migrations
```
- **Server layers:** `routes → controllers → services → db`. Errors are thrown as `AppError` and one handler turns them into `{ error: { message, details } }`. Multi-table writes run in transactions.
- **Rules are pure and tested:** the briefing, nudges, weekly check-in, Mochi's mood and room, streaks (with the rest day), goal levels, report priorities and marker trends are plain functions over plain data (`npm test`, 82 tests).
- **App state:** server data in TanStack Query (mutations invalidate the day's query, so the dashboard always shows the latest), app state in small Zustand stores, the token in SecureStore.

### Decisions worth calling out
- **Numbers are computed in code, never by the AI.** Calories (4·P + 4·C + 9·F), BMI, weeks to goal, burn (MET × kg × hours), water targets and challenge amounts are all code. The AI writes text, picks items and portions, reads reports, and proposes; zod validates every answer, and a bad answer falls through to the next provider.
  I learned this the hard way: an AI rewrite once turned "99 g protein short, add dal" into "dal will cover it". Now the rules own the advice and the AI writes only the "why" line (digits rejected).
- **Nudges run in their own process.** A BullMQ repeat job fans out one evaluation per user; pure rules decide on the user's own clock; a Redis claim stops double sends; sent rows are bulk-inserted every 2 s. The queue sits behind a small port, so swapping BullMQ touches one adapter.
- **Walks and timers survive the app closing.** A `sessions` row holds the live state; an Android foreground service keeps GPS going; on return the app fills gaps from background fixes, then Health Connect steps. Finishing claims the row, so a double tap can't log twice.
- **The PA remembers priorities.** Every + ask, report and concern said in chat is stored as a signal; the briefing, nudges and chat follow the latest ones, and a newer in-range report ends a priority.
- **AI never blocks the app.** Each call has a timeout and a fallback chain (Gemini → Gemini Lite → Groq → rules/templates).
- **Payments that can't double-charge.** Webhooks are idempotent (unique event id) and ordered by paid count. A Redis lock (`SET NX` + compare-and-delete) makes two quick taps on Join reuse one subscription.
- **Version kill switch.** Builds at or below a version set by an admin route get `426` and see "Time to update".
- **Your calendar, not the server's.** The app sends its local date and timezone, so "today", streaks and nudges follow the user.

### Edge cases handled
Offline (banner, fast-fail requests), timeouts, AI down or returning invalid JSON, reports the AI can't read, food off your diet or allergies (counted as calories, never as challenge credit, and never suggested), duplicate challenge proposals, double taps on logs, walks and payments, the app killed mid-walk, a notification opened while the app was closed, GPS drift while sitting still, expired or deleted-profile sessions, name clashes, empty days, reduced motion.

### Mobile and desktop
The same codebase runs on Android and the web. Native features sit behind `.native.ts` / `.web.ts` pairs, so the web build stays clean. On a desktop browser the app renders in a phone-sized frame, with sheets kept inside it. Payments, push, background walks and Health Connect are phone-only.

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
npm run worker                # push nudges (needs Redis)

# App
cd mobile
npm install
npx expo start                # open in the dev build (scripts/wsl-build.sh); press w for web
```
The app finds the API on your laptop automatically through Expo. Set `EXPO_PUBLIC_API_URL` to point it somewhere else.

**Checks:** `npm run typecheck` and `npm test` in `server/`; `npx tsc --noEmit` and `npx expo lint` in `mobile/`.

### Deployment
- **API:** `server/Dockerfile` + `server/docker-compose.yml` (API, nudge worker and Redis) on one EC2 box, nginx with Let's Encrypt in front. Update: `git pull && docker compose up -d --build`.
- **Web:** Vercel, root `mobile/` (`mobile/vercel.json`).
- **Android:** local EAS builds in WSL (`scripts/wsl-build.sh preview` for the APK).

`AGENTS.md` holds the full engineering notes: conventions, feature reference, and gotchas.
