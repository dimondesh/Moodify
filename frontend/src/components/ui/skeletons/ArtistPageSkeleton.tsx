import HorizontalSectionSkeleton from "@/pages/HomePage/HorizontalSectionSkeleton";
import SongListSkeleton from "./SongListSkeleton";

const ArtistPageSkeleton = () => (
  <div className="bg-[#0f0f0f] h-full">
    <div className="w-full h-[340px] sm:h-[300px] lg:h-[450px] bg-zinc-800 animate-pulse" />
    <div className="p-4 sm:p-6 space-y-8">
      <SongListSkeleton rows={5} showTitle />
      <HorizontalSectionSkeleton />
      <HorizontalSectionSkeleton />
      <HorizontalSectionSkeleton />
    </div>
  </div>
);

export default ArtistPageSkeleton;
