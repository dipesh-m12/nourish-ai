# AGENTS.md — Nourish AI

Shared brief for any AI coding agent (Claude Code, Codex, Cursor, Gemini…). Read fully before changing code.
Expo-specific rules: [`mobile/AGENTS.md`](mobile/AGENTS.md).

## 1. Aim
A **proactive personal health assistant** app, not a data-logging app. The assistant knows the user's goal **and their reason (the "why")** and does the heavy lifting: it plans, nudges and explains, so the user doesn't have to.
Take-home project (1.5–2 days). Build **3–4 polished flows**, not 10 mediocre screens.

Self-check every feature:
- Does it feel like a 2025+ AI-assistant app or a 2017 tracker?
- Does it tell the user **what** to improve and **why**?
- Is the app doing the work (proactive), or the user?
- Is there motivation (streaks, celebrations, delight)?
- Is it simple, low on text, with few buttons? Would someone open it daily for 90 days?

## 2. Hard rules
- **Never write the client company's name, or the other brand name the brief forbids,** anywhere: code, commits, README, URLs (not even in this rule). The app name is **Nourish AI**.
- **Light theme only** (no dark default). No neobrutalism.
- **No login.** Profiles are picked or created on the device. Data must persist across restarts.
- **From 1.1.0: Android dev builds (Expo Go dropped), Android + web only.** Native modules go behind `.native.ts` / `.web.ts` so the web build keeps working. Build with `scripts/wsl-build.sh` (see `docs/plan-1.1.md`); don't run EAS cloud builds unless asked.
- **Every feature must work end to end.** Handle loading, empty, error, offline and invalid input.
- **No vibe-coded mess**: small files, clear layers, comments explain *why*, not *what*.
- **Never commit secrets.** `server/.env` is git-ignored.
- Commits: small and meaningful, conventional style (`feat(onboarding): …`).

## 3. User preferences
- Keep replies **short**. Tokens matter, so avoid heavy commands (full builds, big installs) unless needed.
- **Simple code first**, then good principles (SOLID, separation of concerns). No over-engineering, no monorepo tooling.
- **Plan first, ask when unsure**, then build step by step. Don't scaffold large things unasked.
- Use design skills for UI and animations. Reserve image space with an exact spec (see §8).

## 4. Stack
| Part | Tech |
|---|---|
| Mobile | Expo SDK 58 **dev builds** (Android + web; Expo Go dropped in 1.1), Expo Router, TypeScript, React 19 + React Compiler, NativeWind 4 (Tailwind 3), Reanimated 4, Gesture Handler 3 (hooks API), TanStack Query 5, Zustand, expo-secure-store (JWT), AsyncStorage (drafts), expo-image, expo-image-picker + expo-image-manipulator (photos), **expo-audio + expo-file-system** (voice notes), lottie-react-native, lucide-react-native, react-native-svg, expo-haptics, NetInfo (offline), PostHog, Lora + Inter + Barlow Condensed (numbers) fonts. 1.1 natives: expo-notifications, expo-location + expo-task-manager (walks, geofences), react-native-health-connect, MapLibre, react-native-view-shot + expo-sharing, expo-keep-awake |
| Server | Node, Express 5, TypeScript (tsx + nodemon), Drizzle ORM + drizzle-kit migrations, Postgres on Neon, zod 4, jsonwebtoken, AWS SDK v3 (Neon S3-compatible storage), Redis (ioredis), BullMQ worker, expo-server-sdk, luxon |
| AI | **Gemini** `gemini-3.5-flash` (thinking low) → `GEMINI_FALLBACK_MODELS` (default `gemini-3.5-flash-lite`) → **Groq** `openai/gpt-oss-120b` (text) / `qwen/qwen3.8-27b` (vision, JSON mode) → caller fallback (templates / rules). **Speech:** Groq `whisper-large-v3-turbo`, Gemini audio as fallback. All via `fetch`; keys in `server/.env` |
| Data | Free Exercise DB (public domain, github.com/yuhonas/free-exercise-db), read into server memory; nothing copied. MuscleWiki key is in `.env` but on the free BASIC tier (playground only) — needs the paid TESTING tier to be used |

**Env (`server/.env`, never committed; see `.env.example`):** `PORT DATABASE_URL JWT_SECRET JWT_EXPIRES_IN GEMINI_API_KEY GEMINI_MODEL GEMINI_FALLBACK_MODELS GROQ_API_KEY GROQ_MODEL GROQ_VISION_MODEL AWS_ENDPOINT_URL_S3 AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION S3_BUCKET MUSCLEWIKI_API_KEY`. Mobile: `EXPO_PUBLIC_API_URL` (optional; auto-detected from the Expo host), `EXPO_PUBLIC_POSTHOG_KEY/HOST`.

## 5. Layout & commands
```
mobile/   Expo app      → npx expo start --clear   (lint: npx expo lint, types: npx tsc --noEmit)
server/   Express API   → npm run dev              (types: npm run typecheck)
          DB            → npm run db:generate && npm run db:migrate   (schema: src/db/schema.ts)
```
Before saying a task is done, run **lint + typecheck** in each app you touched, and curl-test any new endpoints.

## 6. Architecture conventions
**Server** (`server/src`): `routes → controllers → services → db`
- `routes/*.routes.ts`: paths + middleware (`validateBody(zodSchema)`). `controllers/*`: HTTP in/out only (Express 5 forwards async errors). `services/*`: business logic + DB. `validators/*`: zod schemas + inferred types. Pure maths in its own module (`nutrition.service.ts`, `metrics.service.ts`, `burn/burn.math.ts`, `diet-rules.ts`).
- Errors: throw `AppError` → `middlewares/error-handler.ts` responds `{ error: { message, details } }`. Multi-table writes go in `db.transaction`. All endpoints under `/api`. JSON body limit 2 MB (photos/audio are base64 in JSON).
- **Auth (JWT, no passwords):** `POST /auth/signup {name}`, `POST /auth/session {profileId}` → `{ profile, token }` (HS256, `sub = profileId`, `JWT_EXPIRES_IN` 30d). `requireAuth` checks the Bearer token + that the profile exists, sets **`req.profileId`** (read via `authedProfileId(req)`; never from the body). Public: `/api/auth/*`, `GET /api/profiles`. Everything personal is **`/api/me/*`**, no profile ids in URLs.
- **The numbers rule:** calories, macros, BMI (WHO 18.5/25/30, classes I–III), weeks to goal, kcal burned, challenge amounts are **computed in code**. AI writes text, picks items/portions, classifies, and proposes; it never decides a stored number. Meal kcal = 4·P + 4·C + 9·F of rounded macros; burn = MET × kg × hours.
- **AI layer** (`services/ai/`): `LlmProvider` (`GeminiProvider`, `GroqProvider`; flags `supportsImages`, `fast`). `generateStructured(zodSchema, {system,user,images?}, check?, {fast?})` → zod → JSON Schema, strips fences, validates, falls through providers on timeout (15 s)/error/invalid shape/`check` failure; returns `{data, provider, model}`. Requests with images skip non-vision providers. `fast: true` tries fast providers (Groq) first (chat, typed foods). `transcription.service.ts`: Whisper first, Gemini audio fallback; filters Whisper's silence phrases ("you", "thank you"…) → `''`.
- **No photo proof (1.1):** challenge, activity, sleep and agent logs count in one tap (nobody competes, so nobody cheats). Only food challenges need a photo, because the plate is saved as a meal. `proof.service.ts` was removed.
- **Push nudges (1.1):** `PUT /me/device {timezone (IANA), pushToken?}` on every app open. Worker process (`npm run worker`, compose service `worker`) runs a BullMQ repeat job every 10 min → one `nudge.evaluate` per user → `nudge.rules.ts` (pure: user's local clock via luxon, quiet 22–07, max 12/day, once per key per day, skip if active < 30 min, never "you're over") → Redis Lua claim `nudge:day:{profile}:{date}` → Expo push (`data.url` deep link; Android channel `nourish-chime` with the bundled `assets/sounds/nourish_chime.wav`, set via the expo-notifications plugin `sounds`; a channel's sound is fixed at creation, so a new sound = a new channel id) → `notifications_sent` written in 2 s batches. Queue tech is behind `QueuePort` (`config/queue.ts` picks the driver).
- **File storage:** Neon S3, private bucket `nourish-ai` (`storage.service.ts`). DB stores **keys** only (`profiles.avatar_key`, `meals.photo_key`); responses carry a 1-h **signed URL** + the key; the app caches by key (`expo-image` `cacheKey`). Uploads checked by magic bytes (`validators/image.validator.ts`, `audio.validator.ts`). Replace/delete removes the old object.
- **Soft delete:** `profiles.deleted_at`; every profile read filters it (`active`). Old tokens → 401. Unique-name index is partial, so the name frees up.
- **Dates:** the app sends its local `date` (YYYY-MM-DD) and `tz` (minutes east of UTC) — "today", streaks and nudges follow the user's calendar, not the server's.

**Mobile** (`mobile/src`)
- `app/`: screens only (Expo Router). `components/ui/`: primitives — Button, Text/Heading, PressableScale (0.97), Chip, AddChip, RadioList, ChoiceTile, OptionCard, NumberField, **Stepper** (hold-to-repeat, rolling digits, `compact`), **RollingNumber**, SegmentedControl, Skeleton, **BottomSheet** (RN Modal, keyboard-aware, `minHeightRatio`), **DraggableSheet** (Gesture Handler `usePanGesture`, scroll body + pinned footer, keyboard-aware), ConfirmDialog, ProgressRing, ActivityRings, **MicButton** (hold-to-talk → `/me/transcribe`), ImageSlot. Feature folders: `components/{dashboard,burn,exercises,agent,plan,onboarding,welcome}`.
- `api/*.ts`: TanStack Query hooks per resource (`profiles, plan, today, meals, activities, exercises, voice, agent, feedback`). `lib/api-client.ts`: fetch wrapper (15 s default, `AI_TIMEOUT_MS` 45 s for AI calls), offline fast-fail, **any 401 → `signOut()`**.
- **State:** Zustand for app state (`store/session.ts` JWT in SecureStore + memory; `store/onboarding.ts` drafts in AsyncStorage; `store/toast.ts`), TanStack Query for server data. Mutations invalidate `['today', date]` (and `['exercises']`) so the dashboard always reflects the latest log.
- `types/`: mirrors API responses. `constants/`: options, colours, `category-theme.ts` (per-category tint/mark/track), `activities.ts` (MET mirror for previews only). `utils/`: pure helpers (`date.ts`, `meal-items.ts`). `hooks/`: `use-voice-note` (expo-audio recorder), `use-debounced-value`, `use-press-repeat`…
- **NativeWind + third-party components:** `lib/native-wind-interop.ts` registers `expo-image` with `cssInterop` (imported first in `app/_layout.tsx`). Without it `className` on `<Image>` is silently dropped and the image renders 0×0. Register any new third-party component the same way.
- Styling: `className`; JS colours from `constants/colors.ts` (keep in sync with `tailwind.config.js`). Use `cn()` (tailwind-merge) for overrides. Avoid arbitrary string classes for sizes that matter (`aspect-[4/3]` → use `style={{ aspectRatio: 4/3 }}`).
- Animations: Reanimated with `.set()/.get()` (React Compiler lint), `useDerivedValue(() => withTiming(...))` for prop-driven motion, ease-out `bezier(0.23,1,0.32,1)`, entering/exiting + `LinearTransition` for lists; always respect `useReducedMotion()`.
- Layout: no floating `absolute` CTAs over content — sticky bars sit in the column flow and reserve their own space. Accessibility: every pressable has a role + label; contrast ≥ 4.5:1.

## 7. Design system
Source: **ui-ux-pro-max** `--design-system` (query: "health nutrition assistant mobile app calm friendly light wellness", motion 6, density 4), plus a `--stack react-native` query. What was adopted and what was overridden:

| From the skill (adopted) | Overridden, and why |
|---|---|
| Organic/calm style; **Lora** headings; breathing loader; staggered entrance 300–450 ms; contrast ≥ 4.5:1; Lucide icons, no emoji; respect reduced motion; UI-thread animations; a11y labels; controlled inputs | Red/blue palette → sage + coral (red reads as alarm in health). Raleway body → **Inter** (uneven numerals hurt a calorie app). "Enterprise Gateway" web pattern → ignored. `back.out` easing → ease-out cubic |

- Colours: bg `#F7F6F2` · card `#FFF` · ink `#1C2321` · muted `#5B6660` · line `#E7E4DC` · primary `#1F7A55` (soft `#E6F2EB`) · accent coral `#E07A5F` (soft `#FBEDE8`) · mustard `#D99A2B` (fat) · danger `#B42318`. Burn: resting `#A9CDB7`, sleep `#6A8D73`, active coral.
- **Charts (dataviz skill):** text in ink, colour only on marks, thin rounded marks, a meter's track is a lighter step of its own hue, today emphasised, one number per chart where possible.
- Patterns: big tappable cards, one question per screen, sticky bottom CTA, haptics on selection/success, press scale 0.97, rounded-2xl/3xl surfaces, minimal text (1–2 word labels on dashboard cards), section headers = small uppercase muted label with `mt-8 mb-3`, collapsible lists ("Your meals · 3 ⌄").
- Bottom sheets instead of centred modals: own `BottomSheet` + `DraggableSheet` (no `@gorhom/bottom-sheet`: it uses the old Gesture Handler builder API).
- Lottie: `assets/lottie/` — `heartbeat.json`, `confetti.json`, `nourish-yoga.json` (assistant face; palette-recoloured copy of the user's `Yoga Se Hi hoga.json`, which is kept untouched).

## 8. Images (delegation)
Images aren't generated in code. Each spot uses `<ImageSlot description="…" />`, which shows the spec until the art exists.
To fill a slot:
1. Generate the image with any image model, using the slot's description as the prompt and the palette from §7. Flat/organic illustration with a transparent background. Export WebP, at most 200 KB.
2. Save it to `mobile/assets/images/<name>.webp`.
3. Replace the `ImageSlot` with `<Image source={require('@/assets/images/<name>.webp')} className="<same size>" contentFit="contain" />` (expo-image).

| Slot | Where | File |
|---|---|---|
| Welcome slideshow (3 slides, **done**) | `components/welcome/hero-carousel.tsx`, data in `constants/welcome-slides.ts` (set `image: require(...)`) | `welcome-1-snap.webp`, `welcome-2-why.webp`, `welcome-3-care.webp` |
| App icon / splash / favicon | `app.json` | **Done:** `icon.png` (centre crop of the slide 1 art, also the Android adaptive background), `splash-icon.png` (rounded tile on `#E1F1E6`), `favicon.png`. Android monochrome icon is omitted (the illustration has no single-colour form). The brief below is an optional future simple mark. |

### Shared illustration style (all welcome slides)
Source: ui-ux-pro-max styles **organic-biophilic** (organic curves, rounded and flowing shapes, soft natural shadows) and **nature-distilled** (earthy warmth, handmade feel, subtle grain), with colours mapped to our palette.
- **Size:** 5:4 (e.g. 1200×960), WebP ≤ 200 KB each. Background is a **flat fill of the slide's band tint** (most image models, Nano Banana included, can't output transparency), so the art blends into the band. Rendered full-bleed over a tinted band that runs under the status bar: keep the **top 15% empty**, the subject in the central 80% width, and the visual weight low (the art sits on the band's bottom edge).
- **Rendering:** flat vector, gentle shading, 5–8% paper grain, rounded shapes, no outlines or thin `#1C2321` lines at most, soft light. **Inclusive cast:** the app is for everyone, so keep the *style* consistent but vary the *people* across slides (gender, age, body size, skin tone, ability). Slide 1 shows hands only; slides 2–3 are object scenes (checklist and nudge cards), so anyone can relate. When people do appear, never show only young, slim people.
- **Colours only:** `#1F7A55` `#6A8D73` `#E6F2EB` `#E07A5F` `#FBEDE8` `#D99A2B` `#F7F6F2` `#1C2321`, plus warm skin tones. Each slide's band tint is set in code, so don't paint a background.
- **Avoid:** text, logos, photorealism, 3D/clay, neon, dark backgrounds, gym gear or dumbbells, scales or tapes, numbers, emoji style.

| # | Band tint | Message | Scene |
|---|---|---|---|
| 1 | `#E1F1E6` | Snap or say what you ate | Hands only (medium-brown skin) hold a phone over a colourful Indian thali (dal, rice, roti, sabzi, salad). A soft coral `#E07A5F` sparkle rises from the phone, with 2–3 leaves around. |
| 2 | `#FAEBD8` | A plan built on your why | A cream checklist card tilted ~6° left, with a coral heart badge (the "why") at the top. Four rows (water, greens bowl, moon, shoe): three ticked in sage, one open. Grey bars instead of text. Leaves behind, small coral sparkle. No people. |
| 3 | `#F9EAD3` | Nudges, not nagging | The slide 1 table the next morning: a steel glass of water, a fruit bowl, a phone face-up with a floating nudge card (dal icon, grey text bars, 5 streak dots: 4 sage, 1 coral) and a coral sparkle. No people. |

Prompt template (swap in the scene):
> Flat vector illustration, organic biophilic style, transparent background, 1200×1000, top 15% empty. [SCENE]. Young South Asian adult, soft gender-neutral look, muted sage clothing. Palette only #1F7A55 #6A8D73 #E07A5F #D99A2B #1C2321 with warm skin tones. Rounded shapes, gentle shading, subtle paper grain, calm and warm mood.
> Negative: text, letters, logo, photorealistic, 3D, background fill, dark, neon, gym, scale, numbers, emoji.

### Brief: logo, app icon, splash
Source: ui-ux-pro-max **design → logo** brief (`scripts/logo/search.py … --design-brief`). It recommends the **Organic/Natural** style for wellness: leaf symbolism, calm greens (sage psychology: "calmness, nature, sophistication"), soft colours. It says to avoid clinical symbols (cross, caduceus), red and anything aggressive.
- **Concept:** a **bowl + sprouting leaf**. A simple rounded bowl (a soft U-curve) with one leaf rising out of it. The leaf's tip is a small four-point **spark**, hinting at the AI assistant. Food (bowl) + growth (leaf) + intelligence (spark) in one mark.
- **Colours:** bowl and leaf in `#1F7A55`, spark in `#E07A5F`. Background `#F7F6F2` (icon) or white (generated masters, per the skill).
- **Shape rules:** geometric but soft, using 2–3 shapes only and matching stroke and corner radii. It must read at **24 px** (notification icon). No gradients, no text inside the icon.
- **Wordmark:** "Nourish" in **Lora SemiBold** (`#1C2321`) followed by "AI" in **Inter Medium**, slightly smaller, in `#1F7A55`, with letter-spacing +2%. The mark sits left of the wordmark, matching cap height.
- **Deliverables:**
  - `icon.png` 1024² (no transparency, mark at ~60% on `#F7F6F2`)
  - Android adaptive: `android-icon-foreground.png` 1024² transparent, mark inside the central 66% safe circle; background colour `#F7F6F2`; `android-icon-monochrome.png` as a single-colour silhouette
  - `splash-icon.png` 1024² transparent, mark only
  - `favicon.png` 48²
- **Prompt:** "Minimal flat logo mark, organic natural style: a rounded bowl shape with a single leaf sprouting from it, the leaf tip forming a small four-point spark. Bowl and leaf deep sage green #1F7A55, spark coral #E07A5F, white background, smooth geometric curves, no text, no gradient, centred, readable at small sizes." Negative: "medical cross, caduceus, red, gradient, 3D, text, letters, complex detail".

## 9. Skills / plugins
Claude Code loads them via `.claude/settings.json`. Other agents can read the same sources.
| Skill | Source | Use for | Used so far? |
|---|---|---|---|
| ui-ux-pro-max | github.com/nextlevelbuilder/ui-ux-pro-max-skill | Design system, palettes, UX rules (`scripts/search.py "<query>" --design-system`) | **Yes**: §7, logo brief, sticky-CTA rule |
| dataviz | Claude Code built-in | Chart colours/marks, meters, stat tiles | **Yes**: calorie rings, consistency pills, week chart, burn split bar |
| expo (expo-animation, expo-router…) | github.com/expo/skills | Router, animation, EAS | **Yes**: sheet curve `bezier(0.32,0.72,0,1)`, ease-out, spring values |
| building-react-native-apps / testing-react-native-apps | github.com/callstackincubator/agent-skills | RN performance, tests | No |
| react-native-skills | `.claude/skills/react-native-skills` (vercel-labs) | Lists, animations, rendering | Partly (FlatList infinite list) |

Rule: before building a feature, open the relevant skill and note which guidance was applied.

## 10. Status & roadmap
- [x] **Flow 1 — onboarding:** profile picker / new profile (debounced unique-name check, 409 on clash) → 6 steps (about, body, activity, food, goal, why) → AI plan (waiting screen with tips → 3-page reveal: journey + BMI sheet, calorie ring + macros, habits/sample day/6 challenges to accept, confetti) → dashboard.
- [x] **Profile:** details, goal, accepted challenges, photo (S3, signed URLs), **assistant toggle**, feedback sheet (5/hour), log out, soft-delete with confirm, animated 404 → PostHog (dev button).
- [x] **Dashboard:** calorie card (concentric rings: kcal outer + up to 3 daily challenges; legend; macro split `eaten/target g`; **Log meal** camera; "Your meals · N" collapsible) → challenge cards (AI tracking widgets ring/bars/tally/check, streaks) + consistency card (7-day fill pills, streak, missed) → why card → **Start burning today** → Ask Nourish tag.
- [x] **Challenges:** AI `tracking` spec per challenge (kind, unit, target, step, widget, proof, label) with rule fallback + repairs (labels, wrong "servings" units). Logging = one tap (no photo since 1.1); amount challenges pick "How much?" (stepper + chips; hours in ½ h up to 14). Server caps at what's left of the period. Food challenges (`food-challenge.ts`: nutrition category or food words) log **as a meal**; movement/sleep logs create a matching **activity** (burn) in the same transaction.
- [x] **Meals (flow 2):** photo → `POST /me/meals/analyze` (items, macros, credits, per-item diet/allergy `conflicts`; nothing saved) → review (tap item: ×amount stepper or type kcal, macros scale; "Add food" types an item → `POST /me/meals/items/estimate`, fast provider) → `POST /me/meals` (server recomputes totals, re-checks credits + diet; off-diet food counts as kcal but never as challenge credit) → `DELETE /me/meals/:id` cascades credits + photo.
- [x] **Diet rules** (`diet-rules.ts`): veg / eggetarian / vegan / jain exclusions + allergies (dairy list shared with vegan; plant butters excluded), whole-word matching; the AI also flags `offDiet`. Challenge proof with off-diet food is rejected.
- [x] **Burn:** `burn.math.ts` — resting (Mifflin–St Jeor BMR for awake hours) + sleep (0.95 MET) + active ((MET−1)·kg·h, like a watch's active energy; never added back to "kcal left"). Burn card (rolling total, split bar, personal rotating tips), week chart, "Your activity" list, **Log activity** sheet (11 kinds or a library exercise; minutes or watch kcal; photo).
- [x] **Exercise library:** Free Exercise DB (876, public domain) in server memory (24 h refresh, stale-on-error). `GET /me/exercises` (search/category/paging, `doneToday`), `/for-you` (3 daily picks by goal/level/home equipment, stable per day), `/filters`, `/:id`. Screens: `exercises.tsx` (debounced search + **hold-to-talk mic**, chips, infinite list), `exercises/[id].tsx` (2-photo crossfade demo, muscles, steps, "I did this" → log with that exercise's MET).
- [x] **Voice:** `MicButton` + `use-voice-note` (expo-audio, mono AAC .m4a 16 kHz 32 kbps, 30 s cap, metering halo) → `POST /me/transcribe`. Used in exercise search and the assistant composer (removed from Log meal by request).
- [x] **Assistant (server + chat UI):** see §11. Daily thread, rule-based opening nudge, structured turns, confirmable cards (a photo only for meals), intro sheet once, "Ask Nourish" price-tag on the dashboard, toggle in Profile.
- [x] **Daily briefing (flow 3, the PA test):** top dashboard card, `GET /me/briefing?date=&tz=` (`services/briefing/`). `briefing.rules.ts` (pure, testable) picks ONE insight in priority order: all done (evening with >600 kcal left → "make dinner a proper one") → morning sleep → open meal window → over target → evening near limit → protein behind pace (waking day 7–22) → water behind for the hour → evening streak at risk → open challenges → on track. Food ideas follow diet + allergies. Plus a weekly weak-spot habit from history. **Rules own the advice (exact numbers); the AI writes only the personal "why" line** (fast provider, rejects digits, 6 s cap, cached per state) because an AI rewrite once turned "99 g short, add dal" into "dal will cover it". Actions open the meal camera, the right challenge log, or the assistant with the ask pre-sent (`/assistant?prompt=`). Card refetches whenever `today` changes; all-done plays confetti once per day.
- [x] **Companion cat (Mochi):** `profiles.preferences` jsonb (flexible; `companion: {kind, status adopted|declined|left (missing = undecided), introSeen, adoptedAt, leftAt}`), merged by `PUT /me/preferences` (app may set only status adopted/declined + introSeen; server owns dates and "left"). Mood rules in `services/companion/companion.rules.ts` (pure): 3 missed days in a row since adoption → left (saved, re-adopt = fresh start) → all done today → happy → no challenges → bored (normal face) → missed yesterday → sad (crying) → ≥ half done → happy → else waiting. A day with no challenges counts as missed. `GET /me/today` returns `companion {name, status, introSeen, mood, line}`. App: Mochi sits in the briefing card (replaced the duplicate greeting + Lottie; `CatFace` crossfades moods, hops when happy), "Adopt a cat →" pill when undecided, nothing when declined; `app/adopt.tsx` slider (5 rules + decide; seen → returning users land on the decision; choosing closes it); Profile → Companion. Art: `assets/images/cat/{happy,normal,sad}.webp` (transparent, ~35 KB, made from the PNG sources by flood-filling the baked-in checkerboard); `left.webp` (her empty cushion). Her room and rest-day streaks: see §11b.
- [x] **Mochi's Club (subscription, ₹149/month, Razorpay test):** free users get 5 assistant messages (`agent.service` → 402 `{code:'quota'}`), Club = unlimited; nothing else is gated. Tables: `billing_plans` (plan created on Razorpay once, cached), `subscriptions` (status, `startAt`, `nextBillAt` = paid-through, `endsAt`, `paidCount`, `autoRenew`, `cancelledAt`), `subscription_events` (every webhook + in-app verification, unique `eventId` → retries are no-ops). Access = paidCount > 0 and `nextBillAt` in the future; each charge extends it; no charge by then = lapsed. 120 monthly charges per subscription. Cancel = autopay off at cycle end, no refund, access until `nextBillAt`. Re-joining while paid-up schedules a new subscription to start at `nextBillAt` (counts only after its first successful charge). Webhook `POST /api/webhooks/razorpay` (raw body, HMAC with `RAZORPAY_WEBHOOK_SECRET`, mounted before `express.json`); paid count orders events so stale retries never roll back. App: `app/club.tsx` (pricing-page pattern: Mochi hero, Free vs Club cards, tick/cross table, FAQ, sticky CTA; member status + turn off autopay), `app/checkout.tsx` (react-native-webview loads `/me/subscription/checkout-page/:id`, Razorpay Checkout posts the result back; server verifies the signature and reads the subscription from Razorpay), assistant shows "N free messages left · Mochi's Club", Profile → Plan. **Double-tap safety (Redis, `services/billing/checkout-lock.ts`):** `checkout:lock:{profileId}` (SET NX, 30 s, released by compare-and-delete Lua) lets one request create the subscription; `checkout:sub:{profileId}` (15 min) returns the same `sub_…` to every repeat tap; the Razorpay subscription gets `expire_by` = the same 15 min. Paid → keys cleared; checkout screen closes unpaid (any exit) → `POST /me/subscription/checkout/abandon` clears keys and cancels the subscription only if Razorpay still says `created`; app killed → TTLs expire. Redis down → checkout fails closed (503); nothing else uses Redis. Config `src/config/redis.ts`: `REDIS_HOST`, `REDIS_PORT` (+ optional `REDIS_PASSWORD`), one shared ioredis client, no offline queue; `/health` reports Redis (EKS readiness).
- [x] **App version kill switch:** table `app_version_rules` (one row per platform: `blocked_through`, `message`, `update_url`). Builds **at or below** `blocked_through` get **426** on every `/api` call (`middlewares/app-version.ts`, reads `X-App-Platform` + `X-App-Version`, which `api-client.ts` sends); the app swaps to `components/update-required.tsx`. Requests without the headers (curl, webhooks, APKs built before this) pass. Rule cached in Redis `app-version:{platform}` (5 min TTL; Redis down → DB). Change it: `PUT /api/admin/app-version` `{platform, blockedThrough|null, message?, updateUrl?}` with `Authorization: Bearer $ADMIN_TOKEN` (env, ≥ 32 chars; unset = admin routes 404); this clears the cache. `GET /api/admin/app-version?platform=android` reads it.
- [x] **Health reports** (1.1): PDF/photo in the + sheet or chat → markers → challenges, report tips, trends on the Week screen (§11b).
- [x] README for 1.1 (review points → answers, flows, architecture).
- [x] 1.1.0 APK built (standalone `preview`, 55 MB), API + worker deployed, 1.0.0 blocked (426). Live state: see §14.
- [ ] Pending: video, README links, optional auto check-in fix (§14).

## 11. Feature reference (for picking up work)

### API (all under `/api`, `me/*` needs `Authorization: Bearer <jwt>`)
| Method & path | Does |
|---|---|
| `POST /auth/signup` `{name}` · `POST /auth/session` `{profileId}` | Create / resume a profile → `{profile, token}` |
| `GET /profiles` · `GET /profiles/name-availability?name=` | Picker list · unique-name check |
| `GET /me` · `DELETE /me` | Profile (incl. `goal`, `avatarUrl/Key`, `showAgent`) · soft delete |
| `PUT /me/avatar` `{image}` · `DELETE /me/avatar` | Profile photo |
| `PUT /me/preferences` `{showAgent}` | Assistant on/off (null = never asked → intro sheet) |
| `POST /me/onboarding` · `POST/GET /me/plan` · `PUT /me/challenges` `{acceptedIds}` | Onboarding, AI plan, accept challenges |
| `GET /me/today?date=&tz=` | Everything the dashboard needs: `targets, eaten, meals, burn, challenges[progress, history28, streak, missed, logsVia]` |
| `POST /me/challenges/:id/logs` `{date, amount?, image?}` | Progress in one tap (food challenges go through the meal camera; movement/sleep also write an activity) |
| `POST /me/meals/analyze` `{date, image, challengeId?}` · `POST /me/meals/items/estimate` `{text}` · `POST /me/meals` · `DELETE /me/meals/:id` | Meal logging |
| `POST /me/activities` `{date, kind\|exerciseId, minutes\|calories, image?}` · `DELETE /me/activities/:id` | Activity logging (manual ones deletable) |
| `GET /me/exercises?date=&q=&category=&limit=&offset=` · `/for-you?date=` · `/filters` · `/:id?date=` | Exercise library |
| `POST /me/transcribe` `{audio}` | Voice note → `{text}` (`''` = nothing heard) |
| `GET /me/agent/context?date=&tz=` | What the assistant knows, in plain sections (Profile sheet) |
| `GET /me/agent?date=&tz=` · `POST /me/agent/messages` `{date,tz,text,image?}` · `POST /me/agent/actions/:id/confirm` `{date,tz,image?, minutes?, calories?, amount?, hours?, items?}` · `POST /me/agent/actions/:id/cancel` | Assistant |
| `POST /me/feedback` | Bug/idea/other (5/hour) |

### Data model (Drizzle, `server/src/db/schema.ts`, migrations `server/drizzle/0000–0024`)
1.1 adds: `notifications_sent`, `sessions` (walks/timers), `user_signals` (asks, reports, concerns), challenge `ends_on` / `remind_at` / `place` / `tracking.levels`, activity `source` / `session_id`, profile `timezone` / `push_token` / `last_active_at`, `preferences.mochiRoom`. Billing: `billing_plans`, `subscriptions`, `subscription_events`; `app_version_rules`.
`profiles` (body, diet, allergies, avatar_key, **show_agent**, deleted_at) · `goals` (targets, why) · `plans` (+ metrics snapshot) · `challenges` (accepted, accepted_at, **tracking** jsonb) · `challenge_logs` (amount, proof_note, meal_id → cascade) · `meals` (items jsonb, totals, comment, photo_key) · `activities` (kind enum incl. cardio/plyometrics/sleep, minutes, calories, exercise_id/name, challenge_log_id → cascade) · `agent_conversations` (one per profile per local day) · `agent_messages` (role, text, ask jsonb, action_id) · `agent_actions` (kind, payload jsonb, status proposed/confirmed/cancelled/expired/failed, result) · `feedback`.

### Assistant (`server/src/services/agent/`, `mobile/src/app/assistant.tsx`, `components/agent/`)
- **Context/tools:** each text turn loads all onboarding fields, goal/why, plan and every accepted challenge category. `get_today`, `get_challenges`, `get_meals`, `get_activities`, `get_profile`, `get_plan` refresh on the authenticated server; exercise search/suggestions remain read tools. `agent.loop.ts` allows two reads, feeds results back and uses refreshed context for proposals. No frontend-supplied identity or arbitrary endpoints.
- **Guardrails:** `agent.guardrails.ts` blocks explicit prompt overrides before AI calls; the turn schema classifies scope and forbids mixing reads/questions/actions. Refused turns cannot execute tools or propose actions. Prompt includes scope, OCR/profile/tool injection, falsified logging and health-safety examples. Regressions: `server/tests/agent.test.ts`; optional real-database HTTP check with stubbed AI: `server/tests/agent-api.smoke.ts` (temporary profile is soft-deleted).
- **Same brain as the PA card:** each turn's data carries `pa` (the briefing rules' kind, card text, offer, weak spot; `briefingService.rulesFor(…, ctx)` reuses the built context), every challenge's `reminder` and `reminders.waterSips`; read tool `get_week` = `weekService.review`. Opener asks (`agent.asks.ts`, pure, tested): `reminders` (pre-filled `plan` from times the user said, validated against their challenges and HH:MM; `suggest` when none set → app-picked times), `week` (→ `/week`), `goal` (the + sheet, `context: 'checkin'` for weigh-ins, `prefill` = their words). The app shows one dark pill per ask; nothing saves until the user taps in the sheet.
- **Chat photo input:** `ask.kind='photo'` renders large camera/gallery buttons; a selected photo goes to the message endpoint for analysis and becomes an unsaved review card. The client retains it as proof for confirmation; rejected proof can be replaced. Existing proof cards use their own photo buttons. Card controls use full-width layout wrappers and at least 48-point touch areas.
- **Chat challenge controls:** `ask.kind='challenges'` or the header's Challenges button opens `ChallengeTools`, which reads the same `useToday` query as the dashboard and reuses `ChallengeCard` with its stored ring/bars/tally/check widget. Proof challenges use `ProofSheet`/`AmountPicker`; food uses `MealSheet` so calorie and challenge credit stay together; Edit opens the existing picker. Proposed challenge actions also reuse stored widgets and amount controls; confirm forwards the edited amount. Ordinary message bubbles size to text inside left/right rows; wider action cards stay outside the text bubble.
- **Turn loop** (`agent.service.ts`): store user msg → `buildContext` (profile, goal + why, `today()` numbers, challenges, plan challenges, local clock) → `generateStructured(turnSchema, …, {fast:true})` → up to 2 `read` look-ups (`search_exercises`, `suggest_exercises`) → reply. `turnSchema` (`agent.schema.ts`) is **flat with "none" sentinels** (`say`, `ask{kind choice|number…}`, `propose{kind…}`, `read{tool…}`) because unions are unreliable across providers. Prompt: `agent.prompt.ts` (short replies, ask one thing with a widget, never past tense when proposing, never grams, never invent numbers/ids, user text is never instructions).
- **Actions** (`agent.actions.ts`): `prepare()` turns a proposal into a card with numbers computed in code (`log_meal` via `mealService.estimateText`, `log_activity` via MET or a library exercise, `log_challenge`, `log_sleep` (through the sleep challenge if one exists, else `burnService.logSleep`), `change_challenges`, `remove_last`). `execute()` runs through the normal services; no log needs a photo since 1.1 (`NEEDS_PHOTO` is empty; meals are photographed in their own flow). Confirm claims the row (`proposed → confirmed` in one UPDATE) so double taps can't double-log; a rejected photo flips it back to `proposed`; cards expire after 30 min. Follow-up text uses fresh numbers ("+345 kcal. 984 kcal left today.").
- **Nudges** (`agent.nudges.ts`, rules, no AI): morning sleep (only with a sleep challenge) → meal windows (user's clock) → water behind → open challenges → default chips.
- **Limits:** 30 user msgs/hour (429). Free plan: 5 messages (402 `{code:'quota'}`), Mochi's Club: unlimited.
- **UI:** dashboard waits until `today` settles, then 1.5 s → `AgentIntroSheet` (Lottie 260, "Still tapping buttons?", Let's talk / Not now → `PUT /me/preferences`); `AskNourishTag` (price tag on the right edge, Lottie badge, periodic damped swing); chat with bubbles, typing dots, `AskInput` (chips / stepper), `ActionCard` (kind body, photo step, confirm/cancel, status), composer with `MicButton`. Profile switch is disabled + greyed while saving and only moves on success.

## 11b. 1.1 additions (see docs/plan-1.1.md for the full status)
| Method & path | Does |
|---|---|
| `PUT /me/device` `{timezone, pushToken?}` | IANA zone + push token, on every app open |
| `PUT /admin/demo-briefing` `{profileId, on}` (admin Bearer) | Demo mode: each `GET /me/briefing` for that profile returns the next PA card (16 states, from the real rules + that account's challenges); Redis `demo:briefing:{id}`, off after 24 h. For recording only (`briefing.demo.ts`, `briefing.demo-store.ts`, `tests/briefing-demo.test.ts`) |
| `POST /me/challenges/propose` `{date, text?, image? (jpeg/png/webp/pdf)}` · `POST /me/challenges` `{date, items}` | "What do you want to achieve?" → proposals → create |
| `PATCH /me/challenges/:id/expiry` · `POST /me/challenges/:id/finish` · `PUT …/reminder` `{remindAt}` · `PUT …/place` `{place}` · `PUT …/sync` `{date, amount}` | Keep going / done / daily reminder / pinned place / Health Connect day total (sets, never adds) |
| `GET /me/week?date=&tz=` | Weekly check-in (`services/week/week.rules.ts`, pure): stats, best habit + `levelUp`, `focus` + `ease`, `reports` |
| `PATCH /me/challenges/:id/level` `{date, direction up\|down}` | Goal one step up/down **from today** (earlier days keep theirs) (`challenges/level.ts`, pure; never water, sleep or checks; caps per unit) |
| `POST /me/meals/note` `{note, items}` | Meal note → per-item scales, label kcal, foods to add (AI reads intent, app applies maths) |
| `POST /me/agent/messages` `{…, report?}` | Report → `create_challenges` card |
| `POST /me/sessions` `{kind walk|timer, challengeId?, date, data}` · `GET /me/sessions/active` · `GET/PATCH /me/sessions/:id` · `POST /me/sessions/:id/finish` `{date, amount?, data}` · `…/cancel` | Walks/timers that survive the app closing (table `sessions`, `data` jsonb). Finish claims the row, logs the challenge with `sessionId` on the activity (trophy link). `today` returns `session` per challenge → card shows Resume |
| `POST /me/speak` `{text}` | Voice mode reply as WAV (Gemini TTS `GEMINI_TTS_MODEL`/`GEMINI_TTS_VOICE`, cached; 503 → app uses phone voice) |
- Reminders live in one sheet (`components/challenges/reminders-sheet.tsx`; bell on the dashboard, Profile, the assistant via `ask.kind="reminders"`; `/reminders` redirects to `/dashboard?open=reminders`): water sips, checkboxes + select all → one time / off (`PUT /me/reminders`), or say it → `POST /me/reminders/plan` (AI picks by list index, app confirms). **Suggested times:** `GET /me/reminders/suggest?date=` (`reminders/reminder-suggest.rules.ts`, pure: a time per daily habit with none, by category, spread 30 min apart; water → sips). The briefing offers them once (kind `reminders`, rule 2¼, 8–21 h, while no reminder is set; seen = `hintsSeen` `'reminders'`) → the sheet opens on that plan (`suggest` prop, or `/dashboard?open=reminders&suggest=1`): tap a time to change it, **Set these** to save. Voice mode and the meal note row were removed from the app (their endpoints remain).
- The dashboard + sheet (`GoalSheet`) holds the plan suggestions (never ones like a running challenge) and "Your challenges".
- **Walk while closed:** `lib/walk-task.ts` = Android foreground service (expo-location task) parking GPS fixes in AsyncStorage; `use-walk-tracker` stores the walk (`walk:active`) and fills gaps on return (background fixes → Health Connect steps → elapsed time, capped 3 h, shown on the card). Builds without `FOREGROUND_SERVICE_LOCATION` fall back to in-app GPS. Timer: start time on the server + a local "done" notification. Trophy: `app/trophy/[id].tsx`, from the activity list. Share = view-shot base64 → app cache → expo-sharing.
- **Auto check-in:** `lib/place-task.ts` geofences (opt-in switch on the place screen, needs "Allow all the time"); synced from the dashboard; one check-in a day + a notification.
- **PA priorities (`services/priorities/`):** every "+" ask, report or photo, and every concern stated in chat (turn field `concern`), writes a `user_signals` row (`focus`, report `findings` with an `area`: iron, vitamin_d, b12, sugar, cholesterol, triglycerides, thyroid; flag low/high, plus `normal` for the main in-range marker per area). `prioritiesFrom` (pure) keeps the last 3 focuses (30 days) and the latest abnormal finding per area (120 days; a newer `normal` ends it). `markerTrends` (pure) compares each area's latest report with the one before → `GET /me/week` `reports` (Week screen "From your reports": Iron Low → Normal). Report tips lead with the feeling, then the marker. They feed the briefing (`priorityTip`, rule 5½: diet/allergy-safe food or habit for a low/high marker at the right hour, silent once today's meals cover it), the AI "why" line (`caresAbout`), push nudges (`priority` moment, 12–21 h) and the assistant (`data.priorities`). Tests: `tests/priorities.test.ts`; live: `tests/priorities-api.smoke.ts`.
- **Streaks forgive one rest day a week** (`services/challenges/streak.ts`, pure): one isolated miss per 7 days holds the run without counting; Mochi says "kept your streak, just this once". Tests: `tests/streak.test.ts`.
- **Goals follow progress** (`challenges/level.ts`): `tracking.levels` keeps earlier goals (`until` date), `goalOn(tracking, day)` gives each day its own goal, so history entries carry `goal` and a level-up never repaints past days or breaks a streak. A change counts from today (`levels` gets `until: yesterday`), so today may reopen ("20 of 25 min"). Offered by the briefing (`level_up` kind, the day a habit hits 7, 14… in a row) and the week check-in (perfect week → "Level up: 25 min"; slipping → "Make it 15 min"). One change per 7 days. Tests: `tests/level.test.ts`.
- **Actions point at real things:** the briefing's sleep card and the chat's sleep opener need a sleep challenge; report habit tips log their own challenge (`habit` regex) or offer to add one; with nothing urgent (or all done with < 3 daily habits) the PA offers one plan idea from an uncovered area (`add_challenge` action → one tap accept). Tests: `tests/briefing.test.ts`.
- **Offers stay short:** a briefing that offers a challenge (`suggest`, or all done with room for one more) has a one-line question and `suggestion {id,title,target,why}`; the card shows a dashed rule, then one row "Ready for X?" with a plus that adds it in one tap (no AI why line on top).
- **What Nourish knows** (Profile sheet): `GET /me/agent/context?date=&tz=` → `agent/context-summary.ts` (pure) turns the assistant's own `buildContext` prompt into plain sections (about you, goal, plan, challenges, what you told Nourish, today).
- **Mochi's room** (`companion/room.rules.ts`, pure; `app/mochi.tsx`, `components/companion/mochi-room.tsx` drawn with react-native-svg): every finished week (Mon–Sun) since adoption with ≥ 5 full days unlocks the next of 8 items (rug → lights); counted lazily in `today`, saved in `preferences.mochiRoom` (survives re-adoption, never lost). `companion.room {unlocked, full, need, newItem}`; Mochi announces a new item for 2 days; the next item shows as a faint outline. Tapping Mochi opens her room once adopted. Tests: `tests/room.test.ts`.
- **First run:** no challenges → `StarterPicks` shows the plan's first idea per category (max 3) with one "Start these 3" tap; "Something else" opens the + sheet.
- **Briefing extras:** 23:00–05:00 only says rest; "protein on pace" only when some is eaten and on pace; the card shows the AI `why` line (2 lines max). Food habits that aren't a plate (plan, no, avoid, stop, cut, limit, without…) log in one tap, not via the meal camera (`food-challenge.ts`, `tests/food-challenge.test.ts`). Finishing a challenge toasts its feel line.
- Formats are read in the app from tracking (`utils/challenge-format.ts`): water, timer, walk (`app/walk.tsx`), place (`app/place.tsx`), sleep, tally, amount, check. Food challenges stay on the meal camera.
- Nudge rules are pure in `services/notifications/nudge.rules.ts` (`pickReminder`, `pickWeekly`, `pickNudge`, `pickWaterNudge`), tested in `tests/nudge.test.ts`.
- `db/index.ts` keeps connections alive and retries a plain query once after ECONNRESET (Neon drops idle sockets).

## 12. Gotchas (learned the hard way)
- **Windows/Git Bash:** heredocs with apostrophes and backslashes break; write scripts/files with the editor tool, not `cat <<EOF` with quotes. PowerShell may deny some calls; Bash works. Stop a stray dev server with `taskkill //PID <pid> //F` (find it with `netstat -ano | grep :<port>`).
- **Metro stale bundle** ("Unable to resolve", missing export): restart with `npx expo start --clear`. After adding native-backed packages (expo-audio…) restart Metro.
- **Typed routes:** a folder without `_layout` names its index `/folder/index`; use a sibling file (`app/exercises.tsx` + `app/exercises/[id].tsx`) for a clean `/exercises`.
- **Gemini 503 "high demand"** happens; the fallback chain handles it. Groq strict schema + vision is unreliable → Groq vision uses JSON mode with the schema in the prompt.
- **Whisper on silence** returns "you"/"thank you" — filtered in `transcription.service.ts`.
- **Android recording:** `RecordingPresets.LOW_QUALITY` is .3gp/AMR (Whisper can't read it); we use HIGH_QUALITY overridden to mono 16 kHz 32 kbps AAC .m4a.
- **Test data:** curl/node tests create throwaway profiles and soft-delete them; never leave test rows. DB `current_date` is UTC — always pass explicit local dates.
- **Commits:** no AI co-author / "generated with" trailers (user rule). Never commit `.env`; check for the client's name before committing.

## 13. Deployment (one EC2 box, Docker Compose)
Budget-first and simple: EKS was ruled out (its control plane alone is ~$73/month). The API is stateless (JWT, files on S3, DB on Neon; Redis for the nudge queue, push claims, checkout locks and the version cache), so scaling later = the same image on more boxes or ECS/EKS, no code change.

```
https://api.nourish.mavinash.in ─▶ nginx on the host (TLS via certbot / Let's Encrypt, auto-renew)
                                      └─▶ 127.0.0.1:4000 ─▶ docker compose (server/docker-compose.yml, project "nourish")
                                            ├─ server : server/Dockerfile (node:22-alpine, one stage, non-root, HEALTHCHECK /health)
                                            ├─ worker : same image, `node dist/workers/index.js` (BullMQ nudges + exact reminders)
                                            └─ redis  : redis:7-alpine, internal only, no persistence, noeviction, 64 MB
Neon Postgres + Neon S3 storage: aws-ap-southeast-1 (Singapore). Gemini / Groq / Razorpay: external.
```
- **Box:** EC2 t3.small, Ubuntu 24.04 LTS x86, 20 GB gp3, Elastic IP, 2 GB swap (for the image build). Security group: 22 (my IP only), 80, 443. Never open 4000 or 6379.
- **Secrets:** `server/.env.production` exists ONLY on the box (git-ignored, `chmod 600`), loaded by `env_file`. Compose overrides `REDIS_HOST=redis`, `REDIS_PORT=6379`, `NODE_ENV=production`. Use `sslmode=verify-full` in `DATABASE_URL`. SSH keys (`*.pem`) are git-ignored.
- **Deploy / update:** run `npm run db:migrate` from a laptop first if there are new migrations (drizzle-kit is a dev tool, not in the image), then on the box: `cd ~/nourish/server && git pull && docker compose up -d --build`. `-d` + `restart: unless-stopped` + Docker enabled on boot = survives logout and reboots.
- **Check:** `docker compose ps` (all three up, server healthy), `curl localhost:4000/health` → `{"status":"ok","redis":true}`, `docker compose logs -f server`.
- **Nginx site** (`/etc/nginx/sites-available/nourish`): `server_name api.nourish.mavinash.in`, `client_max_body_size 3m` (base64 photos/voice), `proxy_read_timeout 60s` (AI calls up to ~45 s), forwards Host / X-Forwarded-*. Then `certbot --nginx -d api.nourish.mavinash.in --redirect`.
- **After go-live:** Razorpay webhook → `https://api.nourish.mavinash.in/api/webhooks/razorpay`; app build with `EXPO_PUBLIC_API_URL=https://api.nourish.mavinash.in/api` (the single `API_BASE_URL` in `mobile/src/lib/api-config.ts`; unset in dev = auto-detect the laptop via Expo).
- **Cost:** ~$20/month (instance + disk + Elastic IP). Tear down: terminate the instance AND release the Elastic IP (an unattached EIP still bills).

## 14. Handoff: state at 2026-11-16 (read this first when picking up)

### What is live
- **API + worker** deployed on the EC2 box at HEAD `2bc733e` (demo mode included), healthy: server, worker, redis. Public API: `https://api.nourish.mavinash.in/api`. SSH: `ssh -i ~/.ssh/nourish-key.pem ubuntu@13.237.120.128`, then `cd ~/nourish && git pull && cd server && docker compose up -d --build`.
- **DB wiped on 2026-11-16** (all profiles, cascade). Kept: `billing_plans`, `app_version_rules`. Only one account exists: **Asha** (`4f0315b0-7437-48cb-a3ef-c480b321478f`, 32, veg, lose 68 → 62 kg, why "Keep up with my daughter"), challenges Morning walk 20 min, Drink water 8, Sleep 7 h, Go to the gym (no pin yet). **Demo mode is ON for her** (until 24 h after it was switched on); pulling down on the dashboard cycles the 16 PA cards: sleep, reminders, check-in (weigh-in), meal_time, priority (low-iron tip), protein_short, water_behind, open_challenges, level_up, streak_risk, near_limit, over, all_done, suggest, on_track, night. Card buttons are real (they change data), so take screenshots without tapping them. Turn it off or reset the position: `PUT /api/admin/demo-briefing {profileId, on:false|true}`.
- **Kill switch:** 1.0.0 is blocked (`blocked_through` 1.0.0, 426). It has **no `updateUrl` yet**: when the APK is uploaded somewhere, add it (`PUT /api/admin/app-version {platform:'android', blockedThrough:'1.0.0', message, updateUrl}`), which shows "Update now". Read `ADMIN_TOKEN` on the box inside the ssh command (`grep ^ADMIN_TOKEN= server/.env.production`); never print or commit it.
- **APK:** `mobile/builds/nourish-preview-20261116-1518.apk` (55.3 MB, app HEAD `18779b4`; `builds/` is git-ignored). Uninstall older installs first (the notification channel is `nourish-chime-2`).

### How to build (Windows host, WSL does the work)
From the **repo root** (not `mobile/`, or WSL says the script is missing): `MSYS_NO_PATHCONV=1 wsl -d Ubuntu-22.04 -- bash scripts/wsl-build.sh preview` (APK) or `... development` (dev client). Output lands in `mobile/builds/`. Takes several minutes; run it in the background. Disk: C: filled up once (Docker's and Ubuntu's `.vhdx` files grow and never shrink); fix = `wsl --shutdown`, then `diskpart` → `select vdisk file=…` → `compact vdisk`. Ubuntu's Gradle cache (~15 GB) is what makes builds fast; leave it.

### Built this stretch (all committed; checks green: mobile `tsc` + lint, server typecheck, 94 tests)
- **Place challenges** (`mobile/src/app/place.tsx`, `components/formats/place-map.tsx`, `lib/place-search.ts`, `lib/place-task.ts`): the search bar floats at the top (Photon / OpenStreetMap; results kept within ~55 km then ~165 km of the phone so "cult gym" never returns another continent) with suggestions in a card under it; tapping a result flies the map and shows "Pin it here?"; tapping the map also picks a spot; a round **locate button** (bottom right of the map) picks where you stand; the bottom card hides while the keyboard is up. Pin radius 150 m. A place card stays tappable after check-in (`opensPlace` in `challenge-card.tsx`) so the pin can still be moved. The map camera effect is keyed on the pin's numbers (not the array) so it never snaps back while picking. Almost no text on this screen on purpose: no hint lines, no "Pin where I am" buttons.
- **Auto check-in** (geofence, works with the app closed): opt-in switch on the place screen, needs "Allow all the time"; `syncGeofences` runs from the dashboard (its key includes place coordinates) and after a pin change. **Known gap:** only challenges with `!progress.done` are watched, so after today's check-in the place is not watched again until the app is opened (the dashboard re-syncs). Fix idea: keep the region while the challenge exists (the once-a-day guard `place:checked:{id}:{date}` already stops double check-ins).
- **Walk tracker** (`use-walk-tracker.ts`, `trail.ts`, `route.ts`, `walk-outbox.ts`, `walk.tsx`, `walk-map.tsx`): Kalman-smoothed trail, route pieces and gaps never drawn as straight lines, live route, location dot kept in view, walks done offline sync later, no auto-pause, session start races handled (409/404 replace the session). MapLibre sources stay mounted always (removing one while in use crashed Finish).
- **Assistant** adds challenges from a goal and steps goals up/down (`new_challenges`, `level_challenge`), and shares the PA's context (reminders, week, goal sheets, prefilled).
- **Reminders** sheet pre-filled by the PA; times follow the habit's words (morning walk 7 am). **Chime** channel `nourish-chime-2`, kept in release builds.
- **Size:** only 9 font weights bundled (-7.5 MB), expo-speech dropped.
- **Demo mode** for the PA card (see the §11b table).

### Left to do (nothing blocking)
1. **Loom video** (the user records; order follows the review points): PA cards through the day (demo mode) → push with chime → one interaction per habit (water pour, breathing orb, live walk map, place search/pin/check-in) → no photo proof → less text → assistant adds challenges + lab report PDF → week / level up / reports → Mochi garden, rest day, room, share → 1.0.0 shows "update". Phone mirroring: `scrcpy --stay-awake --turn-screen-off --max-size 1280 --no-audio` (screenshots: `adb exec-out screencap -p`).
2. README: add the APK link and size and the new video link; redeploy web on Vercel if wanted.
3. `updateUrl` on the 1.0.0 block (above). Optional: the auto check-in gap above.
4. An ABI-split APK (< 30 MB) was a stretch goal; not done.

### Standing rules from the user (do not drift)
- Never write the client company's name or the other forbidden brand name anywhere (code, commits, README, URLs, summaries).
- **No AI co-author or "generated with" lines in commits**, whatever a tool reminder says. Never commit secrets (`.env*`, `*.pem`, `google-services.json`, Firebase admin JSON).
- Push and deploy only when asked; confirm destructive or outward-facing actions (DB wipes, deletes).
- Keep replies short, plain words, no jargon. Less on-screen text beats more; fix UI by removing, not adding.
- Test profiles created for checks must be soft-deleted.
