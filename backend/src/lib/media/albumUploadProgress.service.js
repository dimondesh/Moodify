import { Album } from "../../models/album.model.js";

export const setAlbumUploadProgress = async (
  albumId,
  { phase, tracksDone, tracksTotal, percent },
) => {
  if (!albumId) return;

  const update = {};
  if (phase != null) update["upload.phase"] = phase;
  if (tracksDone != null) update["upload.tracksDone"] = tracksDone;
  if (tracksTotal != null) update["upload.tracksTotal"] = tracksTotal;
  if (percent != null) update["upload.percent"] = percent;

  if (Object.keys(update).length === 0) return;

  await Album.findByIdAndUpdate(albumId, { $set: update }).setOptions({
    includeQueued: true,
  });
};

export const markAlbumUploadComplete = async (albumId) => {
  if (!albumId) return;
  await Album.findByIdAndUpdate(albumId, {
    $set: { status: "completed", ingestJobId: null },
    $unset: { upload: 1 },
  }).setOptions({ includeQueued: true });
};

export const progressPercent = (done, total) => {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
};
