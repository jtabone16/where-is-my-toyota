import { NextRequest, NextResponse } from "next/server"
import { getAllTracking, updateLastSeen } from "@/lib/db"
import { fetchVSpec } from "@/lib/toyota"
import { sendStatusChangeEmail } from "@/lib/email"

// Vercel Cron calls this with a GET request.
// Protected by CRON_SECRET so it can't be triggered publicly.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const vehicles = await getAllTracking()
  const results: { vin: string; changed: boolean; error?: string }[] = []

  await Promise.all(
    vehicles.map(async (v) => {
      try {
        const data = await fetchVSpec({ vin: v.vin, dealerId: v.dealerId, hash: v.hash })
        const newCategory = (data.dealerCategory as string) ?? v.lastCategory

        if (newCategory !== v.lastCategory) {
          await sendStatusChangeEmail({
            to: v.email,
            vin: v.vin,
            nickname: v.nickname,
            oldCategory: v.lastCategory,
            newCategory,
            eta: data.eta as string | undefined,
          })
          await updateLastSeen(v.email, v.vin, newCategory)
          results.push({ vin: v.vin, changed: true })
        } else {
          await updateLastSeen(v.email, v.vin, newCategory)
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
