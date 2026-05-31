import { cn } from "@/lib/utils";

type EntitySectionCardSkeletonProps = {
  className?: string;
};

/** Matches EntitySectionCard layout: w-36 sm:w-44, cover + title + subtitle. */
const EntitySectionCardSkeleton = ({ className }: EntitySectionCardSkeletonProps) => (
  <div
    className={cn(
      "w-36 sm:w-44 shrink-0 p-2 animate-pulse",
      className,
    )}
  >
    <div className="relative mb-2">
      <div className="aspect-square rounded-md bg-zinc-800 shadow-lg" />
    </div>
    <div className="px-1 space-y-2">
      <div className="h-3.5 bg-zinc-800 rounded w-4/5" />
      <div className="h-3 bg-zinc-800/80 rounded w-3/5" />
    </div>
  </div>
);

export default EntitySectionCardSkeleton;
