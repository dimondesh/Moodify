import type { ReactNode } from "react";
import type { CoverGradientLayer } from "@/hooks/useDominantCoverGradient";

interface CollectionGradientLayoutProps {
  backgrounds: CoverGradientLayer[];
  /** Bottom color of the vertical gradient (e.g. album vs playlist page tint). */
  footerTint?: string;
  midTint?: string;
  children: ReactNode;
  className?: string;
  /** Classes for the gradient + content wrapper (padding, max-width). */
  innerClassName?: string;
  /** Fixed height for the hero gradient (does not grow with page content). */
  gradientHeightClassName?: string;
}

const DEFAULT_GRADIENT_HEIGHT = "h-[85vh] max-h-[960px] min-h-[520px]";

/** Hero vertical gradient behind album or playlist content, driven by cover color. */
export function CollectionGradientLayout({
  backgrounds,
  footerTint = "#18181b",
  midTint = "rgba(20, 20, 20, 0.8)",
  children,
  className = "",
  innerClassName = "relative min-h-screen pb-36 lg:pb-0",
  gradientHeightClassName = DEFAULT_GRADIENT_HEIGHT,
}: CollectionGradientLayoutProps) {
  const top = backgrounds[0] ?? { key: 0, color: "#18181b" };

  return (
    <div className={`h-full ${className}`}>
      <div className={innerClassName} style={{ backgroundColor: footerTint }}>
        <div
          key={top.key}
          className={`absolute inset-x-0 top-0 pointer-events-none transition-[opacity] duration-700 ease-out ${gradientHeightClassName}`}
          aria-hidden="true"
          style={{
            background: `linear-gradient(to bottom, ${top.color} 0%, ${midTint} 50%, ${footerTint} 100%)`,
          }}
        />
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
}
