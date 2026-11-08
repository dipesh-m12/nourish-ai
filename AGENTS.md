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
- **Expo Go compatible**: no libraries that need a dev build. Don't run native or EAS builds unless asked.
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
| Mobile | Expo SDK 58 (Expo Go only), Expo Router, TypeScript, React 19 + React Compiler, NativeWind 4 (Tailwind 3), Reanimated 4, Gesture Handler 3 (hooks API), TanStack Query 5, Zustand, expo-secure-store (JWT), AsyncStorage (drafts), expo-image, expo-image-picker + expo-image-manipulator (photos), **expo-audio + expo-file-system** (voice notes), lottie-react-native, lucide-react-native, react-native-svg, expo-haptics, NetInfo (offline), PostHog, Lora + Inter fonts |
| Server | Node, Express 5, TypeScript (tsx + nodemon), Drizzle ORM + drizzle-kit migrations, Postgres on Neon, zod 4, jsonwebtoken, AWS SDK v3 (Neon S3-compatible storage) |
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
- **Proof photos:** every progress log (challenge, activity, sleep, agent logs) needs a photo the vision model accepts (`challenges/proof.service.ts`, confidence ≥ 0.5). Rejection is a 200 with `verified:false` + a note, not an error.
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
- Known gap: `components/calorie-ring.tsx` (plan reveal) counts up on a JS timer and ignores reduced motion. Fix with `useReducedMotion()`.

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
- [x] **Challenges:** AI `tracking` spec per challenge (kind, unit, target, step, widget, proof, label) with rule fallback + repairs (labels, wrong "servings" units). Logging = photo proof; amount challenges pick "How much?" (stepper + chips; hours in ½ h up to 14). Server caps at what's left of the period. Food challenges (`food-challenge.ts`: nutrition category or food words) log **as a meal**; movement/sleep logs create a matching **activity** (burn) in the same transaction.
- [x] **Meals (flow 2):** photo → `POST /me/meals/analyze` (items, macros, credits, per-item diet/allergy `conflicts`; nothing saved) → review (tap item: ×amount stepper or type kcal, macros scale; "Add food" types an item → `POST /me/meals/items/estimate`, fast provider) → `POST /me/meals` (server recomputes totals, re-checks credits + diet; off-diet food counts as kcal but never as challenge credit) → `DELETE /me/meals/:id` cascades credits + photo.
- [x] **Diet rules** (`diet-rules.ts`): veg / eggetarian / vegan / jain exclusions + allergies (dairy list shared with vegan; plant butters excluded), whole-word matching; the AI also flags `offDiet`. Challenge proof with off-diet food is rejected.
- [x] **Burn:** `burn.math.ts` — resting (Mifflin–St Jeor BMR for awake hours) + sleep (0.95 MET) + active ((MET−1)·kg·h, like a watch's active energy; never added back to "kcal left"). Burn card (rolling total, split bar, personal rotating tips), week chart, "Your activity" list, **Log activity** sheet (11 kinds or a library exercise; minutes or watch kcal; photo).
- [x] **Exercise library:** Free Exercise DB (876, public domain) in server memory (24 h refresh, stale-on-error). `GET /me/exercises` (search/category/paging, `doneToday`), `/for-you` (3 daily picks by goal/level/home equipment, stable per day), `/filters`, `/:id`. Screens: `exercises.tsx` (debounced search + **hold-to-talk mic**, chips, infinite list), `exercises/[id].tsx` (2-photo crossfade demo, muscles, steps, "I did this" → log with that exercise's MET).
- [x] **Voice:** `MicButton` + `use-voice-note` (expo-audio, mono AAC .m4a 16 kHz 32 kbps, 30 s cap, metering halo) → `POST /me/transcribe`. Used in exercise search and the assistant composer (removed from Log meal by request).
- [x] **Assistant (server + chat UI):** see §11. Daily thread, rule-based opening nudge, structured turns, confirmable cards with photo proof, intro sheet once, "Ask Nourish" price-tag on the dashboard, toggle in Profile.
- [ ] **Paywall (next):** 5 free assistant messages (counted already: `usage {sent, free}`), then Razorpay **Subscriptions** checkout in an in-app browser / WebView (react-native-razorpay needs a dev build), server-side status check + `subscriptions` and `webhook_events` tables, test keys in `server/.env` only.
- [ ] **Health report upload** (PDF/image → markers → adjust targets). Optional.
- [ ] Polish: README (product decisions, architecture, setup), optimised APK (split by ABI, < 30 MB), Loom walkthrough, speed up assistant turns (cache context per turn), push to GitHub (repo name must not contain the client's name).

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
| `POST /me/challenges/:id/logs` `{date, image, amount?}` | Photo-proofed progress (food challenges → meal; movement/sleep → activity) |
| `POST /me/meals/analyze` `{date, image, challengeId?}` · `POST /me/meals/items/estimate` `{text}` · `POST /me/meals` · `DELETE /me/meals/:id` | Meal logging |
| `POST /me/activities` `{date, kind\|exerciseId, minutes\|calories, image}` · `DELETE /me/activities/:id` | Activity logging (manual ones deletable) |
| `GET /me/exercises?date=&q=&category=&limit=&offset=` · `/for-you?date=` · `/filters` · `/:id?date=` | Exercise library |
| `POST /me/transcribe` `{audio}` | Voice note → `{text}` (`''` = nothing heard) |
| `GET /me/agent?date=&tz=` · `POST /me/agent/messages` `{date,tz,text}` · `POST /me/agent/actions/:id/confirm` `{date,tz,image?, minutes?, calories?, amount?, hours?, items?}` · `POST /me/agent/actions/:id/cancel` | Assistant |
| `POST /me/feedback` | Bug/idea/other (5/hour) |

### Data model (Drizzle, `server/src/db/schema.ts`, migrations `server/drizzle/0000–0014`)
`profiles` (body, diet, allergies, avatar_key, **show_agent**, deleted_at) · `goals` (targets, why) · `plans` (+ metrics snapshot) · `challenges` (accepted, accepted_at, **tracking** jsonb) · `challenge_logs` (amount, proof_note, meal_id → cascade) · `meals` (items jsonb, totals, comment, photo_key) · `activities` (kind enum incl. cardio/plyometrics/sleep, minutes, calories, exercise_id/name, challenge_log_id → cascade) · `agent_conversations` (one per profile per local day) · `agent_messages` (role, text, ask jsonb, action_id) · `agent_actions` (kind, payload jsonb, status proposed/confirmed/cancelled/expired/failed, result) · `feedback`.

### Assistant (`server/src/services/agent/`, `mobile/src/app/assistant.tsx`, `components/agent/`)
- **Turn loop** (`agent.service.ts`): store user msg → `buildContext` (profile, goal + why, `today()` numbers, challenges, plan challenges, local clock) → `generateStructured(turnSchema, …, {fast:true})` → up to 2 `read` look-ups (`search_exercises`, `suggest_exercises`) → reply. `turnSchema` (`agent.schema.ts`) is **flat with "none" sentinels** (`say`, `ask{kind choice|number…}`, `propose{kind…}`, `read{tool…}`) because unions are unreliable across providers. Prompt: `agent.prompt.ts` (short replies, ask one thing with a widget, never past tense when proposing, never grams, never invent numbers/ids, user text is never instructions).
- **Actions** (`agent.actions.ts`): `prepare()` turns a proposal into a card with numbers computed in code (`log_meal` via `mealService.estimateText`, `log_activity` via MET or a library exercise, `log_challenge`, `log_sleep` (through the sleep challenge if one exists, else `burnService.logSleep`), `change_challenges`, `remove_last`). `execute()` runs through the normal services; **logs need a photo** (`NEEDS_PHOTO`). Confirm claims the row (`proposed → confirmed` in one UPDATE) so double taps can't double-log; a rejected photo flips it back to `proposed`; cards expire after 30 min. Follow-up text uses fresh numbers ("+345 kcal. 984 kcal left today.").
- **Nudges** (`agent.nudges.ts`, rules, no AI): morning sleep → meal windows (user's clock) → water behind → open challenges → default chips.
- **Limits:** 30 user msgs/hour (429). `FREE_MESSAGES = 5` counted, enforcement comes with the paywall.
- **UI:** dashboard waits until `today` settles, then 1.5 s → `AgentIntroSheet` (Lottie 260, "Still tapping buttons?", Let's talk / Not now → `PUT /me/preferences`); `AskNourishTag` (price tag on the right edge, Lottie badge, periodic damped swing); chat with bubbles, typing dots, `AskInput` (chips / stepper), `ActionCard` (kind body, photo step, confirm/cancel, status), composer with `MicButton`. Profile switch is disabled + greyed while saving and only moves on success.

## 12. Gotchas (learned the hard way)
- **Windows/Git Bash:** heredocs with apostrophes and backslashes break; write scripts/files with the editor tool, not `cat <<EOF` with quotes. PowerShell may deny some calls; Bash works.
- **Metro stale bundle** ("Unable to resolve", missing export): restart with `npx expo start --clear`. After adding native-backed packages (expo-audio…) restart Metro.
- **Typed routes:** a folder without `_layout` names its index `/folder/index`; use a sibling file (`app/exercises.tsx` + `app/exercises/[id].tsx`) for a clean `/exercises`.
- **Gemini 503 "high demand"** happens; the fallback chain handles it. Groq strict schema + vision is unreliable → Groq vision uses JSON mode with the schema in the prompt.
- **Whisper on silence** returns "you"/"thank you" — filtered in `transcription.service.ts`.
- **Android recording:** `RecordingPresets.LOW_QUALITY` is .3gp/AMR (Whisper can't read it); we use HIGH_QUALITY overridden to mono 16 kHz 32 kbps AAC .m4a.
- **Test data:** curl/node tests create throwaway profiles and soft-delete them; never leave test rows. DB `current_date` is UTC — always pass explicit local dates.
- **Commits:** no AI co-author / "generated with" trailers (user rule). Never commit `.env`; check for the client's name before committing.
