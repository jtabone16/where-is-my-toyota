import { NextRequest, NextResponse } from "next/server"
import { parseVSpecUrl, fetchVSpec } from "@/lib/toyota"
import { lookupLimiter } from "@/lib/ratelimit"

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anonymous"
  const { success } = await lookupLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: "Too many lookups — try again in an hour." }, { status: 429 })
  }

  const url = req.nextUrl.searchParams.get("url")
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
  }

  const parsed = parseVSpecUrl(url)
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "Could not parse VIN, dealer ID, and hash from the provided URL. " +
          "Please paste your full guest.dealer.toyota.com link.",
      },
      { status: 422 }
    )
  }

  try {
    const data = await fetchVSpec(parsed)
    return NextResponse.json({ parsed, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message, parsed }, { status: 502 })
  }
}
