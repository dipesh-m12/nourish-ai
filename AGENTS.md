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
| Mobile | Expo SDK 58, Expo Router, TypeScript, NativeWind 4 (Tailwind 3), Reanimated 4, TanStack Query, Zustand, expo-secure-store (JWT), AsyncStorage (drafts), lucide-react-native, react-native-svg, expo-haptics, Lora + Inter fonts |
| Server | Node, Express 5, TypeScript (tsx + nodemon), Drizzle ORM, Postgres on Neon, zod, jsonwebtoken |
| AI | **Gemini** `gemini-3.5-flash` (primary, thinking low, ~6–9 s) → **Groq** `openai/gpt-oss-120b` (fallback, ~2.5 s) → built-in **template**. REST via `fetch`, keys in `server/.env` |

## 5. Layout & commands
```
mobile/   Expo app      → npx expo start --clear   (lint: npx expo lint, types: npx tsc --noEmit)
server/   Express API   → npm run dev              (types: npm run typecheck)
          DB            → npm run db:generate && npm run db:migrate   (schema: src/db/schema.ts)
```
Before saying a task is done, run **lint + typecheck** in each app you touched, and curl-test any new endpoints.

## 6. Architecture conventions
**Server** (`server/src`): `routes → controllers → services → db`
- `routes/*.routes.ts`: paths + middleware (`validateBody(zodSchema)`, `validateUuidParam`).
- `controllers/*`: HTTP in and out only. Express 5 forwards async errors automatically.
- `services/*`: business logic and DB access. Pure maths lives in its own service (e.g. `nutrition.service.ts`).
- `validators/*`: zod schemas plus their inferred types.
- Errors: throw `AppError` and let `middlewares/error-handler.ts` respond with `{ error: { message, details } }`.
- Multi-table writes go in `db.transaction`. All endpoints live under `/api`.
- **Auth (JWT, no passwords):** `POST /auth/signup {name}` and `POST /auth/session {profileId}` return `{ profile, token }`. The token is HS256 with `sub = profileId`, expires per `JWT_EXPIRES_IN` (30d), and is signed with `JWT_SECRET`.
- `middlewares/auth.ts` (`requireAuth`) checks the Bearer token, confirms the profile still exists, and sets **`req.profileId`**. Never put it in `req.body`. Handlers read it via `authedProfileId(req)`.
- **AI layer** (`services/ai/`): `LlmProvider` interface with `GeminiProvider` and `GroqProvider`. `generateStructured(zodSchema, prompt)` turns the zod schema into a JSON Schema the provider must follow, strips code fences, validates with zod, and falls through providers on timeout (15 s), error or invalid shape. Callers decide the final fallback (plans use `plan.template.ts`, which is allergen-checked).
- **File storage:** Neon S3-compatible storage, private bucket `nourish-ai` (`services/storage.service.ts`). The DB stores object **keys** only (e.g. `profiles.avatar_key`); responses carry a 1-hour **signed URL** plus the key. The app caches images by key (`expo-image` `cacheKey`), since the URL changes per request. Uploads are validated by magic bytes. Replacing or removing a file deletes the old object. Endpoints: `PUT|DELETE /api/me/avatar`.
- **Soft delete:** `profiles.deleted_at`. Every profile read filters `deleted_at is null` (`active` in `profile.service.ts`), so a deleted account vanishes from the list, sign-in, `/me` and auth (old tokens → 401). The unique-name index is partial (active rows only), so the name becomes free again.
- **Rule:** numbers (calories, macros, BMI on the standard WHO scale (18.5 / 25 / 30; app shows obesity classes I–III), weeks to goal) are computed in code (`nutrition.service.ts`, `metrics.service.ts`). AI only writes the personal text and suggestions.
- Public: `/api/auth/*`, `GET /api/profiles` (picker). Everything personal lives under **`/api/me/*`** behind `requireAuth`, with no ids in URLs. `GET /api/me` doubles as the "is my token still valid" check.

**Mobile** (`mobile/src`)
- `app/`: screens only (Expo Router). `components/ui/`: design-system primitives (Button, Text/Heading, OptionCard, Chip, NumberField, SegmentedControl, PressableScale, ImageSlot).
- `api/*.ts`: TanStack Query hooks per resource. `lib/api-client.ts`: fetch wrapper; the API URL is auto-detected from the Expo host IP, or set by `EXPO_PUBLIC_API_URL`.
- **State:** Zustand for app state, TanStack Query for server data. `store/session.ts` holds the JWT: SecureStore on disk (`lib/token-storage.ts`), mirrored in memory. `store/onboarding.ts` holds the draft answers, persisted in AsyncStorage.
- **Session lifecycle:** on launch, hydrate the token from SecureStore. If there is one, go to the dashboard, which calls `GET /me` to validate it. `lib/api-client.ts` attaches `Authorization: Bearer` to every request, and **any 401 calls `signOut()`**, which clears the token and the cached `me`, so the app redirects to the picker.
- `types/`: mirrors API responses. `constants/`: option lists and colours. `utils/`: pure helpers.
- Styling: NativeWind `className`. Colours used in JS (icons, SVG) come from `constants/colors.ts`, which must stay in sync with `tailwind.config.js`.
- Animations: Reanimated, using `.set()` / `.get()` on shared values (React Compiler is on). Use entering animations (`FadeInDown.delay(i*80)`) for staggered lists.
- Accessibility: every pressable needs a role and label. Text contrast must be at least 4.5:1.

## 7. Design system
Source: **ui-ux-pro-max** `--design-system` (query: "health nutrition assistant mobile app calm friendly light wellness", motion 6, density 4), plus a `--stack react-native` query. What was adopted and what was overridden:

| From the skill (adopted) | Overridden, and why |
|---|---|
| Organic/calm style; **Lora** headings; breathing loader; staggered entrance 300–450 ms; contrast ≥ 4.5:1; Lucide icons, no emoji; respect reduced motion; UI-thread animations; a11y labels; controlled inputs | Red/blue palette → sage + coral (red reads as alarm in health). Raleway body → **Inter** (uneven numerals hurt a calorie app). "Enterprise Gateway" web pattern → ignored. `back.out` easing → ease-out cubic |

- Colours: bg `#F7F6F2` · card `#FFF` · ink `#1C2321` · muted `#5B6660` · line `#E7E4DC` · primary `#1F7A55` (soft `#E6F2EB`) · accent coral `#E07A5F` (soft `#FBEDE8`) · danger `#B42318`.
- Patterns (own choices): big tappable cards, one question per screen, a sticky bottom CTA, haptics on selection and success, a press scales to 0.97, rounded-2xl surfaces.
- Planned, not built yet: bottom sheets instead of modals (an assignment rule). Needs `@gorhom/bottom-sheet`, which works in Expo Go.
- Known gap: the calorie-ring count-up (`components/calorie-ring.tsx`) runs on a JS timer and ignores reduced motion. Fix with `useReducedMotion()`.

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
| ui-ux-pro-max | github.com/nextlevelbuilder/ui-ux-pro-max-skill | Design system, palettes, UX rules (`scripts/search.py "<query>" --design-system`) | **Yes**, see §7 |
| expo | github.com/expo/skills | Router, native UI, animation, EAS | No. Consult for flow 2 (camera, audio) |
| building-react-native-apps | github.com/callstackincubator/agent-skills | RN performance, navigation | No |
| testing-react-native-apps | github.com/callstackincubator/agent-skills | Tests | No |
| react-native-skills | `.claude/skills/react-native-skills` (vercel-labs) | Lists (FlashList), animations, rendering | No. Consult for the meal list |

Rule: before building a feature, open the relevant skill and note in the PR or commit which guidance was applied.

## 10. Status & roadmap
- [x] **Flow 1**: profile picker / new profile → 6-step onboarding (about, body, activity, food, goal, why) → plan reveal → basic dashboard. API: `GET /api/profiles`, `GET /api/profiles/name-availability`, `POST /api/auth/signup`, `POST /api/auth/session`, `GET /api/me`, `DELETE /api/me` (soft delete), `POST /api/me/onboarding`, `POST|GET /api/me/plan`, `PUT /api/me/challenges`, `POST /api/me/feedback` (bug/idea/other + device context, max 5/hour), `GET /api/me/today?date=`, `POST /api/me/challenges/:id/logs` (photo proof). Names are unique, ignoring case (409).
- [x] **AI plan:** after onboarding, a waiting screen (steps + rotating tips), then the reveal: encouragement, journey card (now → goal, ~weeks, BMI), an opt-in BMI scale after the confetti, calorie ring + macros, summary + why, 3 focus habits, a sample Indian day, and 6 challenges the user ticks (stored with `accepted`).
- [x] **Flow 2 (photo): log a meal.** The camera on the calorie card, or "+" on a nutrition challenge, opens one meal sheet: photo → AI reads items + macros (`POST /api/me/meals/analyze`, nothing saved) → user strikes out wrong items → `POST /api/me/meals` saves the meal and its challenge credits in one transaction. Calories are always 4/4/9 from macros in code; credits are re-checked against accepted nutrition/hydration challenges and capped to the target; protein-in-grams challenges get the meal's computed protein. `DELETE /api/me/meals/:id` removes the meal, its credits (FK cascade) and photo. `GET /me/today` returns `eaten` + `meals`. Not food → explanation + retry. **Voice:** hold-to-talk (`expo-audio`, mono AAC .m4a) → `POST /api/me/meals/voice` → Groq `whisper-large-v3-turbo` (Gemini audio fallback; Whisper silence phrases filtered) → the same estimate as a photo, transcript shown. Items are editable (×amount, typed kcal) and missed foods can be typed (`POST /me/meals/items/estimate`).
- [x] **Dashboard v1:** calorie card (kcal left, ring, macros ×4/×9), today’s challenges in a 2-column grid. Each challenge has an AI-chosen `tracking` spec (kind, unit, target, tap step, widget ring/bars/tally/check, proof hint) stored on the row, with a rule-based fallback. Progress is a tap + photo; Gemini verifies the photo before a `challenge_logs` row counts. Streaks + 7-day history. Draggable sheet (own, Gesture Handler v3 `usePanGesture`) to pick challenges.
- [ ] **Flow 3: Proactive home.** A daily briefing ("You're 400 kcal under; add protein at dinner"), streaks and progress toward the goal and the why.
- [ ] **Flow 4: Health report upload** (PDF or image). Extract markers, flag out-of-range values, link them to the goal and adjust targets.
- [ ] Polish: app icon and splash, README (product decisions, architecture, setup), optimised APK (split by ABI, under 30 MB), Loom walkthrough.
