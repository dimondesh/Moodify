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

  const albumsToShow = showAll ? albums : albums.slice(0, 5);

  return (
    <div className="mb-6 w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-white">{title}</h2>
        {albums.length > 5 && (
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
        {albumsToShow.map((album) => (
          <div
            key={album._id}
            className="bg-transparent p-0 rounded-md transition-all group cursor-pointer"
            onClick={() => handleAlbumClick(album)}
          >
            <div className="relative mb-2">
              <div className="relative aspect-square shadow-lg overflow-hidden rounded-md">
                <img
                  src={getOptimizedImageUrl(
                    album.imageUrl ||
                      "https://moodify.b-cdn.net/default-album-cover.png",
                    200
                  )}
                  alt={album.title}
                  className="absolute inset-0 h-full w-full object-cover rounded-md transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://moodify.b-cdn.net/default-album-cover.png";
                  }}
                />
              </div>
              <UniversalPlayButton
                entity={album}
                entityType="album"
                className="absolute bottom-3 right-2"
                size="sm"
              />
            </div>
            <div className="px-1">
              <h3 className="font-semibold text-sm truncate">{album.title}</h3>
              <p className="text-xs text-zinc-400 leading-tight truncate">
                {getArtistNames(album.artist)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AlbumGrid = React.memo(AlbumGridComponent);
export default AlbumGrid;
