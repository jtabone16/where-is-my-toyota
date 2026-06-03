import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// 10 lookups per IP per hour
export const lookupLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  prefix: "rl:lookup",
})

// 3 tracking signups per IP per day
export const trackLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, "1 d"),
  prefix: "rl:track",
})
