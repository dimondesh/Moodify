import mongoose from "mongoose";

let songHooksRegistered = false;
let playlistHooksRegistered = false;

const fireAndForget = (promise) => {
  void promise.catch((err) =>
    console.error("[EntityEmbeddingHooks]", err),
  );
};

const loadRecommendationService = () =>
  import("../../lib/recommendation.service.js");

const refreshAlbumEmbedding = (albumId) => {
  if (!albumId) return;
  fireAndForget(
    loadRecommendationService().then(({ updateAlbumEmbedding }) =>
      updateAlbumEmbedding(albumId),
    ),
  );
};

const refreshPlaylistEmbedding = (playlistId) => {
  if (!playlistId) return;
  fireAndForget(
    loadRecommendationService().then(({ updatePlaylistEmbedding }) =>
      updatePlaylistEmbedding(playlistId),
    ),
  );
};

const refreshArtistEmbedding = (artistId) => {
  if (!artistId) return;
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
    await import("../../lib/recommendation.service.js");

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
    if (this.isNew) return;

    const needsPrior =
      this.isModified("albumId") ||
      this.isModified("artist") ||
      this.isDirectModified("audioFeatures.embedding");

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
    if (this.isModified("albumId")) {
      refreshAlbumEmbedding(this.albumId);
      refreshAlbumEmbedding(this._previousAlbumId);
    }

    if (
      this.isDirectModified("audioFeatures.embedding") ||
      this.isModified("artist")
    ) {
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
