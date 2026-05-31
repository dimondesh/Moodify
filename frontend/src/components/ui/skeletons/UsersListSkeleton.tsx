const UsersListSkeleton = () => {
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0">
        <div className="px-3 pt-3 pb-4 sm:px-5 sm:pt-4 space-y-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-3 py-3.5 rounded-xl animate-pulse"
            >
              <div className="relative shrink-0">
                <div className="size-12 rounded-full bg-zinc-800" />
                <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-zinc-800/80" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="h-4 w-28 bg-zinc-800 rounded mb-2" />
                <div className="h-3 w-36 bg-zinc-800/80 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UsersListSkeleton;
