"use client"

import { useEffect, useRef, useState } from "react"
import { CATEGORY_LABELS, type VSpecData, type ParsedVSpecUrl } from "@/lib/toyota"

interface LookupResult {
  parsed: ParsedVSpecUrl
  data: VSpecData
}

const STAGES = [
  { key: "A", label: "Allocated", icon: "🏭" },
  { key: "F", label: "In Transit", icon: "🚢" },
  { key: "G", label: "At Dealer", icon: "🏁" },
]

// Rebuild a parseable v-spec URL from a result, so Refresh works regardless of
// what's currently typed in the lookup box.
const refreshUrl = (r: LookupResult) =>
  `https://api.rti.toyota.com/marketplace-inventory/vehicles/${r.parsed.dealerId}/${r.parsed.vin}/hash/${r.parsed.hash}/vspec`

const usd = (n?: number) =>
  typeof n === "number"
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : undefined

// Strip HTML tags + Toyota's bracket annotations (e.g. "[toyota_care]") to plain text.
const cleanText = (s: string) =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/\[[a-z0-9_]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim()

// camelCase category key -> "Title Case"
const humanizeKey = (k: string) =>
  k
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\band\b/gi, "&")
    .replace(/^./, c => c.toUpperCase())

type StdOptionItem = string | { name?: string; value?: string }

function normalizeStdOptions(raw: unknown): { category: string; items: string[] }[] {
  if (!raw || typeof raw !== "object") return []
  const out: { category: string; items: string[] }[] = []
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(val)) continue
    const items = (val as StdOptionItem[])
      .map(entry => {
        if (typeof entry === "string") return cleanText(entry)
        const name = cleanText(entry.name ?? "")
        const value = entry.value?.trim()
        // "S" just means "standard" — no need to show it; show real values like "$0 (No Cost)".
        return value && value !== "S" ? `${name} — ${value}` : name
      })
      .filter(Boolean)
    if (items.length) out.push({ category: humanizeKey(key), items })
  }
  return out
}

function StatusProgress({ category }: { category: string }) {
  const currentStep = CATEGORY_LABELS[category]?.step ?? 0

  return (
    <div className="flex items-center gap-0 w-full mt-6 mb-2">
      {STAGES.map((stage, i) => {
        const done = i <= currentStep
        const active = i === currentStep
        return (
          <div key={stage.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all ${
                  active
                    ? "border-[#2D6A4F] bg-[#2D6A4F]/10 scale-110"
                    : done
                    ? "border-[#2D6A4F] bg-[#2D6A4F]"
                    : "border-zinc-700 bg-zinc-800"
                }`}
              >
                {done && !active ? (
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>{stage.icon}</span>
                )}
              </div>
              <span className={`mt-2 text-xs font-medium ${active ? "text-[#2D6A4F]" : done ? "text-zinc-300" : "text-zinc-600"}`}>
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-5 ${i < currentStep ? "bg-[#2D6A4F]" : "bg-zinc-700"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function VehicleCard({ result }: { result: LookupResult }) {
  const { data, parsed } = result
  const [photoView, setPhotoView] = useState<"exterior" | "interior">("exterior")
  const category = (data.dealerCategory as string) ?? "?"
  const info = CATEGORY_LABELS[category]
  const isArrived = category === "G"

  const extColor = data.extColor as { marketingName?: string; colorHexCd?: string; colorCd?: string } | undefined
  const colorName = extColor?.marketingName?.replace(/\[.*?\]/g, "").trim()
  const colorHex = extColor?.colorHexCd
  const extColorCd = extColor?.colorCd

  const intColor = data.intColor as { marketingName?: string; colorCd?: string; colorSwatch?: string } | undefined
  const intColorName = intColor?.marketingName?.replace(/\[.*?\]/g, "").trim()
  const intColorCd = intColor?.colorCd
  const intColorSwatch = intColor?.colorSwatch

  const modelObj = data.model as { marketingName?: string } | undefined
  const trim = modelObj?.marketingName ?? (data.grade as string | undefined)

  const year = data.year ?? data.modelYear

  const etaObj = data.eta as { currFromDate?: string; currToDate?: string } | undefined
  const rawEta = etaObj?.currFromDate
    ? `${etaObj.currFromDate}${etaObj.currToDate ? " – " + etaObj.currToDate : ""}`
    : (data.eta as string | undefined)

  const media = data.media as Array<{ type: string; size?: string; href: string }> | undefined
  const extImage = media?.find(m => m.type === "exterior" && m.size === "680_383_PNG")?.href
  const intImage = media?.find(m => m.type === "interior" && m.size === "680_383_PNG")?.href

  // Availability flags
  const holdStatus = data.holdStatus as string | undefined
  const isPreSold = data.isPreSold === true
  const isHeld = Boolean(holdStatus) && holdStatus !== "None"
  const unavailable = isPreSold || isHeld

  // Pricing
  const price = data.price as
    | { baseMsrp?: number; totalMsrp?: number; optTotalMsrp?: number; dph?: number }
    | undefined

  // Specs
  const engine = data.engine as { name?: string; horsepower?: string; fuelType?: string } | undefined
  const drivetrain = data.drivetrain as { title?: string; code?: string } | undefined
  const transmission = data.transmission as { transmissionType?: string } | undefined
  const mpg = data.mpg as { city?: number; highway?: number; combined?: number } | undefined
  const seating = data.seating as number | undefined
  const stockNum = data.stockNum as string | undefined

  // Options / packages (strip MSRP=0 boilerplate like "50 State Emissions")
  const options = (
    (data.options as Array<{ marketingName?: string; msrp?: number; packageInd?: boolean }> | undefined) ?? []
  ).filter(o => o.marketingName && (o.msrp ?? 0) > 0)

  const specs: { label: string; value: string }[] = []
  if (engine?.name) specs.push({ label: "Engine", value: engine.name })
  if (engine?.horsepower) specs.push({ label: "Horsepower", value: `${engine.horsepower} hp` })
  if (drivetrain?.title) specs.push({ label: "Drivetrain", value: drivetrain.title })
  if (transmission?.transmissionType) specs.push({ label: "Transmission", value: transmission.transmissionType })
  if (mpg && (mpg.city || mpg.highway))
    specs.push({ label: "MPG", value: `${mpg.city ?? "?"} city / ${mpg.highway ?? "?"} hwy` })
  if (seating) specs.push({ label: "Seating", value: `${seating} passengers` })
  if (stockNum) specs.push({ label: "Stock #", value: stockNum })

  const stdOptions = normalizeStdOptions(data.standardOptions)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="bg-[#2D6A4F] px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-white/70 text-xs uppercase tracking-widest font-medium">Your Yota</p>
          <h2 className="text-white text-xl font-bold tracking-tight">
            {year ? `${year} ` : ""}
            {(data.marketingSeries as string) ?? "Vehicle"}
          </h2>
          {trim && <p className="text-white/70 text-xs mt-0.5 leading-tight">{trim}</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {isArrived && (
            <span className="bg-white text-[#2D6A4F] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              It&apos;s here!
            </span>
          )}
          {unavailable && (
            <span className="bg-white/15 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Reserved
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5">
        {unavailable && (
          <div className="mb-4 p-3 rounded-lg bg-zinc-800/60 border border-zinc-700 flex items-start gap-2">
            <span className="text-[#2D6A4F] text-base leading-none mt-0.5">&#10003;</span>
            <p className="text-zinc-300 text-sm">
              This build is <span className="font-semibold text-white">reserved</span>. If it&apos;s your
              order, you&apos;re all set — we&apos;ll keep an eye on it for you. If you haven&apos;t placed
              an order on this VIN, it&apos;s likely already claimed by another buyer.
            </p>
          </div>
        )}

        {(() => {
          const showInterior = photoView === "interior" && intImage
          const img = showInterior ? intImage : extImage
          if (!img) return null
          return (
            <div className="mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={showInterior ? "Interior" : "Exterior"} className="w-full rounded-lg object-cover" />
              {extImage && intImage && (
                <div className="mt-2 flex gap-1.5">
                  {(["exterior", "interior"] as const).map(view => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => setPhotoView(view)}
                      className={`text-xs font-medium px-3 py-1 rounded-full capitalize transition-colors ${
                        photoView === view
                          ? "bg-[#2D6A4F] text-white"
                          : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {view}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        <StatusProgress category={category} />

        <div className="mt-5 p-4 rounded-lg bg-zinc-800/60 border border-zinc-700">
          <p className="text-zinc-400 text-xs uppercase tracking-widest mb-1">Current Status</p>
          <p className="text-white font-semibold text-lg">{info?.label ?? category}</p>
          <p className="text-zinc-400 text-sm mt-0.5">{info?.description}</p>
        </div>

        {rawEta && (
          <div className="mt-3 p-4 rounded-lg bg-green-950/40 border border-green-800/40">
            <p className="text-green-400 text-xs uppercase tracking-widest mb-1">ETA Window</p>
            <p className="text-green-300 font-semibold">{rawEta}</p>
          </div>
        )}

        {price?.totalMsrp && (
          <div className="mt-3 p-4 rounded-lg bg-zinc-800/60 border border-zinc-700">
            <div className="flex items-baseline justify-between">
              <p className="text-zinc-400 text-xs uppercase tracking-widest">Total MSRP</p>
              <p className="text-white font-bold text-2xl tracking-tight">{usd(price.totalMsrp)}</p>
            </div>
            <div className="mt-2 space-y-1 text-sm">
              {price.baseMsrp != null && (
                <div className="flex justify-between text-zinc-400">
                  <span>Base MSRP</span>
                  <span>{usd(price.baseMsrp)}</span>
                </div>
              )}
              {price.optTotalMsrp ? (
                <div className="flex justify-between text-zinc-400">
                  <span>Options &amp; packages</span>
                  <span>{usd(price.optTotalMsrp)}</span>
                </div>
              ) : null}
              {price.dph != null && (
                <div className="flex justify-between text-zinc-400">
                  <span>Delivery, processing &amp; handling</span>
                  <span>{usd(price.dph)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Full vehicle details — collapsed so the tracking signup stays near the top */}
        <details className="mt-4 group">
          <summary className="flex items-center justify-between cursor-pointer select-none rounded-lg bg-zinc-800/40 border border-zinc-700/50 px-4 py-3 hover:bg-zinc-800/70 transition-colors">
            <span className="text-zinc-300 text-sm font-medium">Full vehicle details</span>
            <svg className="w-4 h-4 text-zinc-500 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>

          <div className="grid grid-cols-2 gap-3 mt-3">
            {colorName && (
              <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/50 flex flex-col">
                <p className="text-zinc-500 text-xs">Exterior</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {colorHex && (
                    <span className="w-4 h-4 rounded-full border border-zinc-600 flex-shrink-0" style={{ background: `#${colorHex}` }} />
                  )}
                  <p className="text-zinc-200 text-sm font-medium">{colorName}</p>
                </div>
                {extColorCd && <p className="text-zinc-500 text-xs font-mono mt-auto pt-2">Code {extColorCd}</p>}
              </div>
            )}
            {intColorName && (
              <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/50 flex flex-col">
                <p className="text-zinc-500 text-xs">Interior</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {intColorSwatch && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={intColorSwatch}
                      alt="Interior color"
                      className="w-4 h-4 rounded-full border border-zinc-600 object-cover flex-shrink-0"
                    />
                  )}
                  <p className="text-zinc-200 text-sm font-medium">{intColorName}</p>
                </div>
                {intColorCd && <p className="text-zinc-500 text-xs font-mono mt-auto pt-2">Code {intColorCd}</p>}
              </div>
            )}
            <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/50 col-span-2">
              <p className="text-zinc-500 text-xs">VIN</p>
              <p className="text-zinc-200 text-xs font-mono mt-0.5">{parsed.vin}</p>
            </div>
          </div>

          {specs.length > 0 && (
            <div className="mt-3 rounded-lg bg-zinc-800/40 border border-zinc-700/50 divide-y divide-zinc-700/50">
              {specs.map(s => (
                <div key={s.label} className="flex justify-between gap-3 px-4 py-2.5">
                  <span className="text-zinc-500 text-xs uppercase tracking-wide flex-shrink-0">{s.label}</span>
                  <span className="text-zinc-200 text-sm text-right">{s.value}</span>
                </div>
              ))}
            </div>
          )}

          {options.length > 0 && (
            <div className="mt-3 p-4 rounded-lg bg-zinc-800/40 border border-zinc-700/50">
              <p className="text-zinc-500 text-xs uppercase tracking-widest mb-2">Options &amp; Packages</p>
              <div className="space-y-1.5">
                {options.map((o, i) => (
                  <div key={i} className="flex justify-between gap-3 text-sm">
                    <span className="text-zinc-300">{o.marketingName}</span>
                    <span className="text-zinc-400 font-medium flex-shrink-0">{usd(o.msrp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stdOptions.length > 0 && (
            <details className="mt-3 rounded-lg bg-zinc-800/40 border border-zinc-700/50 px-4 py-3">
              <summary className="text-zinc-300 text-sm font-medium cursor-pointer select-none hover:text-white transition-colors">
                Standard equipment
              </summary>
              <div className="mt-3 space-y-4">
                {stdOptions.map(group => (
                  <div key={group.category}>
                    <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1.5">{group.category}</p>
                    <ul className="space-y-1">
                      {group.items.map((item, i) => (
                        <li key={i} className="text-zinc-300 text-sm flex gap-2">
                          <span className="text-zinc-600 flex-shrink-0">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Raw data disclosure */}
          <details className="mt-3">
            <summary className="text-zinc-600 text-xs cursor-pointer hover:text-zinc-400 transition-colors">
              View raw API response
            </summary>
            <pre className="mt-2 text-xs text-zinc-500 bg-zinc-950 rounded-lg p-4 overflow-auto max-h-64 leading-relaxed">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </details>
      </div>
    </div>
  )
}

function TrackForm({ result, onTracked }: { result: LookupResult; onTracked: () => void }) {
  const [email, setEmail] = useState("")
  const [nickname, setNickname] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `https://api.rti.toyota.com/marketplace-inventory/vehicles/${result.parsed.dealerId}/${result.parsed.vin}/hash/${result.parsed.hash}/vspec`,
          email,
          nickname: nickname || undefined,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? "Failed to save")
      }
      setDone(true)
      onTracked()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-green-800/40 bg-green-950/20 px-6 py-5 flex items-center gap-3">
        <span className="text-green-400 text-xl">✓</span>
        <div>
          <p className="text-green-300 font-medium">You&apos;re on the list!</p>
          <p className="text-green-600 text-sm">We&apos;ll email {email} when the status changes.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-5">
      <h3 className="text-white font-semibold mb-1">Get notified on status changes</h3>
      <p className="text-zinc-500 text-sm mb-4">We&apos;ll email you when your vehicle moves to the next stage — no more pinging the salesperson.</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-[#2D6A4F] transition-colors"
        />
        <input
          type="text"
          placeholder={`Nickname (e.g. "My 4Runner TRD Pro")`}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-[#2D6A4F] transition-colors"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
        >
          {loading ? "Saving…" : "Notify me"}
        </button>
      </form>
    </div>
  )
}

export default function Home() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<LookupResult | null>(null)
  const [tracked, setTracked] = useState(false)

  async function runLookup(targetUrl: string, { persist = true } = {}) {
    const trimmed = targetUrl.trim()
    if (!trimmed) return

    setLoading(true)
    setError("")
    setResult(null)
    setTracked(false)

    try {
      const res = await fetch(`/api/vspec?url=${encodeURIComponent(trimmed)}`)
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error ?? `API error ${res.status}`)
      }

      setResult(json as LookupResult)
      // Persist the lookup in the address bar so a refresh / shared link / reopened
      // tab re-runs it automatically — no need to paste the v-spec link again.
      if (persist && typeof window !== "undefined") {
        const next = `${window.location.pathname}?url=${encodeURIComponent(trimmed)}`
        window.history.replaceState(null, "", next)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    runLookup(url)
  }

  // On first load, if the URL carries a ?url= param (a previously searched
  // v-spec link), prefill the box and run the lookup automatically.
  const didAutoLoad = useRef(false)
  useEffect(() => {
    if (didAutoLoad.current) return
    didAutoLoad.current = true
    const fromUrl = new URLSearchParams(window.location.search).get("url")
    if (fromUrl) {
      setUrl(fromUrl)
      runLookup(fromUrl, { persist: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
        <span className="text-[#2D6A4F] font-black text-lg tracking-tight">🌲 WHERE'S MY YOTA?</span>
      </nav>

      <div className="flex-1 flex flex-col items-center px-4 pt-16 pb-20">
        <div className="w-full max-w-xl space-y-6">

          {/* Hero */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Where&apos;s my Yota?
            </h1>
            <p className="text-zinc-500 text-base">
              Paste your dealer&apos;s VSpec link and stop bugging your salesperson.
            </p>
          </div>

          {/* Lookup form */}
          <form onSubmit={handleLookup} className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste your guest.dealer.toyota.com VSpec URL…"
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-[#2D6A4F] transition-colors pr-28"
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="absolute right-2 top-2 bottom-2 bg-[#2D6A4F] hover:bg-[#1B4332] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 text-sm transition-colors"
              >
                {loading ? "…" : "Look up"}
              </button>
            </div>

            <p className="text-zinc-600 text-xs text-center">
              Your link should contain a VIN, dealer ID, and a long hash — we extract them automatically.
            </p>
          </form>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3">
              <p className="text-red-400 text-sm font-medium">Error</p>
              <p className="text-red-300 text-sm mt-0.5">{error}</p>
              <p className="text-red-600 text-xs mt-2">
                Note: If Toyota&apos;s API returned a 403, it may require your browser session. Try opening the VSpec URL in a browser first, then look up immediately.
              </p>
            </div>
          )}

          {/* Results */}
          {result && (
            <>
              {/* Notify CTA sits up top — if you've got a v-spec link, you're here to track it */}
              {!tracked ? (
                <TrackForm result={result} onTracked={() => setTracked(true)} />
              ) : (
                <div className="rounded-xl border border-green-800/40 bg-green-950/20 px-6 py-5 flex items-center gap-3">
                  <span className="text-green-400 text-xl">✓</span>
                  <p className="text-green-300 font-medium">Tracking active — we&apos;ll email you when something changes.</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <h2 className="text-zinc-400 text-xs uppercase tracking-widest font-semibold">Your vehicle</h2>
                <button
                  type="button"
                  onClick={() => runLookup(refreshUrl(result), { persist: false })}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-white disabled:opacity-50 text-xs font-medium transition-colors"
                >
                  <svg
                    className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              <VehicleCard result={result} />
            </>
          )}

          {/* How it works */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-6 py-5 space-y-3">
            <h3 className="text-zinc-400 text-xs uppercase tracking-widest font-semibold">How to get your VSpec URL</h3>
            <ol className="space-y-2 text-sm text-zinc-500 list-decimal list-inside">
              <li>Ask your dealer for the VSpec sheet link (starts with <code className="text-zinc-400">guest.dealer.toyota.com</code>)</li>
              <li>Open it in your browser — it contains your VIN, dealer ID, and a security hash</li>
              <li>Paste the full URL above</li>
            </ol>
            <div className="mt-3 pt-3 border-t border-zinc-800 grid grid-cols-3 gap-2 text-center">
              {STAGES.map((s) => (
                <div key={s.key} className="space-y-1">
                  <p className="text-lg">{s.icon}</p>
                  <p className="text-zinc-400 text-xs font-medium">{s.label}</p>
                  <p className="text-zinc-600 text-xs">
                    {s.key === "A" && "In production"}
                    {s.key === "F" && "Shipped from factory"}
                    {s.key === "G" && "At your dealer"}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <footer className="border-t border-zinc-800 px-6 py-4 text-center text-zinc-700 text-xs">
        Not affiliated with Toyota. Built by Yota owners, for Yota owners.
      </footer>
    </main>
  )
}
