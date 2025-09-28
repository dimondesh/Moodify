// src/pages/SearchPage/ArtistGrid.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import type { Artist } from "../../types";
import SectionGridSkeleton from "../../components/ui/skeletons/PlaylistSkeleton";
import { useSearchStore } from "../../stores/useSearchStore";
import { useTranslation } from "react-i18next";
import { getOptimizedImageUrl } from "@/lib/utils";
import UniversalPlayButton from "../../components/ui/UniversalPlayButton";

type ArtistGridProps = {
  title: string;
  artists: Artist[];
  isLoading: boolean;
};

const ArtistGridComponent: React.FC<ArtistGridProps> = ({
  title,
  artists,
  isLoading,
}) => {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const { addRecentSearch } = useSearchStore();
  const { t } = useTranslation();

  const handleArtistClick = (artist: Artist) => {
    addRecentSearch(artist._id, "Artist");
    navigate(`/artists/${artist._id}`);
  };

  if (isLoading) return <SectionGridSkeleton />;

  const artistsToShow = showAll ? artists : artists.slice(0, 5);

  return (
    <div className="mb-6 w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-white">{title}</h2>
        {artists.length > 5 && (
          <Button
            variant="link"
            className="text-sm text-gray-400 hover:text-[#8b5cf6]"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? t("searchpage.showLess") : t("searchpage.showAll")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {artistsToShow.map((artist) => (
          <div
            key={artist._id}
            className="bg-transparent p-0 rounded-md transition-all group cursor-pointer"
            onClick={() => handleArtistClick(artist)}
          >
            <div className="relative mb-2">
              <div className="relative aspect-square shadow-lg overflow-hidden rounded-full">
                <img
                  src={getOptimizedImageUrl(
                    artist.imageUrl || "/default_artist_cover.png",
                    200
                  )}
                  alt={artist.name}
                  className="absolute inset-0 h-full w-full object-cover rounded-full transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "/default_artist_cover.png";
                  }}
                />
              </div>
              <UniversalPlayButton
                entity={artist}
                entityType="artist"
                className="absolute bottom-3 right-2"
                size="sm"
              />
            </div>
            <div className="px-1">
              <h3 className="font-semibold text-sm truncate text-center">
                {artist.name}
              </h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ArtistGrid = React.memo(ArtistGridComponent);
export default ArtistGrid;
