export interface VSpecData {
  vin?: string
  dealerCategory?: string
  eta?: string
  modelYear?: number
  model?: string
  series?: string
  grade?: string
  exteriorColor?: { name?: string; code?: string }
  interiorColor?: { name?: string; code?: string }
  accessories?: unknown[]
  [key: string]: unknown
}

export interface ParsedVSpecUrl {
  vin: string
  dealerId: string
  hash: string
}

// Extracts VIN, dealerId, and hash from any vspec-related URL format:
//   guest.dealer.toyota.com/v-spec/{dealerId}/{VIN}/detail?k={hash}  ← real dealer format
//   api.rti.toyota.com/marketplace-inventory/vehicles/{dealerId}/{VIN}/hash/{hash}/vspec
//   Any URL containing VIN (17 chars), dealerId (digits), and hash (64 hex chars)
export function parseVSpecUrl(input: string): ParsedVSpecUrl | null {
  const trimmed = input.trim()

  // VIN: 17 chars, no I/O/Q
  const vinMatch = trimmed.match(/\b([A-HJ-NPR-Z0-9]{17})\b/)

  // Hash: 64 lowercase hex chars (in ?k=, ?hash=, /hash/, or bare in path)
  const hashMatch =
    trimmed.match(/[?&]k=([0-9a-f]{64})/) ||
    trimmed.match(/[?&]hash=([0-9a-f]{64})/) ||
    trimmed.match(/\/hash\/([0-9a-f]{64})/) ||
    trimmed.match(/\b([0-9a-f]{64})\b/)

  // DealerId: numeric segment in known path positions
  //   /v-spec/{dealerId}/{VIN}/   ← guest.dealer.toyota.com
  //   /vehicles/{dealerId}/{VIN}/ ← api.rti.toyota.com
  //   or dealerId= query param
  const dealerIdMatch =
    trimmed.match(/\/v-spec\/(\d+)\//) ||
    trimmed.match(/\/vehicles\/(\d+)\//) ||
    trimmed.match(/[?&]dealerId=(\d+)/)

  if (!vinMatch || !hashMatch || !dealerIdMatch) return null

  return {
    vin: vinMatch[1],
    dealerId: dealerIdMatch[1],
    hash: hashMatch[1],
  }
}

export function buildApiUrl(params: ParsedVSpecUrl): string {
  return (
    `https://api.rti.toyota.com/marketplace-inventory/vehicles/` +
    `${params.dealerId}/${params.vin}/hash/${params.hash}/vspec?includeMediaSource=PORT`
  )
}

async function getApiKey(): Promise<string> {
  const res = await fetch(
    "https://api.rti.toyota.com/token-service/public?tokenName=vspec",
    {
      headers: {
        Accept: "application/json",
        Referer: "https://guest.dealer.toyota.com/",
      },
      next: { revalidate: 3600 }, // cache for 1 hour
    }
  )
  if (!res.ok) throw new Error(`Token service returned ${res.status}`)
  const json = await res.json()
  const key = json?.tokenDetails?.ui
  if (!key) throw new Error("No ui token in token service response")
  return key
}

export async function fetchVSpec(params: ParsedVSpecUrl): Promise<VSpecData> {
  const apiKey = await getApiKey()
  const url = buildApiUrl(params)
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Referer: "https://guest.dealer.toyota.com/",
      Origin: "https://guest.dealer.toyota.com",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "x-api-key": apiKey,
    },
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`Toyota API returned ${res.status}`)
  }

  return res.json()
}

export const CATEGORY_LABELS: Record<string, { label: string; description: string; step: number }> = {
  A: { label: "Allocated", description: "Vehicle is in production", step: 0 },
  F: { label: "In Transit", description: "Built and on its way to your dealer", step: 1 },
  G: { label: "At Dealer", description: "Arrived! Contact your salesperson", step: 2 },
}
