import { Queue, Worker } from "bullmq";
import fs from "fs/promises";
import path from "path";
import { Song } from "../../models/song.model.js";
import { separateInstrumentalFromUrl } from "../integrations/modalDemucs.service.js";
import {
  downloadTrackWithDeemix,
  cleanupDeemixJob,
} from "../integrations/deemixDownload.service.js";
import {
  uploadToBunny,
  deleteFromBunny,
  getPathFromUrl,
} from "./bunny.service.js";
import { processAndUploadSong } from "./songUpload.service.js";

const QUEUE_NAME = "instrumental-separate";

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

const findBlockingJobForSong = async (queue, songId) => {
  const jobs = await queue.getJobs([
    "waiting",
    "delayed",
    "paused",
    "waiting-children",
    "active",
  ]);
  return (
    jobs.find((j) => String(j.data?.songId) === String(songId)) || null
  );
};

/** @returns {Promise<boolean>} */
export const hasActiveInstrumentalJob = async (songId) => {
  const job = await findBlockingJobForSong(getQueue(), songId);
  return Boolean(job);
};

/**
 * Enqueue instrumental generation if no job is already running for this song.
 * @param {string} songId
 * @returns {Promise<{ enqueued: boolean, jobId?: string }>}
 */
export const enqueueInstrumentalJob = async (songId) => {
  const queue = getQueue();
  const existing = await findBlockingJobForSong(queue, songId);
  if (existing) {
    return { enqueued: false, jobId: String(existing.id) };
  }

  const job = await queue.add(
    "separate",
    { songId: String(songId) },
    {
      removeOnComplete: 50,
      removeOnFail: 50,
      attempts: 1,
    },
  );

  return { enqueued: true, jobId: String(job.id) };
};

/**
 * Prefer deemix MP3 staged on Bunny; fall back to song HLS if deemix misses.
 * @returns {Promise<{ audioUrl: string, deemixJobRoot: string|null, tempBunnyPath: string|null }>}
 */
const resolveSourceAudio = async (song, songId, artistName) => {
  try {
    console.log(
      `[instrumentalQueue] Deemix download for ${songId}: ${artistName} - ${song.title}`,
    );
    const downloaded = await downloadTrackWithDeemix({
      title: song.title,
      artistName,
      jobId: `instr-${songId}`,
    });
    try {
      const uploaded = await uploadToBunny(
        downloaded.audioPath,
        "temp/instrumental-src",
      );
      return {
        audioUrl: uploaded.url,
        deemixJobRoot: downloaded.jobRoot,
        tempBunnyPath: getPathFromUrl(uploaded.url),
      };
    } catch (err) {
      await cleanupDeemixJob(downloaded.jobRoot);
      throw err;
    }
  } catch (err) {
    console.warn(
      `[instrumentalQueue] Deemix failed for ${songId}, falling back to HLS:`,
      err.message,
    );
    if (!song.hlsUrl) {
      throw new Error(
        `Deemix failed and song has no hlsUrl: ${err.message}`,
      );
    }
    return {
      audioUrl: song.hlsUrl,
      deemixJobRoot: null,
      tempBunnyPath: null,
    };
  }
};

export const createInstrumentalWorker = () => {
  if (workerInstance) return workerInstance;

  workerInstance = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { songId } = job.data;
      if (!songId) throw new Error("songId required");

      const song = await Song.findById(songId).populate("artist", "name");
      if (!song) throw new Error(`Song ${songId} not found`);

      if (song.instrumentalUrl) {
        return { skipped: true, instrumentalUrl: song.instrumentalUrl };
      }

      const artistName = Array.isArray(song.artist)
        ? song.artist.map((a) => a?.name).filter(Boolean).join(" ")
        : "";

      const tempDir = path.join(process.cwd(), "temp", "instrumental");
      const outMp3 = path.join(tempDir, `${songId}.mp3`);
      let deemixJobRoot = null;
      let tempBunnyPath = null;

      try {
        const source = await resolveSourceAudio(song, songId, artistName);
        deemixJobRoot = source.deemixJobRoot;
        tempBunnyPath = source.tempBunnyPath;

        console.log(`[instrumentalQueue] Modal demucs for ${songId}`);
        await separateInstrumentalFromUrl(source.audioUrl, outMp3);
        const { hlsUrl } = await processAndUploadSong(outMp3);

        await Song.findByIdAndUpdate(songId, { instrumentalUrl: hlsUrl });
        return { instrumentalUrl: hlsUrl };
      } finally {
        await fs.rm(outMp3, { force: true }).catch(() => {});
        if (deemixJobRoot) await cleanupDeemixJob(deemixJobRoot);
        if (tempBunnyPath) {
          await deleteFromBunny(tempBunnyPath).catch((err) =>
            console.warn(
              `[instrumentalQueue] Failed to delete temp source ${tempBunnyPath}:`,
              err.message,
            ),
          );
        }
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
      lockDuration: 15 * 60 * 1000,
      stalledInterval: 60 * 1000,
      maxStalledCount: 1,
    },
  );

  workerInstance.on("failed", (job, error) => {
    console.error(
      `[instrumentalQueue] Job ${job?.id} failed:`,
      error?.message || error,
    );
  });

  workerInstance.on("completed", (job) => {
    console.log(`[instrumentalQueue] Job ${job?.id} completed`);
  });

  console.log(
    "[instrumentalQueue] Worker started; Modal configured:",
    Boolean(process.env.MODAL_DEMUCS_URL && process.env.MODAL_DEMUCS_SECRET),
  );
  return workerInstance;
};

export const closeInstrumentalWorker = async () => {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }
};
