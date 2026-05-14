import { memo } from "react";

export type CoverDominantBackdropVariant = "solid" | "hero";

type Props = {
  accentColor: string;
  /**
   * `solid` — как на текстах песен: плоский акцент + затемнение.
   * `hero` — градиент сверху вниз в прозрачность (шапка профиля / обложка).
   */
  variant?: CoverDominantBackdropVariant;
};

/** Ambient fill from dominant cover color (плоский или градиент «hero»). */
export const CoverDominantBackdrop = memo(function CoverDominantBackdrop({
  accentColor,
  variant = "solid",
}: Props) {
  if (variant === "hero") {
    return (
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#0f0f0f]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, ${accentColor}, transparent)`,
          }}
        />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-zinc-950">
      <div
        className="pointer-events-none absolute inset-0 transition-[background-color] duration-300 ease-out"
        style={{ backgroundColor: accentColor }}
      />
      <div className="pointer-events-none absolute inset-0 bg-black/60" />
    </div>
  );
});
