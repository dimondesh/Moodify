// src/pages/SearchPage/ArtistGrid.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import type { Artist } from "../../types";
import SectionGridSkeleton from "../../components/ui/skeletons/PlaylistSkeleton";
import { useTranslation } from "react-i18next";
import { CoverImage } from "@/components/CoverImage";
import { CDN_DEFAULT_ARTIST_IMAGE } from "@/lib/cdn";
import UniversalPlayButton from "@/layout/UniversalPlayButton";

import { useAddRecentSearch } from "@/hooks/queries/useSearch";

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
  const { t } = useTranslation();
  const { mutate: addRecentSearch } = useAddRecentSearch();

  const handleArtistClick = (artist: Artist) => {
    addRecentSearch({ itemId: artist._id, itemType: "Artist" });
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
                <CoverImage
                  entity={artist}
                  size="card"
                  defaultUrl={CDN_DEFAULT_ARTIST_IMAGE}
                  alt={artist.name}
                  className="absolute inset-0 h-full w-full object-cover rounded-full transition-transform duration-300 group-hover:scale-105"
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
