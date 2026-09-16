import mongoose from "mongoose";
import { EMBEDDING_DIM } from "../../constants/embedding.js";

let songHooksRegistered = false;
let playlistHooksRegistered = false;

const hooksEnabled = () => process.env.SKIP_EMBEDDING_HOOKS !== "1";

const fireAndForget = (promise) => {
  void promise.catch((err) =>
    console.error("[EntityEmbeddingHooks]", err),
  );
};

const loadRecommendationService = () =>
  import("../../lib/recommendations/recommendation.service.js");

const hasValidSongEmbedding = (doc) => {
  const emb = doc?.audioFeatures?.embedding;
  return Array.isArray(emb) && emb.length === EMBEDDING_DIM;
};

/** Ingest/admin assign the whole audioFeatures object — use isModified, not isDirectModified. */
export const songSaveTouchesTrackEmbedding = (doc) =>
  doc.isModified("audioFeatures.embedding");

export const songSaveShouldRefreshRelated = (doc) =>
  songSaveTouchesTrackEmbedding(doc) || doc.isModified("artist");

const refreshAlbumEmbedding = (albumId) => {
  if (!albumId || !hooksEnabled()) return;
  fireAndForget(
    loadRecommendationService().then(({ updateAlbumEmbedding }) =>
      updateAlbumEmbedding(albumId),
    ),
  );
};

const refreshPlaylistEmbedding = (playlistId) => {
  if (!playlistId || !hooksEnabled()) return;
  fireAndForget(
    loadRecommendationService().then(({ updatePlaylistEmbedding }) =>
      updatePlaylistEmbedding(playlistId),
    ),
  );
};

const refreshArtistEmbedding = (artistId) => {
  if (!artistId || !hooksEnabled()) return;
  fireAndForget(
    loadRecommendationService().then(({ updateArtistEmbedding }) =>
      updateArtistEmbedding(artistId),
    ),
  );
};

const updateTouchesSongs = (update) => {
  if (!update || typeof update !== "object") return false;
  return (
    update.songs !== undefined ||
    update.$set?.songs !== undefined ||
    update.$push?.songs !== undefined ||
    update.$pull?.songs !== undefined ||
    update.$addToSet?.songs !== undefined
  );
};

const refreshSongRelatedEmbeddings = async (songDoc, previousArtistIds = []) => {
  const { Playlist } = await import("../playlist.model.js");
  const { updateAlbumEmbedding, updateArtistEmbedding, updatePlaylistEmbedding } =
    await import("../../lib/recommendations/recommendation.service.js");

  const tasks = [];

  if (songDoc.albumId) {
    tasks.push(updateAlbumEmbedding(songDoc.albumId));
  }

  const artistIds = new Set([
    ...(songDoc.artist || []).map((id) => id.toString()),
    ...(previousArtistIds || []).map((id) => id.toString()),
  ]);
  for (const artistId of artistIds) {
    tasks.push(updateArtistEmbedding(artistId));
  }

  const playlists = await Playlist.find({ songs: songDoc._id })
    .select("_id")
    .lean();
  for (const playlist of playlists) {
    tasks.push(updatePlaylistEmbedding(playlist._id));
  }

  await Promise.all(tasks);
};

function registerSongHooks(songSchema) {
  songSchema.pre("save", async function () {
    this._wasNew = this.isNew;
    if (this.isNew) return;

    const needsPrior =
      this.isModified("albumId") || this.isModified("artist");

    if (!needsPrior) return;

    const prior = await this.constructor
      .findById(this._id)
      .select("albumId artist")
      .lean();

    if (this.isModified("albumId")) {
      this._previousAlbumId = prior?.albumId ?? null;
    }
    if (this.isModified("artist")) {
      this._previousArtistIds = prior?.artist ?? [];
    }
  });

  songSchema.post("save", function () {
    // Shell create (ingest/admin): no track vector yet — wait for the audioFeatures save.
    // Avoids racing a null entity embedding write over the follow-up refresh.
    if (this._wasNew && !hasValidSongEmbedding(this)) return;

    if (this.isModified("albumId")) {
      refreshAlbumEmbedding(this.albumId);
      refreshAlbumEmbedding(this._previousAlbumId);
    }

    if (songSaveShouldRefreshRelated(this)) {
      fireAndForget(refreshSongRelatedEmbeddings(this, this._previousArtistIds));
    }
  });

  songSchema.post("deleteOne", { document: true, query: false }, function () {
    refreshAlbumEmbedding(this.albumId);
    fireAndForget(refreshSongRelatedEmbeddings(this));
  });

  songSchema.post("findOneAndDelete", function (doc) {
    if (!doc) return;
    refreshAlbumEmbedding(doc.albumId);
    fireAndForget(refreshSongRelatedEmbeddings(doc));
  });
}

function registerPlaylistHooks(playlistSchema) {
  playlistSchema.post("save", function () {
    if (this.isModified("songs")) {
      refreshPlaylistEmbedding(this._id);
    }
  });

  playlistSchema.post("findOneAndUpdate", function (doc) {
    if (!doc) return;
    if (updateTouchesSongs(this.getUpdate())) {
      refreshPlaylistEmbedding(doc._id);
    }
  });
}

export function registerEntityEmbeddingHooks() {
  if (mongoose.models.Song && !songHooksRegistered) {
    songHooksRegistered = true;
    registerSongHooks(mongoose.models.Song.schema);
  }

  if (mongoose.models.Playlist && !playlistHooksRegistered) {
    playlistHooksRegistered = true;
    registerPlaylistHooks(mongoose.models.Playlist.schema);
  }
}
