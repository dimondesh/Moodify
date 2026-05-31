const PlaylistDetailsSkeleton = () => {
  return (
    <div className="h-full">
      <div className="relative min-h-screen p-4 sm:p-6 pb-24 md:pb-0">
        <div
          className="absolute inset-0 bg-gradient-to-b from-zinc-900/80 via-zinc-900/80
          to-zinc-900 pointer-events-none"
          aria-hidden="true"
        />
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 mb-8">
            <div className="w-64 h-64 md:w-56 md:h-56 lg:w-64 lg:h-64 rounded-md shadow-xl shrink-0 bg-zinc-800 animate-pulse" />
            <div className="flex flex-col text-center md:text-left w-full max-w-lg animate-pulse">
              <div className="h-4 w-24 mb-2 bg-zinc-800 rounded" />
              <div className="h-10 w-3/4 mb-2 bg-zinc-800 rounded" />
              <div className="h-6 w-1/2 mb-4 bg-zinc-800/80 rounded" />
              <div className="flex items-center gap-2">
                <div className="h-4 w-20 bg-zinc-800/80 rounded" />
                <div className="h-4 w-12 bg-zinc-800/80 rounded" />
                <div className="h-4 w-16 bg-zinc-800/80 rounded" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-8 mb-6">
            <div className="w-16 h-16 rounded-full bg-zinc-800 animate-pulse" />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-md animate-pulse"
              >
                <div className="flex items-center gap-4 w-full">
                  <div className="h-4 w-4 bg-zinc-800 rounded-full shrink-0" />
                  <div className="flex flex-col w-full gap-2">
                    <div className="h-5 w-3/4 bg-zinc-800 rounded" />
                    <div className="h-4 w-1/2 bg-zinc-800/80 rounded" />
                  </div>
                </div>
                <div className="h-4 w-12 bg-zinc-800/80 rounded shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaylistDetailsSkeleton;
