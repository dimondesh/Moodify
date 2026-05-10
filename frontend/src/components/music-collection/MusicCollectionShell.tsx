import type { ReactNode } from "react";
import type { BackgroundLayer } from "@/hooks/useCollectionDominantBackground";

interface MusicCollectionShellProps {
  backgrounds: BackgroundLayer[];
  /** Bottom color of the vertical gradient (e.g. album vs playlist page tint). */
  footerTint?: string;
  midTint?: string;
  children: ReactNode;
  className?: string;
  /** Classes for the gradient + content wrapper (padding, max-width). */
  innerClassName?: string;
}

export function MusicCollectionShell({
  backgrounds,
  footerTint = "#18181b",
  midTint = "rgba(20, 20, 20, 0.8)",
  children,
  className = "",
  innerClassName = "relative min-h-screen pb-36 lg:pb-0",
}: MusicCollectionShellProps) {
  const top = backgrounds[0] ?? { key: 0, color: "#18181b" };

  return (
    <div className={`h-full ${className}`}>
      <div className={innerClassName}>
        <div
          key={top.key}
          className="absolute inset-0 pointer-events-none transition-[opacity] duration-700 ease-out"
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
