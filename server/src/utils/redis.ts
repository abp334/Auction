import IORedis from "ioredis";
import { logger } from "./logger.js";

const Redis = IORedis.default || IORedis;
type RedisClient = IORedis.Redis;

let redis: RedisClient | null = null;

export function getRedis(): RedisClient {
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL environment variable is required");

    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 10) return null;
        return Math.min(times * 200, 5000);
      },
      reconnectOnError(err: Error) {
        return err.message.includes("READONLY");
      },
    });

    redis.on("connect", () => logger.info("Redis connected"));
    redis.on("error", (err: Error) => logger.error({ err }, "Redis error"));
    redis.on("close", () => logger.warn("Redis connection closed"));
  }
  return redis;
}

export function createRedisClient(): RedisClient {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL environment variable is required");

  return new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 10) return null;
      return Math.min(times * 200, 5000);
    },
  });
}

export async function disconnectRedis() {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

export async function acquireLock(
  key: string,
  ttlMs: number = 10000
): Promise<boolean> {
  const r = getRedis();
  const result = await r.set(key, "1", "PX", ttlMs, "NX");
  return result === "OK";
}

export async function releaseLock(key: string): Promise<void> {
  const r = getRedis();
  await r.del(key);
}
