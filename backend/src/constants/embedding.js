export const EMBEDDING_DIM = 50;
export const ARTIST_TOP_TRACKS_LIMIT = 20;

/** Song must have a full-dimension audio embedding (used for centroids + hub eligibility). */
export const VALID_SONG_EMBEDDING = {
  "audioFeatures.embedding": {
    $exists: true,
    $ne: null,
    $size: EMBEDDING_DIM,
  },
};

/** Album / Artist / Playlist entity embedding filter. */
export const VALID_ENTITY_EMBEDDING = {
  embedding: { $exists: true, $ne: null, $size: EMBEDDING_DIM },
};

export const TASTE_ONBOARDING_MIN_ARTISTS = 3;
export const TASTE_ONBOARDING_MAX_ARTISTS = 20;
export const ONBOARDING_ARTISTS_LIMIT = 120;
export const ONBOARDING_ARTISTS_POOL_SIZE = 150;
export const ONBOARDING_ARTISTS_PAGE_SIZE = 12;
