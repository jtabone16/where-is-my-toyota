import { NextRequest, NextResponse } from "next/server"
import { parseVSpecUrl, fetchVSpec, extractSnapshot } from "@/lib/toyota"
import { saveTracking, getTracking } from "@/lib/db"
import { trackLimiter } from "@/lib/ratelimit"
import { sendWelcomeEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anonymous"
  const { success } = await trackLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: "Too many signups from this IP today." }, { status: 429 })
  }

  const body = await req.json()
  const { url, email, nickname } = body as {
    url?: string
    email?: string
    nickname?: string
  }

  if (!url || !email) {
    return NextResponse.json({ error: "url and email are required" }, { status: 400 })
  }

  const parsed = parseVSpecUrl(url)
  if (!parsed) {
    return NextResponse.json({ error: "Could not parse VSpec URL" }, { status: 422 })
  }

  // Is this email already tracking this VIN? Drives dedup decisions below.
  const existing = await getTracking(email, parsed.vin)

  let lastSnapshot = { dealerCategory: "A" }
  try {
    const data = await fetchVSpec(parsed)
    lastSnapshot = extractSnapshot(data)
  } catch {
    // Non-fatal: save with fallback
  }

  // On re-signup, KEEP the previously stored snapshot as the alert baseline.
  // Re-baselining to a freshly-fetched snapshot here could silently swallow a
  // status change that happened since the last signup — i.e. miss an alert.
  // (We still refresh nickname so the user can rename a tracked vehicle.)
  const baselineSnapshot = existing?.lastSnapshot ?? lastSnapshot
  const resolvedNickname = nickname || existing?.nickname || parsed.vin

  // Only welcome once. Existing records that predate the welcome feature have
  // `welcomed` undefined, so they still get a single welcome on their next
  // signup. Already-welcomed records are not re-emailed.
  const shouldWelcome = existing?.welcomed !== true

  await saveTracking({
    ...parsed,
    email,
    nickname: resolvedNickname,
    lastSnapshot: baselineSnapshot,
    lastChecked: existing?.lastChecked ?? Date.now(),
    welcomed: existing?.welcomed === true || shouldWelcome,
    createdAt: existing?.createdAt ?? Date.now(),
  })

  // Confirmation email is best-effort — never fail the signup if mail hiccups.
  if (shouldWelcome) {
    try {
      await sendWelcomeEmail({
        to: email,
        vin: parsed.vin,
        nickname: resolvedNickname,
        snapshot: baselineSnapshot,
      })
    } catch (err) {
      console.error("welcome email failed:", err instanceof Error ? err.message : err)
    }
  }

  return NextResponse.json({
    ok: true,
    vin: parsed.vin,
    alreadyTracking: Boolean(existing),
  })
}
