import { Queue, Worker } from "bullmq";
import { v4 as uuidv4 } from "uuid";
import {
  downloadAlbumWithDeemix,
  cleanupDeemixJob,
} from "../integrations/deemixDownload.service.js";
import { ingestAlbumFromSpotify } from "./albumIngest.service.js";
import {
  tryAcquireUploadLock,
  clearUploadInProgress,
  uploadBusyError,
} from "./activeUploads.service.js";

const QUEUE_NAME = "album-ingest-from-url";

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

export const enqueueAlbumIngestFromUrl = async (spotifyAlbumUrl) => {
  if (!tryAcquireUploadLock()) {
    throw uploadBusyError();
  }

  const jobId = uuidv4();
  try {
    const queue = getQueue();
    await queue.add(
      "ingest",
      { spotifyAlbumUrl },
      {
        jobId,
        removeOnComplete: { age: 3600, count: 50 },
        removeOnFail: { age: 86400, count: 100 },
        attempts: 1,
      },
    );
  } catch (error) {
    clearUploadInProgress();
    throw error;
  }

  // Lock stays held until the worker finishes (success or fail).
  return jobId;
};

export const getAlbumIngestJobStatus = async (jobId) => {
  const queue = getQueue();
  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress;
  const result = job.returnvalue;
  const failedReason = job.failedReason;

  const base = {
    jobId,
    status: state,
    progress: typeof progress === "object" ? progress : { step: progress },
  };

  if (state === "completed" && result) {
    return {
      ...base,
      status: "completed",
      message: result.message,
      albumId: result.albumId,
      albumTitle: result.albumTitle,
      trackCount: result.trackCount,
    };
  }

  if (state === "failed") {
    return {
      ...base,
      status: "failed",
      message: failedReason || "Album ingest failed.",
    };
  }

  if (state === "active") {
    return {
      ...base,
      status: "active",
      message:
        (typeof progress === "object" && progress?.message) ||
        "Processing album...",
    };
  }

  return {
    ...base,
    status: state === "waiting" || state === "delayed" ? "queued" : state,
    message: "Queued for download and ingest.",
  };
};

export const createAlbumIngestWorker = () => {
  if (workerInstance) return workerInstance;

  workerInstance = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { spotifyAlbumUrl } = job.data;
      let jobRoot = null;

      // Lock already acquired at enqueue time.
      try {
        await job.updateProgress({
          step: "downloading",
          message: "Downloading album via deemix...",
        });

        const { downloadDir, jobRoot: root, spotifyAlbumData } =
          await downloadAlbumWithDeemix(spotifyAlbumUrl, job.id);
        jobRoot = root;

        await job.updateProgress({
          step: "ingesting",
          message: `Ingesting "${spotifyAlbumData.name}"...`,
        });

        const { album, songs } = await ingestAlbumFromSpotify({
          spotifyAlbumUrl,
          audioDir: downloadDir,
          spotifyAlbumData,
        });

        return {
          message: `Album "${album.title}" (${album.type}) and ${songs.length} tracks added successfully!`,
          albumId: album._id.toString(),
          albumTitle: album.title,
          trackCount: songs.length,
        };
      } finally {
        await cleanupDeemixJob(jobRoot);
        clearUploadInProgress();
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
    },
  );

  workerInstance.on("failed", (job, error) => {
    console.error(
      `[albumIngestQueue] Job ${job?.id} failed:`,
      error?.message || error,
    );
  });

  workerInstance.on("completed", (job) => {
    console.log(`[albumIngestQueue] Job ${job?.id} completed`);
  });

  console.log("[albumIngestQueue] Worker started");
  return workerInstance;
};

export const closeAlbumIngestWorker = async () => {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }
};
