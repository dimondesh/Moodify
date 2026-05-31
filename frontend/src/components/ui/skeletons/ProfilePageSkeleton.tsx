import HorizontalSectionSkeleton from "@/pages/HomePage/HorizontalSectionSkeleton";

const ProfilePageSkeleton = () => (
  <div className="relative min-h-screen bg-[#0f0f0f] p-4 pt-8 sm:pt-16 sm:p-8">
    <div className="flex flex-col items-center sm:flex-row sm:items-end gap-4">
      <div className="w-24 h-24 sm:w-48 sm:h-48 rounded-full bg-zinc-800 animate-pulse shrink-0" />
      <div className="flex flex-col gap-2 items-center sm:items-start w-full max-w-lg">
        <div className="h-4 w-20 bg-zinc-800 rounded animate-pulse" />
        <div className="h-12 sm:h-16 w-3/4 bg-zinc-800 rounded animate-pulse" />
        <div className="flex gap-4 mt-1">
          <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
          <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>
    </div>
    <div className="mt-6 h-10 w-28 bg-zinc-800 rounded-full animate-pulse" />
    <div className="mt-10 space-y-8">
      <HorizontalSectionSkeleton />
      <HorizontalSectionSkeleton />
    </div>
  </div>
);

export default ProfilePageSkeleton;
