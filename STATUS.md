# Where's My Yota? — Project Status
_Last updated: 2026-06-10_

## What This Is
A free community tool that lets Toyota buyers paste their dealer VSpec URL and get email notifications when their order status changes. No account needed. Live at `https://where-is-my-toyota.vercel.app`.

---

## Stack
- **Next.js 16** (App Router) + TypeScript + Tailwind — `/Users/john.tabone/dev/where-is-my-toyota`
- **Upstash Redis** — stores tracked vehicles + the cached WAF token
- **Resend** — sends notification + welcome emails from a verified domain
- **Vercel Hobby** — hosting + daily cron (`0 12 * * *` = noon UTC)
- **GitHub Actions** — solves the Toyota AWS WAF challenge and refreshes the cached token (see below)
- **Vercel Analytics** — pageview tracking (`<Analytics />` in layout)

---

## How the Toyota API Works (critical context)

The dealer VSpec URL format:
```
https://guest.dealer.toyota.com/v-spec/{dealerId}/{VIN}/detail?k={hash}
```
The app fetches the underlying API endpoint:
```
https://api.rti.toyota.com/marketplace-inventory/vehicles/{dealerId}/{VIN}/hash/{hash}/vspec
```

**AWS WAF challenge (the key reliability concern):**
Toyota's API sits behind AWS WAF, which blocks plain `fetch()`. We do NOT solve the
challenge at request time. Instead:
1. A **GitHub Action** (`.github/workflows/refresh-waf-token.yml`) runs a stealth
   headless Chromium (playwright-extra + puppeteer-extra-plugin-stealth) under
   `scripts/waf-solver/solve.mjs`, solves the WAF challenge, and caches the resulting
   token(s) in Redis under key **`waf:vspec`** as `{ wafToken, uiToken, ts }`.
2. The Next.js app just replays a plain `fetch()` using the cached token — no browser
   at request time.

**Refresher reliability design — OVERLAPPING long-lived runs:**
GitHub's scheduled cron has a 5-min minimum and is frequently delayed 30–90+ min. The
old short-loop/relaunch setup left a gap where the token's TTL expired before the next
run started → "No WAF token cached" production error. Current fix:
- Each run loops ~5.5h (`LOOP_MINUTES: 330`), refreshing every `REFRESH_INTERVAL: 240`s.
- A new run is scheduled every 4h (`cron: '0 */4 * * *'`).
- Because the loop (5.5h) > schedule interval (4h), consecutive runs **overlap ~90 min**.
- **No concurrency group on purpose** — the overlap is what closes the gap.
- Token Redis TTL is `TOKEN_TTL_SECONDS: 1200` (20 min) to cushion brief gaps.

**Healthcheck (defense in depth):** `.github/workflows/healthcheck.yml` curls `/api/status`
every 30 min and fails the job (→ GitHub failure email to admins) if the token is missing
or stale. It only alerts; the refresher is what fixes.

---

## Key Files

| File | Purpose |
|---|---|
| `lib/toyota.ts` | URL parser, API client (fetchVSpec), snapshot/diff logic, `CATEGORY_LABELS` |
| `lib/db.ts` | Upstash Redis — save/get/update tracked vehicles (+ `getTracking`) |
| `lib/email.ts` | Resend HTML emails — `getFrom()`, `sendWelcomeEmail`, `sendStatusChangeEmail` |
| `lib/ratelimit.ts` | Upstash rate limiting (lookups/hr, signups/day per IP) |
| `app/api/vspec/route.ts` | GET proxy — parses URL, fetches Toyota API via cached token |
| `app/api/track/route.ts` | POST — saves vehicle + email; dedup-aware welcome logic |
| `app/api/cron/route.ts` | GET (cron) — polls all tracked vehicles, emails on any change |
| `app/api/status/route.ts` | GET — health check: reads `waf:vspec`, reports token age/health |
| `app/api/test-email/route.ts` | GET (gated by `CRON_SECRET`, `?to=`) — sends a sample email |
| `app/page.tsx` | Main UI — lookup form, status card, integrated notify form |
| `app/layout.tsx` | Root layout with Vercel Analytics |
| `scripts/waf-solver/solve.mjs` | Stealth Chromium WAF solver run by GitHub Actions |
| `.github/workflows/refresh-waf-token.yml` | Overlapping 5.5h refresher (every 4h) |
| `.github/workflows/healthcheck.yml` | 30-min ping of `/api/status`, alerts on failure |
| `vercel.json` | Daily cron config |

---

## Data Model

```typescript
interface TrackedVehicle {
  vin: string
  dealerId: string
  hash: string
  email: string
  nickname: string
  lastSnapshot: VehicleSnapshot  // { dealerCategory, etaFrom, etaTo, holdStatus, isAvailableForAppointment }
  lastChecked: number
  welcomed?: boolean   // one-time welcome email sent? (undefined on legacy records)
  createdAt?: number   // first registration time (optional on legacy records)
}
```

**Redis keys:**
- `track:{email}:{vin}` → TrackedVehicle JSON
- `tracks:all` → Set of all track keys
- `waf:vspec` → `{ wafToken, uiToken, ts }` (refreshed by GitHub Action)

---

## Signup / Email Behavior (dedup-aware, current)
`app/api/track/route.ts` on submit:
- Looks up any existing `email+VIN` record via `getTracking`.
- **Welcome once:** sends `sendWelcomeEmail` only if no record exists OR the existing
  record is not yet `welcomed` (legacy records pre-date the feature → they get one
  catch-up welcome). Already-welcomed users are never re-emailed.
- **No double alerts:** on re-signup it **preserves the stored `lastSnapshot`** as the
  alert baseline instead of re-fetching/overwriting — this closes a window where a
  pending status change could have been silently dropped. Nickname can still be updated.
- Returns `alreadyTracking` so the UI shows "You're already tracking this 👍" instead of
  a fresh confirmation.

Alerts themselves are only sent by `app/api/cron/route.ts`, which diffs the stored
`lastSnapshot` vs a fresh fetch and emails + advances the baseline on any diff.

---

## What's Tracked & Diffed
Every daily cron poll diffs these fields and emails if anything changed:
- `dealerCategory` — A (Allocated) → F (In Transit) → G (At Dealer)
- `eta.currFromDate` / `eta.currToDate` — ETA window shifts
- `holdStatus` — e.g. DealerHold → released
- `isAvailableForAppointment` — flips true when ready for pickup

---

## UI Notes (app/page.tsx)
- `VehicleCard` header: green bar, "It's here!" / "Reserved" pills (now `whitespace-nowrap`
  so they don't wrap to two lines).
- `StatusProgress`: 3 stages (Allocated → In Transit → At Dealer). The **final stage,
  when reached, renders solid green** (not the hollow in-progress ring) with a bright
  `zinc-100` label — so "arrived" reads as celebratory, not pending.
- Exterior/Interior photo toggle; pricing card; full-details `<details>` with exterior +
  interior color codes aligned, VIN, specs, standard equipment, raw JSON.
- `TrackForm` is integrated into the card (not a detached panel) — "🔔 Get status updates".
- `/` reads `?url=` on mount and auto-runs; successful lookup writes it back via
  `history.replaceState`. Kept static (no `useSearchParams`) so `/` stays prerendered.

---

## Branding
- Name: **Where's My Yota?**
- Color: `#2D6A4F` (forest green) — replaces all Toyota red
- Footer: "Not affiliated with Toyota. Built by Yota owners, for Yota owners."
- No Toyota trademark anywhere

---

## Env Vars
**Vercel (app):**
```
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
RESEND_API_KEY
EMAIL_FROM        # "Name <addr@verified-domain>" — must be a Resend-verified domain
CRON_SECRET       # Bearer token protecting /api/cron + /api/test-email
```
**GitHub Actions secrets (WAF solver):**
```
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
SEED_VSPEC_URL    # a known-good VSpec URL the solver warms against
```
Note: `onboarding@resend.dev` is TEST-ONLY (can only deliver to your own Resend account
email). Keep `EMAIL_FROM` on a verified domain so existing users keep getting alerts.

---

## Known Issues / Next Steps
- Pricing is surfaced; could still add unsubscribe link to emails (footer is placeholder).
- SMS/text alerts were scoped and shelved — main lift is A2P 10DLC registration + TCPA
  opt-in (STOP/HELP), not the code. Revisit only if requested.
- `.claude/settings.local.json` is tracked by git but is local-only config; consider
  `git rm --cached` + gitignore to stop it showing as a perpetual change.
- Legacy `lastSnapshot` migration: very old records may predate the snapshot schema; the
  dedup logic preserves whatever baseline exists, but anyone with a pre-refactor record
  may need to re-submit.

---

## Vercel Deployment
```bash
git push  # auto-deploys via GitHub integration
npx vercel --prod  # manual prod deploy
npx vercel alias ls  # see clean URL aliases
```
Clean URL: `https://where-is-my-toyota.vercel.app`

---

## Test Vehicle
- **2026 Grand Highlander Hybrid MAX Platinum** — Heavy Metal / Portobello Leather
- VIN: `5TDADAB5XTS046993` | Dealer: `20122` (Tufankjian Toyota of Braintree)
- VSpec URL: `https://guest.dealer.toyota.com/v-spec/20122/5TDADAB5XTS046993/detail?k=7552d8c58793e4a865452744d29b184d97d7b95ee399d1ad6b0ecf3ddeda8364`
- Status as of 2026-06-10: **G (At Dealer)** — arrived.
