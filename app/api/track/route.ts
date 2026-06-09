import { NextRequest, NextResponse } from "next/server"
import { parseVSpecUrl, fetchVSpec, extractSnapshot } from "@/lib/toyota"
import { saveTracking } from "@/lib/db"
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

  let lastSnapshot = { dealerCategory: "A" }
  try {
    const data = await fetchVSpec(parsed)
    lastSnapshot = extractSnapshot(data)
  } catch {
    // Non-fatal: save with fallback
  }

  const resolvedNickname = nickname || parsed.vin

  await saveTracking({
    ...parsed,
    email,
    nickname: resolvedNickname,
    lastSnapshot,
    lastChecked: Date.now(),
  })

  // Confirmation email is best-effort — never fail the signup if mail hiccups.
  try {
    await sendWelcomeEmail({
      to: email,
      vin: parsed.vin,
      nickname: resolvedNickname,
      snapshot: lastSnapshot,
    })
  } catch (err) {
    console.error("welcome email failed:", err instanceof Error ? err.message : err)
  }

  return NextResponse.json({ ok: true, vin: parsed.vin })
}
