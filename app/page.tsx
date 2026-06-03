"use client"

import { useState } from "react"
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
  const category = (data.dealerCategory as string) ?? "?"
  const info = CATEGORY_LABELS[category]
  const isArrived = category === "G"

  const extColor = data.extColor as { marketingName?: string; colorHexCd?: string } | undefined
  const colorName = extColor?.marketingName?.replace(/\[.*?\]/g, "").trim()
  const colorHex = extColor?.colorHexCd

  const intColor = data.intColor as { marketingName?: string } | undefined
  const intColorName = intColor?.marketingName?.replace(/\[.*?\]/g, "").trim()

  const modelObj = data.model as { marketingName?: string } | undefined
  const trim = modelObj?.marketingName ?? (data.grade as string | undefined)

  const year = data.year ?? data.modelYear

  const etaObj = data.eta as { currFromDate?: string; currToDate?: string } | undefined
  const rawEta = etaObj?.currFromDate
    ? `${etaObj.currFromDate}${etaObj.currToDate ? " – " + etaObj.currToDate : ""}`
    : (data.eta as string | undefined)

  const carImage = (data.media as Array<{ type: string; size?: string; href: string }> | undefined)
    ?.find(m => m.type === "exterior" && m.size === "680_383_PNG")?.href

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
        {isArrived && (
          <span className="bg-white text-[#2D6A4F] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            It&apos;s here!
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-6 py-5">
        {carImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={carImage} alt="Vehicle" className="w-full rounded-lg mb-4 object-cover" />
        )}

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

        <div className="mt-4 grid grid-cols-2 gap-3">
          {colorName && (
            <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/50">
              <p className="text-zinc-500 text-xs">Exterior</p>
              <div className="flex items-center gap-2 mt-0.5">
                {colorHex && (
                  <span className="w-3 h-3 rounded-full border border-zinc-600 flex-shrink-0" style={{ background: `#${colorHex}` }} />
                )}
                <p className="text-zinc-200 text-sm font-medium">{colorName}</p>
              </div>
            </div>
          )}
          {intColorName && (
            <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/50">
              <p className="text-zinc-500 text-xs">Interior</p>
              <p className="text-zinc-200 text-sm font-medium mt-0.5">{intColorName}</p>
            </div>
          )}
          <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/50 col-span-2">
            <p className="text-zinc-500 text-xs">VIN</p>
            <p className="text-zinc-200 text-xs font-mono mt-0.5">{parsed.vin}</p>
          </div>
        </div>

        {/* Raw data disclosure */}
        <details className="mt-4">
          <summary className="text-zinc-600 text-xs cursor-pointer hover:text-zinc-400 transition-colors">
            View raw API response
          </summary>
          <pre className="mt-2 text-xs text-zinc-500 bg-zinc-950 rounded-lg p-4 overflow-auto max-h-64 leading-relaxed">
            {JSON.stringify(data, null, 2)}
          </pre>
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

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setResult(null)
    setTracked(false)

    try {
      const res = await fetch(`/api/vspec?url=${encodeURIComponent(url)}`)
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error ?? `API error ${res.status}`)
      }

      setResult(json as LookupResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

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
              <VehicleCard result={result} />
              {!tracked && (
                <TrackForm result={result} onTracked={() => setTracked(true)} />
              )}
              {tracked && (
                <div className="rounded-xl border border-green-800/40 bg-green-950/20 px-6 py-5 flex items-center gap-3">
                  <span className="text-green-400 text-xl">✓</span>
                  <p className="text-green-300 font-medium">Tracking active — we&apos;ll email you when something changes.</p>
                </div>
              )}
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
