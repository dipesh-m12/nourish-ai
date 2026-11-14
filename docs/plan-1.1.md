# Nourish AI 1.1.0 — plan

Driven by the take-home review. One idea behind all of it: **the PA comes to you.**

| Review point | 1.1 answer |
|---|---|
| "Is your chat proactive or does the user put in effort?" | Push nudges that deep-link into the app; the chat opens with the PA's message; habits tracked automatically (Health Connect, location) |
| Vitamin D → "raise your energy" | Every insight carries a **feel** line (how you'll feel), shown before the number |
| "Why would someone cheat?" | Photo proof removed. Photos only for meals (calories) |
| Same boring bottom sheet | One interaction per format, all feeding **Mochi's world** |
| "Me identifying goals" | User says what they want (voice / text / photo / report) → PA builds the challenges |
| Is my health improving? | Weekly check-in: outcome trend + PA-proposed plan change |
| Too much text, consistency = stats | Copy pass; consistency becomes one line + Mochi; profile details behind a button |

Platforms: **Android + web.** Native modules sit behind `.native.ts` / `.web.ts` (web = no-op).

## Native setup (done)
- Dev builds replace Expo Go. `eas.json` → `development` (dev client APK), `preview` (APK), `production` (AAB).
- `scripts/wsl-build.sh [profile]`: rsyncs `mobile/` into `~/nourish-build` in WSL (fast Linux FS, Linux node_modules), `npm ci` when the lockfile changes, `eas build --local`, copies the APK to `mobile/builds/` (git-ignored). Never edit the WSL copy.
- `android/` and `ios/` are generated (CNG), never committed.
- **FCM (done):** `mobile/google-services.json` (git-ignored; `mobile/.easignore` lets it into builds) + FCM V1 service-account key uploaded to EAS for `com.nourishai.app`. The admin key never lives in the repo.
- WSL needs `~/.gradle/gradle.properties` limits (Xmx3g, Kotlin 2g, 6 workers) or the Gradle daemon is OOM-killed on 11 GB.
- Notification icon: `assets/images/notification-icon.png` (white sparkle from the logo; Android tints it).

### Packages and why
| Package | Use | Native build needed |
|---|---|---|
| expo-dev-client | dev builds | yes |
| expo-notifications | push + local, action buttons, deep links via `data.url` | yes for remote push |
| expo-localization | IANA timezone (`Asia/Kolkata`) for the cron | no |
| expo-location + expo-task-manager | geofence "reach the park/gym" in background | yes (background) |
| react-native-health-connect | steps, sleep, exercise, weight, hydration (auto-tracking) | yes |
| expo-sensors (Pedometer) | live step count while the walk screen is open (fallback) | no |
| expo-intent-launcher | `SET_ALARM` → phone Clock app alarm for morning habits | no |
| @maplibre/maplibre-react-native | walk path + pick a place; OpenFreeMap tiles, **no API key** (Google Maps needs billing) | yes |
| expo-speech | fallback voice when Gemini TTS fails | no |
| expo-document-picker | upload PDF health reports | no |
| react-native-view-shot + expo-sharing | share Mochi's garden / streak card | no |
| expo-keep-awake | keep the screen on during breathing / timers | no |
| @react-native-community/datetimepicker | custom expiry date, alarm time | no |
| server: bullmq, expo-server-sdk, luxon | queue, push sending, timezone maths | — |

## Architecture decisions
### Queue (BullMQ behind a port)
- `server/src/config/queue.ts`: one config object (`driver: 'bullmq'`, connection, queue names, concurrency, retry/backoff). Changing queue tech = new adapter + this file.
- `services/queue/queue.port.ts`: `QueuePort { enqueue(name, data, opts) ; consume(name, handler) }`. `bullmq.adapter.ts` implements it. Business code imports the port only.
- Producers: a **repeatable scheduler job** (every 10 min) fans out per-profile `nudge.evaluate` jobs. Consumers live in `src/workers/*.consumer.ts` and call services; consumer logic is not an internal function of the scheduler.
- Worker runs in its own process (`npm run worker`, own compose service), so API latency never depends on push work.

### Notifications
- Profile stores `timezone` (IANA, refreshed on every app open) and `pushToken`.
- The evaluator converts UTC now → user local time with luxon; windows (wake, meals, evening) and quiet hours 22:00–07:00 are local. Pure rules module + fixed-clock tests (IST, a DST zone, midnight crossover).
- Dedup: `notifications_sent` unique `(profile_id, kind, local_date)`. Max 3/day; skip if done or app opened < 30 min ago.
- **Write buffer:** sent rows go to an in-memory buffer flushed by **bulk insert every 2 s** (or at 500 rows), `ON CONFLICT DO NOTHING`. Dedup check before sending uses Redis `SET NX` on the same key (TTL 36 h), so the DB write can lag without double sends. Flush on shutdown (SIGTERM).
- Every push carries `data.url` (e.g. `/assistant?prompt=…`, `/challenge/:id/log`); the app routes on tap (cold start: `getLastNotificationResponseAsync`; warm: response listener). Action buttons via notification categories (`Start walk`, `Snooze 15`, `+7 days`).

### Logging = activity + challenge
Anything new the user does writes **both** an `activities` row (with `source`: manual / health_connect / location / timer / agent) and the matching `challenge_logs` row, in one transaction. History can then answer "what was new" from either side.

### Challenges
- Created from "What do you want to achieve?" (voice / text / photos / reports). AI proposes 1–3 with format, target, **feel** line, and expiry intent; code computes dates and numbers.
- Expiry: `ends_on` local date or null (ongoing). "today" → ends tonight. Unknown → ask sheet: Just today · 7 days · 21 days · Ongoing · Custom. Last-day evening push with `+7 days / Done`; on next open a finished card. Status `active → ended` set lazily on read.
- Tap a card = log. Edit/remove via ⋯ menu.
- Dashboard starts empty with "Suggested for you" (from the removed plan slide 3).

### Formats (Mochi's world)
| Format | Interaction | Reward |
|---|---|---|
| tap (water) | glass pours with ripple + haptic | fills Mochi's bowl |
| timer (breathing, meditation, plank) | orb grows/shrinks, haptic per breath, keep-awake | Mochi falls asleep purring |
| steps | live path, Health Connect auto | flowers bloom, 1 per 1k steps |
| food (greens/protein) | meal camera | sprouts in Mochi's garden |
| sleep | Health Connect, good-morning card | Mochi wakes up, room brightens |
| place | geofence on a saved spot (map picker) | postcard stamp |
| meal | camera opens straight away with a scanner frame; "Anything to add?" note (type/voice) | plate card flips in |
| check | one tap | stamp |
Missed days → sleepy, wilted garden, not stats.

### Voice mode
Full-screen orb reacting to mic level → silence detection ends the turn → Whisper → agent → reply spoken with **Gemini TTS** (server returns cached audio; fallback `expo-speech`) → listens again. Mute in voice mode + toggle in Profile. Text chat stays silent.

### Health reports
- PDF or photo → vision model reads markers (Vitamin D, B12, HbA1c, lipids…) → zod. Flags come from **reference ranges in code**, never the AI.
- Challenges framed by the feeling ("15 min of morning sun, for steadier energy").
- Markers stored per report, so the next report shows the trend (the "is my health improving?" answer).

### Text pass (decided)
- Plan slide 2: tips/sample day behind a "More" collapse.
- Briefing body: 1 line max. Challenge cards: label + number only.
- Consistency card → one line ("5 of 7 days · Mochi's best week"); pills and missed count go.
- Health Connect gets a one-screen ask: "Let Nourish read your steps and sleep so you never have to log them."

### Other
- Morning challenges: "Set a wake-up alarm?" → phone Clock app prefilled (`SET_ALARM`), plus a push 10 min after wake time with `Start walk / Snooze 15`. Wake time from onboarding or Health Connect sleep.
- Weekly check-in (Sunday / day 7 push): trend vs goal, best + holding-back habit, PA proposes a swap.
- Meal note on review: "half plate", "in ghee", "packet says 220 kcal" (a stated label kcal replaces that item's estimate).
- Profile: essentials only; "Your details" button → sheet with onboarding data, edit per row.
- What's new: `constants/whats-new.ts`, shown once per version (`preferences.whatsNewSeen`), also listed in Profile.
- Release: block `1.0.0` via the admin route **only after the 1.1.0 APK is published.**

## Art needed (generate with Gemini → `mobile/assets/images/`)
Ask before building each format; list kept in the PR for that format.

## Status (2026-11-15, committed, not yet tested on a phone)
| Area | State |
|---|---|
| Queue: BullMQ behind `config/queue.ts`, consumers in `workers/`, sent log bulk-inserted every 2 s | done |
| Push: user's IANA zone, deep links (`/dashboard?open=meal|goal|challenge&id=`, `/week`, `/walk`, `/place`, `/assistant?prompt=`) | done |
| Push kinds, in order: own reminders (any time) → Sunday week check-in → day's insight → opt-in water (every 90 min while behind). Cap 12/day for now | done |
| Notification permission asked in context only (reminder/water opt-in), never at app start | done |
| Photo proof removed; logs carry `source` (manual/timer/walk/place/health_connect/activity) | done |
| Challenges start empty; "What do you want to achieve?" (voice, text, photo, PDF/image report) | done |
| Expiry (today / N days / always / date) + "keep going?" card | done |
| ⋯ per challenge: daily reminder time, phone alarm (Clock app), how long, remove | done |
| Formats: water glass (holds the day's level), breathing timer, live walk map (steps fallback indoors), place check-in (pin + distance), tally, sleep arc, sprout on done, meal camera auto-opens + scanner + skeleton | done |
| Health Connect steps + sleep sync | done |
| Activity logged in Move also credits a matching challenge (removing it takes the credit back) | done |
| Water target from weight + activity (code) | done |
| Reports in chat and goal sheet (Gemini reads PDFs; 20 s per model then the lighter one) | done |
| Meal note "Anything to add?" (half plate, label kcal, extra food) | removed from the app (duplicated "Add food"); endpoint kept |
| Weekly check-in `/week` (this week vs last, best habit, one fix) + Sunday push | done |
| What's new page, once per version | done |
| Dashboard text pass (food ring + 3 meters, week garden, Move card, briefing one line) | done |
| Live voice mode `app/voice.tsx` (orb follows your voice, a pause ends the turn, reply spoken with Gemini TTS `POST /me/speak`, phone voice fallback, mute remembered; cards finish in chat) | removed from the app (unreliable on device); `/me/speak` kept |
| Reminders screen `app/reminders.tsx` (water sips + one time per challenge; Profile row; assistant `ask.kind=reminders`) | done |
| Suggestions and "Your challenges" moved into the + sheet; walk and sleep sheets redesigned; walk auto-pause when still | done |
| Background geofence auto check-in (opt-in, "allow all the time") | done (`lib/place-task.ts`) |
| Sessions table: walks/timers survive the app closing, walk trophy card saved + shareable (`/trophy/[id]`), timer done notification | done; background GPS needs the next APK (foreground service on) |
| Art: 5 redos | dropped: no screen uses them |
| Design review pass (2026-11-15): briefing why line shown, feel-first report tips + done toasts, report markers over time on `/week`, "Your week" in Profile, starter picks for new users, rest-day streaks, night briefing, non-plate food habits | done |
| Commit, release 1.1.0 APK, deploy server + worker, then block 1.0.0 | committed; APK, deploy, block pending (user decides) |

## Phases
1. ✔ Native setup · timezone + queue + push + deep links · remove photo proof · edit vs log (⋯ on cards)
2. ✔ Pick-up sheet (voice/text/photos; PDF reports later) · ✔ expiry + keep-going · ✔ slide 3 → "Suggested for you" on the dashboard (migration `0019_challenge_expiry`)
3. Formats: ✔ water (tap a glass → Mochi's bowl) · ✔ timer (breathing orb) · ✔ walk (live MapLibre map, blue dot, path, time, distance, steps) · ✔ steps + sleep via Health Connect (`PUT /me/challenges/:id/sync` sets the day, migration `0020_log_source`) · place + map · morning alarm. Format is read from tracking in `utils/challenge-format.ts`; art status in `docs/art-prompts.md`
4. Weekly check-in · meal note · profile details · text pass · consistency line
5. Voice mode (Gemini TTS + mute) · what's new · release + block 1.0.0
