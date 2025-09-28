// src/pages/SearchPage/AlbumGrid.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import type { Album } from "../../types";
import SectionGridSkeleton from "../../components/ui/skeletons/PlaylistSkeleton";
import { useSearchStore } from "@/stores/useSearchStore";
import { useTranslation } from "react-i18next";
import { getArtistNames, getOptimizedImageUrl } from "@/lib/utils";
import UniversalPlayButton from "../../components/ui/UniversalPlayButton";

type AlbumGridProps = {
  title: string;
  albums: Album[];
  isLoading: boolean;
};

const AlbumGridComponent = ({ title, albums, isLoading }: AlbumGridProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const { addRecentSearch } = useSearchStore();

  const handleAlbumClick = (album: Album) => {
    addRecentSearch(album._id, "Album");
    navigate(`/albums/${album._id}`);
  };

  if (isLoading) return <SectionGridSkeleton />;

  const albumsToShow = showAll ? albums : albums.slice(0, 4);

  return (
    <div className="mb-6 w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-white">{title}</h2>
        {albums.length > 4 && (
          <Button
            variant="link"
            className="text-sm text-gray-400 hover:text-[#8b5cf6]"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? t("searchpage.showLess") : t("searchpage.showAll")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {albumsToShow.map((album) => (
          <div
            key={album._id}
            className="bg-[#1a1a1a] p-3 rounded-md hover:bg-[#2a2a2a] transition-all cursor-pointer group hover-scale"
            onClick={() => handleAlbumClick(album)}
          >
            <div className="relative mb-3 aspect-square rounded-md shadow-lg overflow-hidden">
              <img
                src={getOptimizedImageUrl(
                  album.imageUrl ||
                    "https://moodify.b-cdn.net/default-album-cover.png",
                  300
                )}
                alt={album.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://moodify.b-cdn.net/default-album-cover.png";
                }}
              />
              <UniversalPlayButton
                entity={album}
                entityType="album"
                className="absolute bottom-3 right-2"
                size="sm"
              />
            </div>
            <h3 className="font-medium mb-1 truncate text-white text-sm">
              {album.title}
            </h3>
            <p className="text-xs text-gray-400 truncate">
              {getArtistNames(album.artist)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const AlbumGrid = React.memo(AlbumGridComponent);
export default AlbumGrid;
