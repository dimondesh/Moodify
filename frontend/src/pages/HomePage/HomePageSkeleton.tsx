// src/pages/HomePage/HomePageSkeleton.tsx

import FeaturedGridSkeleton from "../../components/ui/skeletons/FeaturedGridSkeleton";
import HorizontalSectionSkeleton from "./HorizontalSectionSkeleton";

const HomePageSkeleton = () => {
  return (
    <div className="p-2 sm:p-6">
      <div className="h-8 w-48 bg-zinc-800 rounded mb-4 animate-pulse" />
      <FeaturedGridSkeleton />
      <div className="space-y-6 sm:space-y-8">
        <HorizontalSectionSkeleton />
        <HorizontalSectionSkeleton />
        <HorizontalSectionSkeleton />
      </div>
    </div>
  );
};

export default HomePageSkeleton;
