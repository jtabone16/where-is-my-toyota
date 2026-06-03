import { Resend } from "resend"
import { CATEGORY_LABELS, type VehicleSnapshot, type SnapshotDiff } from "./toyota"

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

function getFrom() {
  return process.env.EMAIL_FROM ?? "noreply@whereismyyota.com"
}

export async function sendStatusChangeEmail({
  to,
  vin,
  nickname,
  diffs,
  newSnapshot,
}: {
  to: string
  vin: string
  nickname: string
  diffs: SnapshotDiff[]
  newSnapshot: VehicleSnapshot
}) {
  const isArrived = newSnapshot.dealerCategory === "G"
  const isAppointmentReady = diffs.some(d => d.field === "appointment")

  const subject = isArrived
    ? `🎉 Your Yota is at the dealer! — ${nickname}`
    : isAppointmentReady
    ? `📅 Your Yota is ready for pickup! — ${nickname}`
    : `Update on your Yota — ${nickname}`

  const diffRows = diffs.map(d => `
    <tr>
      <td style="padding:10px 16px;color:#6b7280;font-size:13px;white-space:nowrap;border-bottom:1px solid #f3f4f6">${d.label}</td>
      <td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f3f4f6">
        <span style="color:#9ca3af;text-decoration:line-through">${d.old}</span>
        <span style="margin:0 8px;color:#d1d5db">→</span>
        <strong style="color:#111827">${d.new}</strong>
      </td>
    </tr>
  `).join("")

  const categoryInfo = CATEGORY_LABELS[newSnapshot.dealerCategory]
  const etaStr = [newSnapshot.etaFrom, newSnapshot.etaTo].filter(Boolean).join(" – ")

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:40px 20px">
  <div style="background:white;border-radius:12px;max-width:520px;margin:0 auto;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">

    <div style="background:#2D6A4F;padding:24px 32px">
      <p style="color:rgba(255,255,255,.7);margin:0 0 4px;font-size:12px;letter-spacing:.1em;text-transform:uppercase">Where's My Yota?</p>
      <h1 style="color:white;margin:0;font-size:22px;font-weight:700">${nickname}</h1>
    </div>

    <div style="padding:28px 32px">
      <p style="color:#111827;font-size:15px;margin:0 0 20px">Something changed on your order:</p>

      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;margin-bottom:20px">
        ${diffRows}
      </table>

      ${categoryInfo ? `
      <div style="background:#f0fdf4;border-left:3px solid #2D6A4F;padding:12px 16px;border-radius:4px;margin-bottom:20px">
        <p style="margin:0;color:#166534;font-size:14px"><strong>${categoryInfo.label}:</strong> ${categoryInfo.description}</p>
      </div>` : ""}

      ${etaStr ? `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:12px 16px;border-radius:8px">
        <p style="margin:0;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Current ETA</p>
        <p style="margin:4px 0 0;color:#166534;font-size:16px;font-weight:600">${etaStr}</p>
      </div>` : ""}
    </div>

    <div style="padding:16px 32px;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af">
      VIN: <span style="font-family:monospace">${vin}</span><br>
      Not affiliated with Toyota. Built by Yota owners, for Yota owners.
    </div>
  </div>
</body>
</html>`.trim()

  await getResend().emails.send({
    from: getFrom(),
    to,
    subject,
    html,
  })
}
