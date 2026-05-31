import { useUIStore } from "@/stores/useUIStore";

const LibraryPageGridSkeleton = () => (
  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
    {Array.from({ length: 15 }).map((_, i) => (
      <div
        key={i}
        className="p-2 flex flex-col items-center text-center animate-pulse"
      >
        <div className="aspect-square w-full rounded-md bg-zinc-800 shadow-lg mb-2" />
        <div className="px-1 w-full space-y-1.5">
          <div className="h-3.5 bg-zinc-800 rounded w-4/5 mx-auto" />
          <div className="h-3 bg-zinc-800/80 rounded w-1/2 mx-auto" />
        </div>
      </div>
    ))}
  </div>
);

const LibraryPageListSkeleton = () => (
  <div className="flex flex-col gap-2">
    {Array.from({ length: 10 }).map((_, i) => (
      <div key={i} className="flex items-center p-3 gap-4 animate-pulse">
        <div className="size-16 rounded-md bg-zinc-800 shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-5 bg-zinc-800 rounded w-3/4" />
          <div className="h-4 bg-zinc-800/80 rounded w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

const LibraryPageSkeleton = () => {
  const libraryViewMode = useUIStore((s) => s.libraryViewMode);

  return (
    <div className="h-full">
      <div className="relative min-h-screen p-4 sm:p-6 pb-40 sm:pb-50 lg:pb-10">
        <div
          className="absolute inset-0 bg-[#0f0f0f] pointer-events-none"
          aria-hidden="true"
        />
        <div className="relative z-10">
          <div className="flex justify-between items-baseline">
            <div className="hidden md:block h-10 sm:h-12 lg:h-16 w-48 sm:w-56 lg:w-72 bg-zinc-800 rounded animate-pulse mt-2 mb-6" />
            <div className="hidden md:block size-10 bg-zinc-800/50 rounded animate-pulse shrink-0" />
          </div>

          <div className="mb-6">
            <div className="flex gap-1.5 pb-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-7 w-20 sm:w-24 rounded-full bg-zinc-800 animate-pulse shrink-0"
                />
              ))}
            </div>
          </div>

          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-4 max-w-screen">
              <div className="flex-1">
                <div className="h-12 w-12 bg-zinc-800/50 rounded-md animate-pulse" />
              </div>
              <div className="h-12 w-12 bg-zinc-800/50 rounded-md animate-pulse shrink-0" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {libraryViewMode === "grid" ? (
              <LibraryPageGridSkeleton />
            ) : (
              <LibraryPageListSkeleton />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LibraryPageSkeleton;
