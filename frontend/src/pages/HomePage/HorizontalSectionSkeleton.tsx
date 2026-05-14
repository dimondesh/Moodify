// src/pages/HomePage/HorizontalSectionSkeleton.tsx

import { ScrollArea, ScrollBar } from "../../components/ui/scroll-area";

const HorizontalSectionSkeleton = () => {
  return (
    <div className="mb-8">
      <div className="h-8 w-48 bg-zinc-800 rounded mb-4 animate-pulse" />

      <ScrollArea className="w-full whitespace-nowrap rounded-md">
        <div className="flex space-x-4 pb-4">
          {" "}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-zinc-800/40 p-4 rounded-md animate-pulse w-40 sm:w-48 flex-shrink-0"
            >
              <div className="aspect-square rounded-md bg-zinc-700 mb-4" />
              <div className="h-4 bg-zinc-700 rounded w-3/4 mb-2" />
              <div className="h-4 bg-zinc-700 rounded w-1/2" />
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
export default HorizontalSectionSkeleton;
