import { NextRequest, NextResponse } from "next/server"
import { parseVSpecUrl, fetchVSpec, extractSnapshot } from "@/lib/toyota"
import { saveTracking } from "@/lib/db"

export async function POST(req: NextRequest) {
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

  await saveTracking({
    ...parsed,
    email,
    nickname: nickname || parsed.vin,
    lastSnapshot,
    lastChecked: Date.now(),
  })

  return NextResponse.json({ ok: true, vin: parsed.vin })
}
