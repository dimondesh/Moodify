import { useParams } from "react-router-dom";
import EntitySectionCardSkeleton from "@/components/ui/skeletons/EntitySectionCardSkeleton";
import SongListSkeleton from "@/components/ui/skeletons/SongListSkeleton";
import { useAuthStore } from "@/stores/useAuthStore";

const FixedRowSectionSkeleton = () => (
  <div className="mb-12 mt-12">
    <div className="flex justify-between items-center mb-4">
      <div className="h-7 sm:h-8 w-40 sm:w-56 max-w-[70%] bg-zinc-800 rounded animate-pulse" />
      <div className="h-4 w-16 bg-zinc-800/80 rounded animate-pulse shrink-0" />
    </div>
    <div className="flex flex-nowrap gap-1 sm:gap-2 overflow-x-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <EntitySectionCardSkeleton key={i} />
      ))}
    </div>
  </div>
);

const PlaylistRowSkeleton = () => (
  <div className="flex items-center gap-4 p-2 rounded-md animate-pulse">
    <div className="w-14 h-14 rounded-md bg-zinc-800 shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <div className="h-4 bg-zinc-800 rounded w-3/5" />
      <div className="h-3 bg-zinc-800/80 rounded w-2/5" />
    </div>
  </div>
);

const ProfilePageSkeleton = () => {
  const { userId } = useParams<{ userId: string }>();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isMyProfile = currentUserId === userId;

  return (
    <div className="relative min-h-screen pb-40 lg:pb-0 bg-[#0f0f0f]">
      <div className="relative z-10 p-4 pt-8 sm:pt-16 sm:p-8">
        <div className="flex flex-col items-center sm:flex-row sm:items-end gap-4">
          <div className="w-24 h-24 sm:w-48 sm:h-48 rounded-full bg-zinc-800 animate-pulse shrink-0 shadow-2xl" />
          <div className="flex flex-col gap-1 items-center sm:items-start w-full">
            <div className="hidden sm:block h-4 w-16 bg-zinc-800 rounded animate-pulse" />
            <div className="h-10 sm:h-12 lg:h-16 w-48 sm:w-64 lg:w-80 max-w-full bg-zinc-800 rounded animate-pulse" />
            <div className="flex flex-row flex-wrap justify-center sm:justify-start gap-x-2 sm:gap-x-4 gap-y-1 mt-1">
              <div className="hidden sm:block h-4 w-24 bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center sm:justify-start">
          <div className="h-10 w-28 bg-zinc-800 rounded-full animate-pulse" />
        </div>

        <div className="mt-8 sm:hidden">
          <div className="h-7 w-32 bg-zinc-800 rounded animate-pulse mb-2" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <PlaylistRowSkeleton key={i} />
            ))}
          </div>
        </div>

        <div className="mt-12">
          <div className="sm:hidden">
            <div className="h-7 w-56 max-w-[80%] bg-zinc-800 rounded animate-pulse mb-4" />
            <SongListSkeleton rows={4} />
          </div>
          <div className="hidden sm:block">
            <FixedRowSectionSkeleton />
          </div>
        </div>

        {isMyProfile && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-4">
              <div className="h-7 sm:h-8 w-48 max-w-[70%] bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-16 bg-zinc-800/80 rounded animate-pulse shrink-0" />
            </div>
            <SongListSkeleton rows={5} />
          </div>
        )}

        <div className="hidden sm:block mt-12 space-y-12">
          <FixedRowSectionSkeleton />
          <FixedRowSectionSkeleton />
          <FixedRowSectionSkeleton />
        </div>
      </div>
    </div>
  );
};

export default ProfilePageSkeleton;
