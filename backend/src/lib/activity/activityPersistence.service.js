import redisClient from "../core/redis.js";
import { User } from "../../models/user.model.js";

const REDIS_KEY_PREFIX = "listening:activity:";
const REDIS_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEBOUNCE_MS = 90_000;
const ACTIVITY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const debounceTimers = new Map();
const lastSongIds = new Map();
/** @type {Map<string, { activity: object, updatedAt: Date }>} */
const lastKnownTrackByUser = new Map();

const redisKey = (userId) => `${REDIS_KEY_PREFIX}${userId}`;

export const isTrackActivity = (activity) =>
  activity &&
  typeof activity === "object" &&
  activity.songId != null;

const pickLatest = (mongoEntry, redisEntry) => {
  if (!mongoEntry) return redisEntry;
  if (!redisEntry) return mongoEntry;
  return mongoEntry.updatedAt >= redisEntry.updatedAt ? mongoEntry : redisEntry;
};

const resolvePersistPayload = (userId, currentActivity) => {
  const lastKnown = lastKnownTrackByUser.get(userId);

  if (isTrackActivity(currentActivity)) {
    return { activity: currentActivity, updatedAt: new Date() };
  }

  if (lastKnown && isTrackActivity(lastKnown.activity)) {
    return {
      activity: lastKnown.activity,
      updatedAt: lastKnown.updatedAt,
    };
  }

  return null;
};

export const writeToRedis = async (
  userId,
  activity,
  updatedAt = new Date(),
) => {
  if (!isTrackActivity(activity) || !redisClient.isOpen) return;

  try {
    const at = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
    const payload = JSON.stringify({
      activity,
      updatedAt: at.toISOString(),
    });
    await redisClient.setEx(redisKey(userId), REDIS_TTL_SECONDS, payload);
  } catch (err) {
    console.error(`[ActivityPersistence] Redis write failed for ${userId}:`, err);
  }
};

export const persistToMongo = async (userId, activity, updatedAt = new Date()) => {
  if (!isTrackActivity(activity)) return;

  try {
    const at = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
    await User.findByIdAndUpdate(userId, {
      lastListeningActivity: { activity, updatedAt: at },
    });
  } catch (err) {
    console.error(`[ActivityPersistence] Mongo write failed for ${userId}:`, err);
    throw err;
  }
};

const clearDebounce = (userId) => {
  const timer = debounceTimers.get(userId);
  if (timer) clearTimeout(timer);
  debounceTimers.delete(userId);
};

export const rememberTrackActivity = (userId, activity) => {
  if (!isTrackActivity(activity)) return;
  lastKnownTrackByUser.set(userId, {
    activity,
    updatedAt: new Date(),
  });
};

export const touchLastKnownAt = (userId) => {
  const lastKnown = lastKnownTrackByUser.get(userId);
  if (!lastKnown) return;
  lastKnown.updatedAt = new Date();
};

const clearSession = (userId) => {
  clearDebounce(userId);
  lastSongIds.delete(userId);
  lastKnownTrackByUser.delete(userId);
};

/** Clears in-memory debounce state and Redis listening activity for a user. */
export const purgeUserListeningState = async (userId) => {
  const id = String(userId);
  clearSession(id);
  if (!redisClient.isOpen) return;
  try {
    await redisClient.del(redisKey(id));
  } catch (err) {
    console.error(`[ActivityPersistence] purge failed for ${id}:`, err);
  }
};

export const setSessionActivity = (userId, activity) => {
  if (!isTrackActivity(activity)) return;

  const songId = String(activity.songId);
  const prevSongId = lastSongIds.get(userId);
  lastSongIds.set(userId, songId);

  if (prevSongId !== songId) {
    clearDebounce(userId);
    void writeToRedis(userId, activity);
    return;
  }

  if (debounceTimers.has(userId)) return;

  const timer = setTimeout(() => {
    debounceTimers.delete(userId);
    void writeToRedis(userId, activity);
  }, DEBOUNCE_MS);
  debounceTimers.set(userId, timer);
};

const persistResolved = async (userId, payload) => {
  if (!payload) return;
  await persistToMongo(userId, payload.activity, payload.updatedAt);
  await writeToRedis(userId, payload.activity, payload.updatedAt);
};

export const persistOnDisconnect = async (userId, currentActivity) => {
  const payload = resolvePersistPayload(userId, currentActivity);
  clearSession(userId);
  await persistResolved(userId, payload);
};

export const flushAllActivities = async (userActivitiesMap) => {
  const userIds = new Set([
    ...userActivitiesMap.keys(),
    ...lastKnownTrackByUser.keys(),
  ]);

  const tasks = [];

  for (const userId of userIds) {
    const currentActivity = userActivitiesMap.get(userId);
    const payload = resolvePersistPayload(userId, currentActivity);
    if (!payload) continue;

    tasks.push(persistResolved(userId, payload));
    lastKnownTrackByUser.delete(userId);
    clearDebounce(userId);
    lastSongIds.delete(userId);
  }

  if (tasks.length === 0) return;

  const results = await Promise.allSettled(tasks);
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.error(
      `[ActivityPersistence] flushAllActivities: ${failed.length} write(s) failed`,
    );
  }
};

const readFromRedis = async (userId) => {
  if (!redisClient.isOpen) return null;

  try {
    const raw = await redisClient.get(redisKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!isTrackActivity(parsed.activity) || !parsed.updatedAt) return null;

    return {
      activity: parsed.activity,
      updatedAt: new Date(parsed.updatedAt),
    };
  } catch (err) {
    console.error(`[ActivityPersistence] Redis read failed for ${userId}:`, err);
    return null;
  }
};

export const getPersistedActivity = async (userId, mongoActivityDoc) => {
  let mongoEntry = null;
  if (
    mongoActivityDoc?.activity &&
    mongoActivityDoc?.updatedAt &&
    isTrackActivity(mongoActivityDoc.activity)
  ) {
    mongoEntry = {
      activity: mongoActivityDoc.activity,
      updatedAt: new Date(mongoActivityDoc.updatedAt),
    };
  }

  const redisEntry = await readFromRedis(userId);
  const latest = pickLatest(mongoEntry, redisEntry);

  if (!latest) return null;

  if (Date.now() - latest.updatedAt.getTime() > ACTIVITY_MAX_AGE_MS) {
    return null;
  }

  return {
    lastActivity: latest.activity,
    lastActivityAt: latest.updatedAt.toISOString(),
  };
};
