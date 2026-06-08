// Solves the AWS WAF challenge on guest.dealer.toyota.com using a stealth
// headless browser, then caches the resulting `aws-waf-token` cookie and the
// vspec `ui` API key in Redis so the Next.js app can replay cheap fetch() calls.
//
// Runs in GitHub Actions on a schedule — NOT part of the Vercel deployment.
//
// Required env:
//   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
// Optional env:
//   SEED_VSPEC_URL  — any valid guest.dealer.toyota.com v-spec link (token is
//                     dealer/VIN-agnostic, so any working link mints a usable token)
//   TOKEN_TTL_SECONDS — Redis expiry for the cached token (default 600)

import { chromium } from 'playwright-extra'
import stealth from 'puppeteer-extra-plugin-stealth'

chromium.use(stealth())

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const SEED_VSPEC_URL =
  process.env.SEED_VSPEC_URL ||
  'https://guest.dealer.toyota.com/v-spec/20122/5TDADAB5XTS046993/detail?k=7552d8c58793e4a865452744d29b184d97d7b95ee399d1ad6b0ecf3ddeda8364'

const REDIS_KEY = 'waf:vspec'
const TTL = Number(process.env.TOKEN_TTL_SECONDS || 600)

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
if (!REDIS_URL || !REDIS_TOKEN) {
  console.error('Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN')
  process.exit(1)
}

async function redisSet(key, value, ttl) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['SET', key, value, 'EX', String(ttl)]),
  })
  if (!res.ok) throw new Error(`Redis SET failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function main() {
  console.log(`[solve] launching stealth chromium, seed=${SEED_VSPEC_URL}`)
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const ctx = await browser.newContext({ userAgent: UA })
    const page = await ctx.newPage()

    let uiToken = null
    page.on('response', async (res) => {
      const url = res.url()
      if (url.includes('token-service') && url.includes('vspec')) {
        try {
          uiToken = (await res.json())?.tokenDetails?.ui ?? uiToken
        } catch {}
      }
    })

    await page
      .goto(SEED_VSPEC_URL, { waitUntil: 'networkidle', timeout: 60000 })
      .catch((e) => console.log('[solve] nav warning:', e.message))

    // Let the WAF challenge + token-service round-trips settle.
    await page.waitForTimeout(6000)

    const cookies = await ctx.cookies()
    const wafToken = cookies.find((c) => c.name === 'aws-waf-token')?.value || null

    if (!wafToken || !uiToken) {
      throw new Error(
        `solve incomplete — wafToken=${!!wafToken} uiToken=${!!uiToken} (WAF may have blocked headless)`
      )
    }

    const payload = JSON.stringify({ wafToken, uiToken, ts: Date.now() })
    await redisSet(REDIS_KEY, payload, TTL)

    console.log(
      `[solve] OK — cached token (ttl=${TTL}s). ui=${uiToken.slice(0, 8)}… waf=${wafToken.slice(0, 18)}…`
    )
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error('[solve] FAILED:', err.message)
  process.exit(1)
})
