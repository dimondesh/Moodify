/** Brand copy for SEO, OG, PWA. Keep in sync with `frontend/index.html` static meta. */
export const SITE_NAME = "Moodify Music";
export const SITE_SLOGAN = "Your music — your vibe";
export const SITE_URL = "https://moodify-music.com/";
/** Domain fallback for Google site name (must be lowercase). */
export const SITE_DOMAIN = "moodify-music.com";
/** System playlists (owner === null) use this instead of a user avatar. */
export const SITE_BRAND_AVATAR = "/Moodify-transparent.svg";

export const playlistOwnerLabel = (
  owner: { fullName?: string } | null | undefined,
  unknownLabel: string,
) => (owner == null ? SITE_NAME : owner.fullName || unknownLabel);
