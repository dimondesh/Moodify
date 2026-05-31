const UsersListSkeleton = () => (
  <div className="flex flex-col h-full min-h-0 overflow-hidden max-w-3xl w-full mx-auto">
    <div className="flex-1 min-h-0">
      <div className="px-3 pt-3 pb-4 sm:px-5 sm:pt-4 space-y-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-3 py-3.5 rounded-xl animate-pulse"
          >
            <div className="relative shrink-0">
              <div className="size-12 rounded-full bg-zinc-800" />
              <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-zinc-800/80 ring-2 ring-[#0f0f0f]" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-4 w-32 bg-zinc-800 rounded" />
              <div className="h-3 w-24 bg-zinc-800/80 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default UsersListSkeleton;
