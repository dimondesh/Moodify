/** iPhone / iPod / iPad (Safari native HLS, no Web Audio graph). */
export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}
