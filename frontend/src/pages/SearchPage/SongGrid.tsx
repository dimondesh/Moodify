// src/pages/SearchPage/SongGrid.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import type { Song } from "../../types";
import UniversalPlayButton from "../../components/ui/UniversalPlayButton";
import SectionGridSkeleton from "../../components/ui/skeletons/PlaylistSkeleton";
import { useMusicStore } from "../../stores/useMusicStore";
import { getArtistNames, getOptimizedImageUrl } from "../../lib/utils";
import { useSearchStore } from "@/stores/useSearchStore";
import { useTranslation } from "react-i18next";
import AlbumCoverImage from "../../components/AlbumCoverImage";

type SectionGridProps = {
  title: string;
  songs: Song[];
  isLoading: boolean;
};

const SongGridComponent = ({ title, songs, isLoading }: SectionGridProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const { artists, fetchArtists } = useMusicStore();
  const { addRecentSearch } = useSearchStore();

  const handleSongClick = (song: Song) => {
    addRecentSearch(song._id, "Song");
    if (typeof song.albumId === "string" && song.albumId.length > 0) {
      navigate(`/albums/${song.albumId}`);
    } else {
      console.warn("albumId is missing or not a string:", song.albumId);
    }
  };

  useEffect(() => {
    fetchArtists();
  }, [fetchArtists]);

  if (isLoading) return <SectionGridSkeleton />;

  const songsToShow = showAll ? songs : songs.slice(0, 5);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-white">{title}</h2>
        {songs.length > 5 && (
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
        {songsToShow.map((song) => {
          return (
            <div
              key={song._id}
              className="bg-transparent p-0 rounded-md transition-all group cursor-pointer"
              onClick={() => handleSongClick(song)}
            >
              <div className="relative mb-2">
                <div className="relative aspect-square shadow-lg overflow-hidden rounded-md">
                  <AlbumCoverImage
                    src={getOptimizedImageUrl(
                      song.imageUrl || "/default-song-cover.png",
                      200
                    )}
                    alt={song.title || t("common.noTitle")}
                    className="absolute inset-0 h-full w-full object-cover rounded-md transition-transform duration-300 group-hover:scale-105"
                    albumId={song.albumId || undefined}
                    fallbackSrc="/default-song-cover.png"
                  />
                </div>
                <UniversalPlayButton
                  entity={song}
                  entityType="song"
                  songs={songs}
                  className="absolute bottom-3 right-2"
                  size="sm"
                />
              </div>
              <div className="px-1">
                <h3 className="font-semibold text-sm truncate">{song.title}</h3>
                <p className="text-xs text-zinc-400 leading-tight truncate">
                  {getArtistNames(
                    song.artist.map((artist) => artist._id),
                    artists
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SongGrid = React.memo(SongGridComponent);
export default SongGrid;
