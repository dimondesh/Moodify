// src/pages/SearchPage/ArtistGrid.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import type { Artist } from "../../types";
import SectionGridSkeleton from "../../components/ui/skeletons/PlaylistSkeleton";
import { useSearchStore } from "../../stores/useSearchStore";
import { useTranslation } from "react-i18next";
import { getOptimizedImageUrl } from "@/lib/utils";

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

  const artistsToShow = showAll ? artists : artists.slice(0, 4);

  return (
    <div className="mb-8 w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white">{title}</h2>
        {artists.length > 4 && (
          <Button
            variant="link"
            className="text-sm text-zinc-400 hover:text-white"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? t("searchpage.showLess") : t("searchpage.showAll")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {artistsToShow.map((artist) => (
          <div
            key={artist._id}
            className="bg-zinc-800/40 p-4 rounded-md hover:bg-zinc-700/40 transition-all group cursor-pointer"
            onClick={() => handleArtistClick(artist)}
          >
            <div className="relative mb-4 aspect-square rounded-full shadow-lg overflow-hidden">
              <img
                src={getOptimizedImageUrl(
                  artist.imageUrl || "/default_artist_cover.png",
                  300
                )}
                alt={artist.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "/default_artist_cover.png";
                }}
              />
            </div>
            <h3 className="font-medium mb-2 truncate text-white text-center">
              {artist.name}
            </h3>
          </div>
        ))}
      </div>
    </div>
  );
};

const ArtistGrid = React.memo(ArtistGridComponent);
export default ArtistGrid;
