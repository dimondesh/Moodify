import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DESKTOP_MEDIA_QUERY } from "@/constants/breakpoints";
import { cn } from "../../../lib/utils";

function FeaturedGridSkeleton({ className }: { className?: string }) {
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const itemCount = isDesktop ? 8 : 6;

  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-8",
        className
      )}
    >
      {Array.from({ length: itemCount }).map((_, i) => (
        <div
          key={i}
          className="flex items-center bg-zinc-800/50 rounded-md overflow-hidden relative animate-pulse"
        >
          <div className="flex-shrink-0 w-14 h-14 sm:w-20 sm:h-20 bg-zinc-800" />
          <div className="flex-1 p-2 sm:p-3 min-w-0 space-y-1.5 sm:space-y-2">
            <div className="h-3.5 sm:h-4 bg-zinc-800 rounded w-3/4" />
            <div className="hidden sm:block h-3 bg-zinc-800/80 rounded w-1/2" />
          </div>
          <div className="hidden sm:block absolute bottom-3 right-2 w-8 h-8 rounded-full bg-zinc-800/80" />
        </div>
      ))}
    </div>
  );
}

export default FeaturedGridSkeleton;
