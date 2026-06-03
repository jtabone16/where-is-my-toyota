import { NextRequest, NextResponse } from "next/server"
import { getAllTracking, updateLastSeen } from "@/lib/db"
import { fetchVSpec, extractSnapshot, diffSnapshots } from "@/lib/toyota"
import { sendStatusChangeEmail } from "@/lib/email"

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const vehicles = await getAllTracking()
  const results: { vin: string; changed: boolean; diffs?: string[]; error?: string }[] = []

  await Promise.all(
    vehicles.map(async (v) => {
      try {
        const data = await fetchVSpec({ vin: v.vin, dealerId: v.dealerId, hash: v.hash })
        const newSnapshot = extractSnapshot(data)
        const diffs = diffSnapshots(v.lastSnapshot, newSnapshot)

        if (diffs.length > 0) {
          await sendStatusChangeEmail({
            to: v.email,
            vin: v.vin,
            nickname: v.nickname,
            diffs,
            newSnapshot,
          })
          await updateLastSeen(v.email, v.vin, newSnapshot)
          results.push({ vin: v.vin, changed: true, diffs: diffs.map(d => d.field) })
        } else {
          await updateLastSeen(v.email, v.vin, newSnapshot)
          results.push({ vin: v.vin, changed: false })
        }
      } catch (err) {
        results.push({
          vin: v.vin,
          changed: false,
          error: err instanceof Error ? err.message : "unknown",
        })
      }
    })
  )

  return NextResponse.json({ checked: vehicles.length, results })
}
