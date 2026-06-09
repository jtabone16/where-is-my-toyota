import { Redis } from "@upstash/redis"

function getRedis() {
  return Redis.fromEnv()
}

import type { VehicleSnapshot } from "./toyota"

export interface TrackedVehicle {
  vin: string
  dealerId: string
  hash: string
  email: string
  nickname: string
  lastSnapshot: VehicleSnapshot
  lastChecked: number
  // Whether the one-time welcome/confirmation email has been sent. Older
  // records (created before the welcome feature) won't have this field, so
  // `welcomed !== true` correctly treats them as "not yet welcomed".
  welcomed?: boolean
  // First time this email+VIN was registered. Optional for legacy records.
  createdAt?: number
}

const ALL_TRACKS_KEY = "tracks:all"

function trackKey(email: string, vin: string) {
  return `track:${email}:${vin}`
}

export async function getTracking(
  email: string,
  vin: string
): Promise<TrackedVehicle | null> {
  const redis = getRedis()
  return (await redis.get<TrackedVehicle>(trackKey(email, vin))) ?? null
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
  snapshot: VehicleSnapshot
): Promise<void> {
  const redis = getRedis()
  const key = trackKey(email, vin)
  const existing = await redis.get<TrackedVehicle>(key)
  if (!existing) return
  await redis.set(key, { ...existing, lastSnapshot: snapshot, lastChecked: Date.now() })
}
