import { Resend } from "resend"
import { CATEGORY_LABELS } from "./toyota"

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

function getFrom() {
  return process.env.EMAIL_FROM ?? "noreply@whereismytoyota.com"
}

export async function sendStatusChangeEmail({
  to,
  vin,
  nickname,
  oldCategory,
  newCategory,
  eta,
}: {
  to: string
  vin: string
  nickname: string
  oldCategory: string
  newCategory: string
  eta?: string
}) {
  const oldLabel = CATEGORY_LABELS[oldCategory]?.label ?? oldCategory
  const newLabel = CATEGORY_LABELS[newCategory]?.label ?? newCategory
  const newDesc = CATEGORY_LABELS[newCategory]?.description ?? ""

  const isArrived = newCategory === "G"

  const subject = isArrived
    ? `🎉 Your Toyota is at the dealer! — ${nickname}`
    : `Status update: ${nickname} moved to "${newLabel}"`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; margin: 0; padding: 40px 20px; }
    .card { background: white; border-radius: 12px; max-width: 520px; margin: 0 auto; overflow: hidden; }
    .header { background: #EB0A1E; padding: 24px 32px; }
    .header h1 { color: white; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px; }
    .body { padding: 32px; }
    .status-row { display: flex; align-items: center; gap: 16px; margin: 20px 0; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; }
    .badge-old { background: #f4f4f5; color: #71717a; }
    .badge-new { background: ${isArrived ? '#dcfce7' : '#fef3c7'}; color: ${isArrived ? '#166534' : '#92400e'}; }
    .arrow { color: #a1a1aa; font-size: 18px; }
    .desc { color: #3f3f46; font-size: 15px; margin: 16px 0; }
    .vin { font-family: monospace; font-size: 13px; color: #71717a; background: #f4f4f5; padding: 8px 12px; border-radius: 6px; }
    .eta { margin-top: 16px; padding: 12px 16px; background: #f0fdf4; border-left: 3px solid #22c55e; border-radius: 4px; font-size: 14px; color: #166534; }
    .footer { padding: 20px 32px; border-top: 1px solid #f4f4f5; font-size: 12px; color: #a1a1aa; }
    .footer a { color: #a1a1aa; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Where Is My Toyota?</h1>
      <p>${nickname}</p>
    </div>
    <div class="body">
      <p style="color:#18181b;font-size:16px;margin-top:0">Your vehicle status changed:</p>
      <div class="status-row">
        <span class="badge badge-old">${oldLabel}</span>
        <span class="arrow">→</span>
        <span class="badge badge-new">${newLabel}</span>
      </div>
      <p class="desc">${newDesc}</p>
      <div class="vin">VIN: ${vin}</div>
      ${eta ? `<div class="eta"><strong>ETA:</strong> ${eta}</div>` : ""}
    </div>
    <div class="footer">
      You're receiving this because you signed up to track this vehicle.<br>
      <a href="#">Unsubscribe</a>
    </div>
  </div>
</body>
</html>
  `.trim()

  await getResend().emails.send({
    from: getFrom(),
    to,
    subject,
    html,
  })
}
