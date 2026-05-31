import { Queue, Worker } from "bullmq";
import redisClient from "../core/redis.js";
import { HomeFeed } from "../../models/homeFeed.model.js";

const QUEUE_NAME = "home-feed-generation";
const HOME_BOOTSTRAP_PATH = "/api/home/bootstrap";

const getRedisConnection = () => ({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

let queueInstance = null;
let workerInstance = null;

const getQueue = () => {
  if (!queueInstance) {
    queueInstance = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return queueInstance;
};

export const invalidatePersonalizedHomeCache = async (userId) => {
  if (!redisClient.isOpen) return;

  const cacheKey = `cache:${userId}:${HOME_BOOTSTRAP_PATH}`;
  try {
    await redisClient.del(cacheKey);
  } catch (error) {
    console.error(`[homeFeed] Failed to invalidate cache for ${userId}:`, error);
  }
};

export const enqueueHomeFeedGeneration = async (userId) => {
  const userKey = userId.toString();

  try {
    const queue = getQueue();
    await queue.add(
      "generate",
      { userId: userKey },
      {
        jobId: userKey,
        removeOnComplete: true,
        removeOnFail: 100,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    );
  } catch (error) {
    if (error?.message?.includes("Job") && error?.message?.includes("exists")) {
      return;
    }
    console.error(`[homeFeed] Failed to enqueue generation for ${userKey}:`, error);
  }
};

export const getHomeFeedStatus = async (userId) => {
  const userKey = userId.toString();

  const feed = await HomeFeed.findOne({ userId: userKey })
    .select("quickPicks.songIds")
    .lean();

  if ((feed?.quickPicks?.songIds?.length ?? 0) > 0) {
    return { status: "ready" };
  }

  try {
    const queue = getQueue();
    const job = await queue.getJob(userKey);

    if (job) {
      const state = await job.getState();
      if (state === "failed") {
        return { status: "failed" };
      }
    }
  } catch (error) {
    console.error(`[homeFeed] Failed to read job status for ${userKey}:`, error);
  }

  return { status: "pending" };
};

export const createHomeFeedWorker = () => {
  if (workerInstance) return workerInstance;

  workerInstance = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { userId } = job.data;
      const { generateHomeFeedForUser } = await import(
        "./homeFeedGenerator.service.js"
      );
      await generateHomeFeedForUser(userId);
      await invalidatePersonalizedHomeCache(userId);
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    },
  );

  workerInstance.on("failed", (job, error) => {
    console.error(
      `[homeFeed] Job ${job?.id} failed:`,
      error?.message || error,
    );
  });

  return workerInstance;
};

export const closeHomeFeedWorker = async () => {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }
};
