# Where's My Yota? — Project Status
_Last updated: 2026-06-03_

## What This Is
A free community tool that lets Toyota buyers paste their dealer VSpec URL and get email notifications when their order status changes. No account needed. Live at `https://where-is-my-toyota.vercel.app`.

---

## Stack
- **Next.js 16** (App Router) + TypeScript + Tailwind — `/Users/john.tabone/dev/where-is-my-toyota`
- **Upstash Redis** — stores tracked vehicles
- **Resend** — sends notification emails from user's verified domain
- **Vercel Hobby** — hosting + daily cron (`0 12 * * *` = noon UTC)
- **Vercel Analytics** — pageview tracking (installed, `<Analytics />` in layout)

---

## How the Toyota API Works (critical context)

The dealer VSpec URL format:
```
https://guest.dealer.toyota.com/v-spec/{dealerId}/{VIN}/detail?k={hash}
```

**Two-step auth (fully working, no user action needed):**
1. Hit `https://api.rti.toyota.com/token-service/public?tokenName=vspec` — returns `{ tokenDetails: { ui: "...", dis: "..." } }` with no auth required
2. Use `tokenDetails.ui` as `x-api-key` header to call the vspec endpoint:
   `https://api.rti.toyota.com/marketplace-inventory/vehicles/{dealerId}/{VIN}/hash/{hash}/vspec?includeMediaSource=PORT`

The `hash` is stored in Redis at track time — polling works even if the dealer's VSpec link goes down.

---

## Key Files

| File | Purpose |
|---|---|
| `lib/toyota.ts` | URL parser, API client (getApiKey + fetchVSpec), snapshot/diff logic |
| `lib/db.ts` | Upstash Redis — save/get/update tracked vehicles |
| `lib/email.ts` | Resend HTML email showing before/after diffs |
| `lib/ratelimit.ts` | Upstash rate limiting (10 lookups/hr, 3 signups/day per IP) |
| `app/api/vspec/route.ts` | GET proxy — parses URL, fetches Toyota API |
| `app/api/track/route.ts` | POST — saves vehicle + email to Redis |
| `app/api/cron/route.ts` | GET (cron) — polls all tracked vehicles, emails on any change |
| `app/page.tsx` | Main UI — lookup form, status card, notify form |
| `app/layout.tsx` | Root layout with Vercel Analytics |
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
}
```

**Redis keys:**
- `track:{email}:{vin}` → TrackedVehicle JSON
- `tracks:all` → Set of all keys

---

## What's Tracked & Diffed
Every daily cron poll diffs these fields and emails if anything changed:
- `dealerCategory` — A (Allocated) → F (In Transit) → G (At Dealer)
- `eta.currFromDate` / `eta.currToDate` — ETA window shifts
- `holdStatus` — e.g. DealerHold → released
- `isAvailableForAppointment` — flips true when ready for pickup

---

## Branding
- Name: **Where's My Yota?**
- Color: `#2D6A4F` (forest green) — replaces all Toyota red
- Footer: "Not affiliated with Toyota. Built by Yota owners, for Yota owners."
- No Toyota trademark anywhere

---

## Env Vars (all set in Vercel)
```
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
RESEND_API_KEY
EMAIL_FROM        # noreply@<verified-domain>
CRON_SECRET       # Bearer token protecting /api/cron
```

---

## Known Issues / Next Steps
- **BUG (needs fix next session)** — user mentioned a bug when starting this session, details TBD
- Pricing breakdown (`baseMsrp`, `optTotalMsrp`, `dph`, `totalMsrp`) is in the API response but not yet surfaced in the UI — Reddit user suggested showing it
- Could add unsubscribe link to emails (footer has placeholder text but no implementation)
- The `lastSnapshot` schema migration: anyone who signed up before the snapshot refactor has an old `lastCategory` string record — they need to re-submit to get the new format. This is communicated in the app.

---

## Vercel Deployment
```bash
git push  # auto-deploys via GitHub integration
npx vercel --prod  # manual prod deploy
npx vercel alias ls  # see clean URL aliases
```
Clean URL: `https://where-is-my-toyota.vercel.app`

---

## Test Vehicle (yours)
- **2026 Grand Highlander Hybrid MAX Platinum** — Heavy Metal / Portobello Leather
- VIN: `5TDADAB5XTS046993` | Dealer: `20122` (Tufankjian Toyota of Braintree)
- VSpec URL: `https://guest.dealer.toyota.com/v-spec/20122/5TDADAB5XTS046993/detail?k=7552d8c58793e4a865452744d29b184d97d7b95ee399d1ad6b0ecf3ddeda8364`
- Status as of 2026-06-03: **F (In Transit)**, ETA June 4–9
