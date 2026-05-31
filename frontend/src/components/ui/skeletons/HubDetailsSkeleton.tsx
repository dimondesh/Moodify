import HorizontalSectionSkeleton from "@/pages/HomePage/HorizontalSectionSkeleton";

const HubDetailsSkeleton = () => (
  <div className="relative min-h-screen bg-[#121212]">
    <div className="px-4 sm:px-6 pt-8 pb-20 sm:pt-12 sm:pb-28">
      <div className="h-12 sm:h-16 w-2/3 max-w-xl bg-zinc-800 rounded animate-pulse" />
    </div>
    <div className="p-4 sm:p-6 space-y-8">
      <HorizontalSectionSkeleton />
      <HorizontalSectionSkeleton />
      <HorizontalSectionSkeleton />
    </div>
  </div>
);

export default HubDetailsSkeleton;
