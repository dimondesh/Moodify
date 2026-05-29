/** Matches `lg:` breakpoint where LeftSidebar is visible in MainLayout. */
export const DESKTOP_LIBRARY_MEDIA_QUERY = "(min-width: 1024px)";

export function isDesktopLibraryContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(DESKTOP_LIBRARY_MEDIA_QUERY).matches;
}
