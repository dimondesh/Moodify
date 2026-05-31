const SharedContentSkeleton = () => (
  <div className="mt-2 w-full max-w-sm p-3 rounded-lg h-[124px] flex gap-3 animate-pulse">
    <div className="w-16 h-16 rounded-md bg-zinc-800 shrink-0" />
    <div className="flex-1 space-y-2 pt-1">
      <div className="h-4 w-3/4 bg-zinc-800 rounded" />
      <div className="h-3 w-1/2 bg-zinc-800/80 rounded" />
    </div>
  </div>
);

export default SharedContentSkeleton;
