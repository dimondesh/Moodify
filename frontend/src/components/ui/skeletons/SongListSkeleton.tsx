type SongListSkeletonProps = {
  rows?: number;
  showTitle?: boolean;
};

const SongListSkeleton = ({ rows = 5, showTitle = false }: SongListSkeletonProps) => (
  <div>
    {showTitle && (
      <div className="h-8 w-48 bg-zinc-800 rounded mb-4 animate-pulse" />
    )}
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 sm:gap-4 p-2 rounded-md animate-pulse"
        >
          <div className="w-4 h-4 bg-zinc-800 rounded shrink-0" />
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-zinc-800 rounded-md shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 sm:h-4 bg-zinc-800 rounded w-3/4" />
            <div className="h-2 sm:h-3 bg-zinc-800 rounded w-1/2" />
          </div>
          <div className="w-8 h-8 bg-zinc-800 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  </div>
);

export default SongListSkeleton;
