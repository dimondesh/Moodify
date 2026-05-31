import { cn } from "@/lib/utils";

type CardGridSkeletonProps = {
  count?: number;
  className?: string;
};

const CardGridSkeleton = ({ count = 6, className }: CardGridSkeletonProps) => (
  <div
    className={cn(
      "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3",
      className,
    )}
  >
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="aspect-square rounded-xl bg-zinc-800 animate-pulse" />
    ))}
  </div>
);

export default CardGridSkeleton;
