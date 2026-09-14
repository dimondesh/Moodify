import { Queue, Worker } from "bullmq";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import {
  downloadAlbumWithDeemix,
  cleanupDeemixJob,
  killDeemixJob,
} from "../integrations/deemixDownload.service.js";
import { ingestAlbumFromSpotify } from "./albumIngest.service.js";
import {
  tryAcquireUploadLock,
  clearUploadInProgress,
  touchUploadLock,
} from "./activeUploads.service.js";
import { Album } from "../../models/album.model.js";
import { deleteAlbumStubAndMedia } from "./albumStub.service.js";
import {
  markAlbumUploadComplete,
  setAlbumUploadProgress,
} from "./albumUploadProgress.service.js";

const QUEUE_NAME = "album-ingest-from-url";
const LOCK_HEARTBEAT_MS = 60 * 1000;

const getRedisConnection = () => ({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

let queueInstance = null;
let workerInstance = null;

/** albumId -> true when cancel requested for active job */
const cancelRequested = new Map();

const getQueue = () => {
  if (!queueInstance) {
    queueInstance = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return queueInstance;
};

const zipPathForAlbum = (albumId) =>
  path.join(process.cwd(), "temp", "album-ingest", String(albumId), "album.zip");

/**
 * @param {{ albumId: string, spotifyAlbumUrl: string, zipPath?: string|null }} data
 */
export const enqueueAlbumIngest = async ({
  albumId,
  spotifyAlbumUrl,
  zipPath = null,
}) => {
  const jobId = uuidv4();
  const queue = getQueue();
  await queue.add(
    "ingest",
    { albumId, spotifyAlbumUrl, zipPath },
    {
      jobId,
      removeOnComplete: { age: 3600, count: 50 },
      removeOnFail: { age: 86400, count: 100 },
      attempts: 1,
    },
  );

  await Album.findByIdAndUpdate(albumId, {
    $set: { ingestJobId: jobId },
  }).setOptions({ includeQueued: true });

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
    albumId: job.data?.albumId,
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

/**
 * Cancel queued or active ingest for an album. Deletes the album stub.
 * @returns {{ cancelled: boolean, reason: string }}
 */
export const cancelAlbumIngest = async (albumId) => {
  const album = await Album.findById(albumId).setOptions({
    includeQueued: true,
  });
  if (!album) {
    return { cancelled: false, reason: "not_found" };
  }
  if (album.status !== "queued") {
    return { cancelled: false, reason: "not_queued" };
  }

  const jobId = album.ingestJobId;
  const queue = getQueue();
  let job = jobId ? await queue.getJob(jobId) : null;

  if (!job) {
    const jobs = await queue.getJobs([
      "waiting",
      "delayed",
      "active",
      "paused",
    ]);
    job = jobs.find((j) => String(j.data?.albumId) === String(albumId)) || null;
  }

  if (job) {
    const state = await job.getState();
    if (state === "waiting" || state === "delayed" || state === "paused") {
      await job.remove();
      await deleteAlbumStubAndMedia(albumId);
      return { cancelled: true, reason: "removed_from_queue" };
    }
    if (state === "active") {
      cancelRequested.set(String(albumId), true);
      killDeemixJob(job.id);
      // Worker will delete stub on cancel/fail path
      return { cancelled: true, reason: "cancel_requested" };
    }
  }

  // No job (orphan stub)
  await deleteAlbumStubAndMedia(albumId);
  return { cancelled: true, reason: "stub_deleted" };
};

/**
 * After API crash/restart: re-enqueue queued stubs whose BullMQ job is gone
 * or terminal (failed/completed), so they are not stuck forever.
 */
export const recoverOrphanedAlbumIngests = async () => {
  const queued = await Album.find({ status: "queued" })
    .setOptions({ includeQueued: true })
    .lean();

  if (!queued.length) {
    console.log("[albumIngestQueue] Recovery: no queued stubs");
    return { requeued: 0, cleaned: 0 };
  }

  const queue = getQueue();
  let requeued = 0;
  let cleaned = 0;

  for (const album of queued) {
    const albumId = album._id.toString();
    const spotifyAlbumUrl = album.spotifyAlbumUrl;

    let job = album.ingestJobId
      ? await queue.getJob(album.ingestJobId)
      : null;

    if (job) {
      const state = await job.getState();
      // Healthy waiting queue — leave alone.
      if (
        state === "waiting" ||
        state === "delayed" ||
        state === "paused" ||
        state === "waiting-children"
      ) {
        continue;
      }
      // active after our process restart has no live holder — drop + requeue.
      // failed / completed with stub still queued — same.
      try {
        if (state === "active") {
          await job.moveToFailed(
            new Error("API restarted while job was active"),
            "0",
          );
        }
        await job.remove().catch(() => {});
      } catch (err) {
        console.warn(
          `[albumIngestQueue] Recovery: could not clear job ${job.id}:`,
          err?.message || err,
        );
      }
    }

    if (!spotifyAlbumUrl) {
      console.warn(
        `[albumIngestQueue] Recovery: cleaning stub ${albumId} (no Spotify URL)`,
      );
      await deleteAlbumStubAndMedia(albumId);
      cleaned += 1;
      continue;
    }

    const zipCandidate = zipPathForAlbum(albumId);
    const hasZip = fsSync.existsSync(zipCandidate);

    await enqueueAlbumIngest({
      albumId,
      spotifyAlbumUrl,
      zipPath: hasZip ? zipCandidate : null,
    });
    requeued += 1;
    console.log(
      `[albumIngestQueue] Recovery: re-enqueued ${albumId}` +
        (hasZip ? " (with ZIP)" : ""),
    );
  }

  console.log(
    `[albumIngestQueue] Recovery done: requeued=${requeued}, cleaned=${cleaned}`,
  );
  return { requeued, cleaned };
};

export const createAlbumIngestWorker = () => {
  if (workerInstance) return workerInstance;

  workerInstance = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { albumId, spotifyAlbumUrl, zipPath } = job.data;
      let jobRoot = null;
      let lockHeld = false;
      let heartbeat = null;

      const isCancelled = () => cancelRequested.get(String(albumId)) === true;

      const pushProgress = async (p) => {
        await setAlbumUploadProgress(albumId, p);
        await job.updateProgress({
          ...p,
          message:
            p.phase === "preparing"
              ? "Preparing..."
              : p.phase === "downloading"
                ? `Downloading ${p.tracksDone || 0}/${p.tracksTotal || 0}`
                : p.phase === "ingesting"
                  ? `Ingesting ${p.tracksDone || 0}/${p.tracksTotal || 0}`
                  : "Queued",
        });
      };

      try {
        // Wait for exclusive lock (song upload / another active job in-process).
        const lockWaitStarted = Date.now();
        const LOCK_WAIT_MS = 30 * 60 * 1000;
        while (!tryAcquireUploadLock()) {
          if (isCancelled()) {
            const err = new Error("Album ingest cancelled.");
            err.isCancelled = true;
            throw err;
          }
          if (Date.now() - lockWaitStarted > LOCK_WAIT_MS) {
            throw new Error("Timed out waiting for upload lock.");
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
        lockHeld = true;
        heartbeat = setInterval(() => touchUploadLock(), LOCK_HEARTBEAT_MS);
        heartbeat.unref?.();

        if (isCancelled()) {
          const err = new Error("Album ingest cancelled.");
          err.isCancelled = true;
          throw err;
        }

        await pushProgress({
          phase: "preparing",
          tracksDone: 0,
          percent: 0,
        });

        let audioDir = null;
        let spotifyAlbumData = null;

        if (zipPath) {
          await pushProgress({
            phase: "downloading",
            tracksDone: 0,
            tracksTotal: 0,
            percent: 0,
          });
        } else {
          const downloaded = await downloadAlbumWithDeemix(
            spotifyAlbumUrl,
            job.id,
            {
              onProgress: async (p) => {
                // Keep track counters at 0 during deemix — N/M is for ingest only.
                await pushProgress({
                  phase: "downloading",
                  tracksDone: 0,
                  tracksTotal: 0,
                  percent: p.percent ?? 0,
                });
              },
            },
          );
          audioDir = downloaded.downloadDir;
          jobRoot = downloaded.jobRoot;
          spotifyAlbumData = downloaded.spotifyAlbumData;
        }

        if (isCancelled()) {
          const err = new Error("Album ingest cancelled.");
          err.isCancelled = true;
          throw err;
        }

        const { album, songs } = await ingestAlbumFromSpotify({
          spotifyAlbumUrl,
          audioDir: audioDir || undefined,
          zipFilePath: zipPath || undefined,
          spotifyAlbumData,
          existingAlbumId: albumId,
          shouldCancel: isCancelled,
          onTrackProgress: pushProgress,
        });

        await markAlbumUploadComplete(album._id);

        return {
          message: `Album "${album.title}" (${album.type}) and ${songs.length} tracks added successfully!`,
          albumId: album._id.toString(),
          albumTitle: album.title,
          trackCount: songs.length,
        };
      } catch (error) {
        // ingest already deletes stub on failure when existingAlbumId set;
        // cancel before ingest / deemix fail may leave stub — clean up.
        const stillThere = await Album.findById(albumId).setOptions({
          includeQueued: true,
        });
        if (stillThere?.status === "queued") {
          try {
            await deleteAlbumStubAndMedia(albumId);
          } catch (cleanupErr) {
            console.error(
              "[albumIngestQueue] Failed to delete stub after error:",
              cleanupErr,
            );
          }
        }
        throw error;
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        cancelRequested.delete(String(albumId));
        await cleanupDeemixJob(jobRoot);
        if (zipPath) {
          await fs.rm(zipPath, { force: true }).catch(() => {});
          // parent album-ingest/{albumId} dir
          const parent = zipPath.replace(/[/\\][^/\\]+$/, "");
          if (parent.includes("album-ingest")) {
            await fs.rm(parent, { recursive: true, force: true }).catch(() => {});
          }
        }
        if (lockHeld) {
          clearUploadInProgress();
        }
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
      // Album deemix + per-track HLS can run 10–40+ min; default 30s lock dies mid-job.
      lockDuration: 30 * 60 * 1000,
      stalledInterval: 60 * 1000,
      maxStalledCount: 1,
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
