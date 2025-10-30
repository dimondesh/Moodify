import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "../../../lib/utils";

function FeaturedGridSkeleton({ className }: { className?: string }) {
  const isMobile = useMediaQuery("(max-width: 1024px)");
  return (
    <div
      className={cn(
        "grid grid-cols-2  sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8",
        className
      )}
    >
      {Array.from({ length: isMobile ? 6 : 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center bg-zinc-800/50 rounded-md overflow-hidden relative"
        >
          <div className="w-10 sm:w-20 h-10 sm:h-20 object-cover flex-shrink-0 animate-pulse" />
          <div className="flex-1 p-4 space-y-2">
            <div className="h-4 bg-zinc-700 rounded w-3/4 animate-pulse" />
            <div className="h-3 bg-zinc-700 rounded w-1/2 animate-pulse" />
          </div>
          {/* Play button placeholder */}
          <div className="absolute bottom-4 right-4 bg-zinc-600 rounded-full size-12 opacity-0 group-hover:opacity-100 transition-opacity animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export default FeaturedGridSkeleton;
