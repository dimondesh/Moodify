import { cn } from "../../../lib/utils";

function PlaylistSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 p-2", className)}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-3">
          <div className="size-12 rounded-md bg-zinc-800 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-zinc-800 rounded w-4/5 animate-pulse" />
            <div className="h-3 bg-zinc-800 rounded w-2/5 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default PlaylistSkeleton;
