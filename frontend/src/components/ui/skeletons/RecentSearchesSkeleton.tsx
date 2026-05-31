const RecentSearchesSkeleton = () => (
  <div className="px-3 py-2 space-y-1">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-3 py-2 animate-pulse">
        <div className="size-10 rounded-full bg-zinc-800 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-32 bg-zinc-800 rounded" />
          <div className="h-2 w-24 bg-zinc-800/80 rounded" />
        </div>
      </div>
    ))}
  </div>
);

export default RecentSearchesSkeleton;
