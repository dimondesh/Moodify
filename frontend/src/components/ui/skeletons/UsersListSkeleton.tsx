const UsersListSkeleton = () => {
  return (
    <div className="flex flex-col h-full bg-[#0f0f0f] rounded-lg overflow-hidden">
      <div className="p-4 border-b border-[#2a2a2a]">
        <div className="h-6 w-24 bg-zinc-800 rounded animate-pulse" />
      </div>
      <div className="flex-1 pr-2 -mr-2">
        <div className="p-2 space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg animate-pulse"
            >
              <div className="relative">
                <div className="h-10 w-10 rounded-full bg-zinc-800" />
                <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-zinc-800" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="h-4 w-24 bg-zinc-800 rounded mb-1" />
                <div className="h-3 w-32 bg-zinc-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UsersListSkeleton;
