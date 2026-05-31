import { ScrollArea, ScrollBar } from "../../components/ui/scroll-area";
import EntitySectionCardSkeleton from "@/components/ui/skeletons/EntitySectionCardSkeleton";

const HorizontalSectionSkeleton = () => (
  <div className="mb-4 sm:mb-8 relative">
    <div className="flex items-center justify-between mb-2 sm:mb-4">
      <div className="h-7 sm:h-8 w-40 sm:w-48 max-w-[70%] bg-zinc-800 rounded animate-pulse" />
      <div className="h-4 w-16 bg-zinc-800/80 rounded animate-pulse shrink-0" />
    </div>

    <ScrollArea className="w-full whitespace-nowrap rounded-md">
      <div className="flex pb-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <EntitySectionCardSkeleton key={i} />
        ))}
      </div>
      <ScrollBar orientation="horizontal" className="hidden" />
    </ScrollArea>
  </div>
);

export default HorizontalSectionSkeleton;
