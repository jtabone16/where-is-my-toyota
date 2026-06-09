import { NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

// Lightweight health check for the WAF token refresher (the GitHub Action that
// keeps a fresh aws-waf-token cached in Redis). Reports token age so you can
// tell at a glance whether the refresher is healthy — WITHOUT exposing the
// actual token values.
//
// The refresher writes the token with a 600s Redis TTL and re-runs every ~240s,
// so a healthy token should always be well under ~10 min old.

const WAF_TOKEN_KEY = "waf:vspec"
const TTL_SECONDS = 600

interface CachedWafToken {
  wafToken: string
  uiToken: string
  ts: number
}

export async function GET() {
  let value: CachedWafToken | string | null
  try {
    value = await Redis.fromEnv().get<CachedWafToken | string>(WAF_TOKEN_KEY)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { healthy: false, status: "error", error: `Could not reach Redis: ${message}` },
      { status: 503 }
    )
  }

  if (!value) {
    return NextResponse.json(
      {
        healthy: false,
        status: "missing",
        message:
          "No WAF token cached. The refresher (GitHub Action) may be down or hasn't run yet.",
      },
      { status: 503 }
    )
  }

  const parsed: CachedWafToken =
    typeof value === "string" ? (JSON.parse(value) as CachedWafToken) : value

  if (!parsed.wafToken || !parsed.uiToken || !parsed.ts) {
    return NextResponse.json(
      { healthy: false, status: "malformed", message: "Cached WAF token is malformed." },
      { status: 503 }
    )
  }

  const ageMs = Date.now() - parsed.ts
  const ageSeconds = Math.round(ageMs / 1000)
  // Token is considered stale once it's older than its TTL — at that point it
  // has likely already expired out of Redis or is about to.
  const healthy = ageSeconds >= 0 && ageSeconds < TTL_SECONDS

  return NextResponse.json({
    healthy,
    status: healthy ? "ok" : "stale",
    tokenAgeSeconds: ageSeconds,
    tokenAgeMinutes: Math.round((ageSeconds / 60) * 10) / 10,
    ttlSeconds: TTL_SECONDS,
    lastRefreshed: new Date(parsed.ts).toISOString(),
  })
}
