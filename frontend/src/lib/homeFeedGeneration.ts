export const HOME_FEED_GENERATING_KEY = "moodify:generating-home-feed";

export function markHomeFeedGenerating() {
  try {
    sessionStorage.setItem(HOME_FEED_GENERATING_KEY, "1");
  } catch {
    // ignore
  }
}

export function clearHomeFeedGenerating() {
  try {
    sessionStorage.removeItem(HOME_FEED_GENERATING_KEY);
  } catch {
    // ignore
  }
}

export function isHomeFeedGenerating() {
  try {
    return sessionStorage.getItem(HOME_FEED_GENERATING_KEY) === "1";
  } catch {
    return false;
  }
}
