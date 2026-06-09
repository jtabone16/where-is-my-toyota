import { NextRequest, NextResponse } from "next/server"
import { sendStatusChangeEmail, getFrom } from "@/lib/email"

// Sends a single SAMPLE status-change email to one address you specify, so you
// can verify the "from" sender after changing EMAIL_FROM — WITHOUT touching any
// real tracked users (the cron job is what emails them).
//
// Usage:
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     "https://where-is-my-toyota.vercel.app/api/test-email?to=you@example.com"
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const to = req.nextUrl.searchParams.get("to")
  if (!to) {
    return NextResponse.json({ error: "Missing ?to= email address" }, { status: 400 })
  }

  try {
    await sendStatusChangeEmail({
      to,
      vin: "TEST00000000000XX",
      nickname: "Test Vehicle",
      diffs: [
        { field: "dealerCategory", label: "Status", old: "Allocated", new: "In Transit" },
        { field: "eta", label: "ETA Window", old: "Unknown", new: "2026-06-10 – 2026-06-14" },
      ],
      newSnapshot: {
        dealerCategory: "F",
        etaFrom: "2026-06-10",
        etaTo: "2026-06-14",
      },
    })
    return NextResponse.json({ sent: true, to, from: getFrom() })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ sent: false, from: getFrom(), error: message }, { status: 502 })
  }
}
