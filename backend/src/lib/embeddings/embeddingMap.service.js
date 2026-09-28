import axios from "axios";
import { Song } from "../../models/song.model.js";
import { Album } from "../../models/album.model.js";
import { Artist } from "../../models/artist.model.js";
import { Playlist } from "../../models/playlist.model.js";
import { EmbeddingMap } from "../../models/embeddingMap.model.js";
import { projectEmbeddingsTo2d } from "./projectTo2d.js";

export const EMBEDDING_MAP_ENTITIES = [
  "tracks",
  "albums",
  "artists",
  "playlists",
];

const PROJECT_2D_TIMEOUT_MS = 10 * 60 * 1000;

function embeddingServiceUrl() {
  return process.env.EMBEDDING_SERVICE_URL || "http://127.0.0.1:5006";
}

/**
 * Prefer sklearn Barnes-Hut via embedding service; fall back to local JS
 * (PCA-only for large n) if the service is down.
 */
async function projectEmbeddings(embeddings) {
  if (!embeddings.length) return { points: [], method: "pca" };
  try {
    const { data } = await axios.post(
      `${embeddingServiceUrl()}/project-2d`,
      { embeddings },
      {
        timeout: PROJECT_2D_TIMEOUT_MS,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      },
    );
    if (!Array.isArray(data?.points) || data.points.length !== embeddings.length) {
      throw new Error(
        `bad project-2d response (got ${data?.points?.length ?? 0}, expected ${embeddings.length})`,
      );
    }
    return {
      points: data.points,
      method: data.method || "pca+tsne",
    };
  } catch (error) {
    console.warn(
      `[embedding-map] remote project-2d failed, local fallback: ${error.message}`,
    );
    return projectEmbeddingsTo2d(embeddings);
  }
}

function topPrediction(predictions) {
  if (!Array.isArray(predictions) || predictions.length === 0) return null;
  let best = predictions[0];
  for (const p of predictions) {
    if ((p?.probability ?? 0) > (best?.probability ?? 0)) best = p;
  }
  return best?.name || null;
}

function labelFromRefs(refs) {
  if (!Array.isArray(refs) || refs.length === 0) return null;
  const first = refs[0];
  if (typeof first === "string") return first;
  return first?.name || null;
}

function majorityDim(items, getEmbedding) {
  const counts = new Map();
  for (const item of items) {
    const emb = getEmbedding(item);
    if (!Array.isArray(emb) || emb.length < 2) continue;
    counts.set(emb.length, (counts.get(emb.length) || 0) + 1);
  }
  let bestDim = null;
  let bestCount = 0;
  for (const [dim, count] of counts) {
    if (count > bestCount) {
      bestDim = dim;
      bestCount = count;
    }
  }
  return bestDim;
}

function fingerprintFromRows(rows) {
  let maxId = "";
  for (const row of rows) {
    const id = String(row._id);
    if (id > maxId) maxId = id;
  }
  return `${rows.length}:${maxId}`;
}

async function projectEntityRows(rows, getEmbedding) {
  const dim = majorityDim(rows, getEmbedding);
  if (!dim) {
    return { points: [], dimensions: 0, method: "pca" };
  }

  const usable = rows.filter((row) => getEmbedding(row)?.length === dim);
  const embeddings = usable.map(getEmbedding);
  const { points: projected, method } = await projectEmbeddings(embeddings);

  const points = usable.map((row, i) => ({
    id: String(row._id),
    title: row._mapTitle || "Unknown",
    x: projected[i].x,
    y: projected[i].y,
    group: row._mapGroup || "Unknown",
    sub: row._mapSub || "Unknown",
  }));

  points.sort((a, b) => a.group.localeCompare(b.group));
  return { points, dimensions: dim, method };
}

async function loadTrackMapRows() {
  const songs = await Song.find({
    "audioFeatures.embedding.0": { $exists: true },
  })
    .select(
      "title genres moods audioFeatures.embedding audioFeatures.predictedGenres audioFeatures.predictedMoods",
    )
    .populate("genres", "name")
    .populate("moods", "name")
    .lean()
    .exec();

  return songs.map((song) => {
    const af = song.audioFeatures || {};
    return {
      ...song,
      _mapTitle: song.title || "Unknown",
      _mapGroup:
        topPrediction(af.predictedGenres) ||
        labelFromRefs(song.genres) ||
        "Unknown",
      _mapSub:
        topPrediction(af.predictedMoods) ||
        labelFromRefs(song.moods) ||
        "Unknown",
    };
  });
}

async function loadAlbumMapRows() {
  const albums = await Album.find({ "embedding.0": { $exists: true } })
    .select("title type artist embedding")
    .populate("artist", "name")
    .lean()
    .exec();

  return albums.map((album) => ({
    ...album,
    _mapTitle: album.title || "Unknown",
    _mapGroup: album.type || "Album",
    _mapSub: labelFromRefs(album.artist) || "Unknown",
  }));
}

async function loadArtistMapRows() {
  const artists = await Artist.find({ "embedding.0": { $exists: true } })
    .select("name embedding")
    .lean()
    .exec();

  return artists.map((artist) => ({
    ...artist,
    _mapTitle: artist.name || "Unknown",
    _mapGroup: "Artist",
    _mapSub: "Unknown",
  }));
}

async function loadPlaylistMapRows() {
  const playlists = await Playlist.find({ "embedding.0": { $exists: true } })
    .select("title type sourceName embedding")
    .lean()
    .exec();

  return playlists.map((playlist) => ({
    ...playlist,
    _mapTitle: playlist.title || "Unknown",
    _mapGroup: playlist.type || "USER_CREATED",
    _mapSub: playlist.sourceName || "Unknown",
  }));
}

const EMBEDDING_MAP_LOADERS = {
  tracks: {
    load: loadTrackMapRows,
    getEmbedding: (row) => row.audioFeatures?.embedding,
  },
  albums: {
    load: loadAlbumMapRows,
    getEmbedding: (row) => row.embedding,
  },
  artists: {
    load: loadArtistMapRows,
    getEmbedding: (row) => row.embedding,
  },
  playlists: {
    load: loadPlaylistMapRows,
    getEmbedding: (row) => row.embedding,
  },
};

function normalizeEntity(entityRaw) {
  const entity = String(entityRaw || "tracks").toLowerCase();
  return EMBEDDING_MAP_LOADERS[entity] ? entity : "tracks";
}

function toResponse(doc) {
  if (!doc) {
    return {
      points: [],
      meta: {
        entity: "tracks",
        count: 0,
        dimensions: 0,
        method: "pca",
        updatedAt: null,
      },
    };
  }
  return {
    points: doc.points ?? [],
    meta: {
      entity: doc.entity,
      count: doc.points?.length ?? 0,
      dimensions: doc.dimensions ?? 0,
      method: doc.method ?? "pca",
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    },
  };
}

export async function getCachedEmbeddingMap(entityRaw) {
  const entity = normalizeEntity(entityRaw);
  let doc = await EmbeddingMap.findOne({ entity }).lean().exec();
  // First open after deploy: build once via embedding service (sklearn t-SNE).
  if (!doc) {
    await rebuildEmbeddingMap(entity, { force: true });
    doc = await EmbeddingMap.findOne({ entity }).lean().exec();
  }
  if (!doc) {
    return {
      points: [],
      meta: {
        entity,
        count: 0,
        dimensions: 0,
        method: "pca",
        updatedAt: null,
      },
    };
  }
  return toResponse(doc);
}

/**
 * Rebuild one entity map. Skips projection when fingerprint matches
 * unless force=true.
 * @returns {{ entity: string, rebuilt: boolean, count: number }}
 */
export async function rebuildEmbeddingMap(entityRaw, { force = false } = {}) {
  const entity = normalizeEntity(entityRaw);
  const { load, getEmbedding } = EMBEDDING_MAP_LOADERS[entity];
  const rows = await load();
  const fingerprint = fingerprintFromRows(rows);

  if (!force) {
    const existing = await EmbeddingMap.findOne({ entity })
      .select("sourceFingerprint")
      .lean()
      .exec();
    if (existing?.sourceFingerprint === fingerprint) {
      return { entity, rebuilt: false, count: rows.length };
    }
  }

  const { points, dimensions, method } = await projectEntityRows(
    rows,
    getEmbedding,
  );
  const updatedAt = new Date();

  await EmbeddingMap.findOneAndUpdate(
    { entity },
    {
      entity,
      points,
      dimensions,
      method,
      sourceFingerprint: fingerprint,
      updatedAt,
    },
    { upsert: true, new: true },
  );

  return { entity, rebuilt: true, count: points.length };
}

/**
 * Rebuild all entity maps when source fingerprints changed.
 * @returns {{ rebuilt: string[], skipped: string[] }}
 */
export async function refreshEmbeddingMapsIfNeeded({ force = false } = {}) {
  const rebuilt = [];
  const skipped = [];

  for (const entity of EMBEDDING_MAP_ENTITIES) {
    const result = await rebuildEmbeddingMap(entity, { force });
    if (result.rebuilt) rebuilt.push(entity);
    else skipped.push(entity);
  }

  return { rebuilt, skipped };
}
