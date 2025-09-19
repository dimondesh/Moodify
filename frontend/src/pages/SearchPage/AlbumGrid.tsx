// src/pages/SearchPage/AlbumGrid.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import type { Album } from "../../types";
import SectionGridSkeleton from "../../components/ui/skeletons/PlaylistSkeleton";
import { useSearchStore } from "@/stores/useSearchStore";
import { useTranslation } from "react-i18next";
import { getArtistNames, getOptimizedImageUrl } from "@/lib/utils";

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
    <div className="mb-8 w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
        {albums.length > 4 && (
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
        {albumsToShow.map((album) => (
          <div
            key={album._id}
            className="bg-zinc-800/40 p-4 rounded-md hover:bg-zinc-700/40 transition-all cursor-pointer group"
            onClick={() => handleAlbumClick(album)}
          >
            <div className="relative mb-4 aspect-square rounded-md shadow-lg overflow-hidden">
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
            </div>
            <h3 className="font-medium mb-2 truncate">{album.title}</h3>
            <p className="text-sm text-zinc-400 truncate">
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
