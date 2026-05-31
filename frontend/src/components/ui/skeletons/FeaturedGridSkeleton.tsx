import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "../../../lib/utils";

function FeaturedGridSkeleton({ className }: { className?: string }) {
  const isMobile = useMediaQuery("(max-width: 1024px)");
  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-8",
        className
      )}
    >
      {Array.from({ length: isMobile ? 6 : 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center rounded-md overflow-hidden relative animate-pulse"
        >
          <div className="w-10 sm:w-20 h-10 sm:h-20 bg-zinc-800 shrink-0" />
          <div className="flex-1 p-4 space-y-2">
            <div className="h-4 bg-zinc-800 rounded w-3/4" />
            <div className="h-3 bg-zinc-800/80 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default FeaturedGridSkeleton;
