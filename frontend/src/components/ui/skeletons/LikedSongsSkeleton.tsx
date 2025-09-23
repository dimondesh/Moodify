// src/components/ui/skeletons/LikedSongsSkeleton.tsx

import React from "react";

const LikedSongsSkeleton: React.FC = () => {
  return (
    <div className="h-full relative">
      {/* Gradient background */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#8b5cf6]/20 via-[#0f0f0f]/80 to-[#0f0f0f] pointer-events-none animate-fade-in"
        aria-hidden="true"
      />

      <div className="h-full rounded-md">
        <div className="relative min-h-screen pb-40 lg:pb-0">
          <div className="relative z-10">
            {/* Header section with image and title */}
            <div className="flex flex-col sm:flex-row p-4 sm:p-6 gap-4 sm:gap-6 pb-8 items-center sm:items-end">
              {/* Liked songs image skeleton */}
              <div className="w-48 h-48 sm:w-[200px] sm:h-[200px] lg:w-[240px] lg:h-[240px] bg-[#2a2a2a] rounded shadow-xl animate-pulse" />

              {/* Title and metadata skeleton */}
              <div className="flex flex-col justify-end text-center sm:text-left">
                <div className="h-4 w-24 bg-[#2a2a2a] rounded animate-pulse mb-2" />
                <div className="h-16 sm:h-20 lg:h-24 w-64 sm:w-80 bg-[#2a2a2a] rounded animate-pulse mb-4" />
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2">
                  <div className="h-4 w-32 bg-[#2a2a2a] rounded animate-pulse" />
                  <div className="h-4 w-20 bg-[#2a2a2a] rounded animate-pulse" />
                  <div className="h-4 w-16 bg-[#2a2a2a] rounded animate-pulse" />
                </div>
              </div>
            </div>

            {/* Play button skeleton */}
            <div className="px-4 sm:px-6 pb-4 flex items-center gap-4 sm:gap-6">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#2a2a2a] rounded-full animate-pulse" />
            </div>

            {/* Song list skeleton */}
            <div className="bg-black/20 backdrop-blur-sm">
              <div className="px-2 sm:px-6">
                <div className="space-y-1 py-4">
                  {/* Desktop song list skeleton */}
                  <div className="hidden md:block space-y-2">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-[16px_4fr_2fr_1fr_min-content] gap-4 px-4 py-2"
                      >
                        {/* Track number */}
                        <div className="flex items-center justify-center">
                          <div className="w-4 h-4 bg-[#2a2a2a] rounded animate-pulse" />
                        </div>

                        {/* Song info with image */}
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="size-10 bg-[#2a2a2a] rounded-md animate-pulse flex-shrink-0" />
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="h-4 w-3/4 bg-[#2a2a2a] rounded animate-pulse mb-1" />
                            <div className="h-3 w-1/2 bg-[#2a2a2a] rounded animate-pulse" />
                          </div>
                        </div>

                        {/* Date added */}
                        <div className="items-center hidden md:flex">
                          <div className="h-3 w-16 bg-[#2a2a2a] rounded animate-pulse" />
                        </div>

                        {/* Duration */}
                        <div className="flex items-center">
                          <div className="h-3 w-8 bg-[#2a2a2a] rounded animate-pulse" />
                        </div>

                        {/* More button */}
                        <div className="flex items-center justify-center">
                          <div className="w-5 h-5 bg-[#2a2a2a] rounded animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Mobile song list skeleton */}
                  <div className="md:hidden space-y-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-[#1a1a1a]/50 rounded-md"
                      >
                        <div className="size-12 bg-[#2a2a2a] rounded-md animate-pulse flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="h-4 w-3/4 bg-[#2a2a2a] rounded animate-pulse mb-1" />
                          <div className="h-3 w-1/2 bg-[#2a2a2a] rounded animate-pulse" />
                        </div>
                        <div className="w-5 h-5 bg-[#2a2a2a] rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LikedSongsSkeleton;
