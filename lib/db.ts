import { Redis } from "@upstash/redis"

function getRedis() {
  return Redis.fromEnv()
}

export interface TrackedVehicle {
  vin: string
  dealerId: string
  hash: string
  email: string
  nickname: string
  lastCategory: string
  lastChecked: number
}

const ALL_TRACKS_KEY = "tracks:all"

function trackKey(email: string, vin: string) {
  return `track:${email}:${vin}`
}

export async function saveTracking(vehicle: TrackedVehicle): Promise<void> {
  const redis = getRedis()
  const key = trackKey(vehicle.email, vehicle.vin)
  await redis.set(key, vehicle)
  await redis.sadd(ALL_TRACKS_KEY, key)
}

export async function getAllTracking(): Promise<TrackedVehicle[]> {
  const redis = getRedis()
  const keys = await redis.smembers<string[]>(ALL_TRACKS_KEY)
  if (!keys.length) return []
  const results = await Promise.all(keys.map((k) => redis.get<TrackedVehicle>(k)))
  return results.filter(Boolean) as TrackedVehicle[]
}

export async function updateLastSeen(
  email: string,
  vin: string,
  category: string
): Promise<void> {
  const redis = getRedis()
  const key = trackKey(email, vin)
  const existing = await redis.get<TrackedVehicle>(key)
  if (!existing) return
  await redis.set(key, { ...existing, lastCategory: category, lastChecked: Date.now() })
}
