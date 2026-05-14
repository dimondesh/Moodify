import { memo } from "react";

/** Flat ambient fill from dominant cover color (no blur, no gradients). */
export const CoverDominantBackdrop = memo(function CoverDominantBackdrop({
  accentColor,
}: {
  accentColor: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-zinc-950">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundColor: accentColor }}
      />
      <div className="pointer-events-none absolute inset-0 bg-black/60" />
    </div>
  );
});
