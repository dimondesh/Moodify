// src/pages/SearchPage/SongGrid.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import type { Song } from "../../types";
import PlayButton from "../HomePage/PlayButton";
import SectionGridSkeleton from "../../components/ui/skeletons/PlaylistSkeleton";
import { useMusicStore } from "../../stores/useMusicStore";
import { getArtistNames, getOptimizedImageUrl } from "../../lib/utils";
import { useSearchStore } from "@/stores/useSearchStore";
import { useTranslation } from "react-i18next";

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

  const songsToShow = showAll ? songs : songs.slice(0, 4);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
        {songs.length > 4 && (
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
        {songsToShow.map((song) => {
          const originalIndex = songs.findIndex((s) => s._id === song._id);
          return (
            <div
              key={song._id}
              className="bg-zinc-800/40 p-4 rounded-md hover:bg-zinc-700/40 transition-all group cursor-pointer"
              onClick={() => handleSongClick(song)}
            >
              <div className="relative mb-4 aspect-square rounded-md shadow-lg overflow-hidden">
                <img
                  src={getOptimizedImageUrl(
                    song.imageUrl || "/default-song-cover.png",
                    300
                  )}
                  alt={song.title || t("common.noTitle")}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "/default-song-cover.png";
                  }}
                />
                <PlayButton
                  song={song}
                  songs={songs}
                  songIndex={originalIndex}
                />
              </div>
              <h3 className="font-medium mb-2 truncate">{song.title}</h3>
              <p className="text-sm text-zinc-400 truncate">
                {getArtistNames(
                  song.artist.map((artist) => artist._id),
                  artists
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SongGrid = React.memo(SongGridComponent);
export default SongGrid;
