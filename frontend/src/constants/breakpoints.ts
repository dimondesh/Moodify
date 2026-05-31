/** Mobile layout — below md breakpoint. */
export const MOBILE_MEDIA_QUERY = "(max-width: 768px)";

/** Desktop layout — matches Tailwind `lg:` where LeftSidebar is visible. */
export const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

export const DESKTOP_LIBRARY_MEDIA_QUERY = DESKTOP_MEDIA_QUERY;

export function isDesktopLibraryContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(DESKTOP_LIBRARY_MEDIA_QUERY).matches;
}
