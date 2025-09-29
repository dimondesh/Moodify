/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Play, Heart } from "lucide-react";
import { usePlayerStore } from "../stores/usePlayerStore";
import { useLibraryStore } from "../stores/useLibraryStore";
import { axiosInstance } from "../lib/axios";
import Equalizer from "./ui/equalizer";
import { getOptimizedImageUrl } from "../lib/utils";
import type { Song } from "../types";

interface TopTracksThisMonthProps {
  userId: string;
  isMyProfile: boolean;
}

interface TopTrack extends Song {
  listenCount: number;
  lastListened: string;
}

const TopTracksThisMonth: React.FC<TopTracksThisMonthProps> = ({
  userId,
  isMyProfile,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<TopTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentSong, isPlaying, playAlbum, togglePlay } = usePlayerStore();
  const { isSongLiked, toggleSongLike } = useLibraryStore();

  useEffect(() => {
    const fetchTopTracks = async () => {
      if (!isMyProfile) return; // Показываем только владельцу профиля

      try {
        setIsLoading(true);
        setError(null);
        const response = await axiosInstance.get(
          `/users/${userId}/top-tracks-this-month`
        );
        setTracks(response.data.tracks);
      } catch (err: any) {
        console.error("Error fetching top tracks:", err);
        setError(err.response?.data?.message || "Failed to load top tracks");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopTracks();
  }, [userId, isMyProfile]);

  const handlePlaySpecificSong = (song: TopTrack, index: number) => {
    if (currentSong?._id === song._id && isPlaying) {
      togglePlay();
    } else {
      playAlbum(tracks, index);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleShowAllTracks = () => {
    navigate(`/users/${userId}/top-tracks`);
  };

  // Не показываем секцию, если это не профиль владельца
  if (!isMyProfile) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-4">
          {t("pages.profile.topTracksThisMonth")}
        </h2>
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-2 rounded-md animate-pulse"
            >
              <div className="w-4 h-4 bg-zinc-800 rounded"></div>
              <div className="w-12 h-12 bg-zinc-800 rounded-md"></div>
              <div className="flex-1">
                <div className="h-4 bg-zinc-800 rounded mb-2 w-3/4"></div>
                <div className="h-3 bg-zinc-800 rounded w-1/2"></div>
              </div>
              <div className="w-12 h-4 bg-zinc-800 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-4">
          {t("pages.profile.topTracksThisMonth")}
        </h2>
        <div className="text-center py-8">
          <p className="text-gray-400">{t("pages.profile.topTracksError")}</p>
        </div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-4">
          {t("pages.profile.topTracksThisMonth")}
        </h2>
        <div className="text-center py-8">
          <p className="text-gray-400">
            {t("pages.profile.noTopTracksThisMonth")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">
          {t("pages.profile.topTracksThisMonth")}
        </h2>
        {tracks.length > 0 && (
          <button
            onClick={handleShowAllTracks}
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            {t("pages.profile.showAll")}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {tracks.map((track, index) => {
          const isCurrentSong = currentSong?._id === track._id;
          const isLiked = isSongLiked(track._id);

          return (
            <div
              key={`${track._id}-${index}`}
              className="flex items-center gap-4 p-2 rounded-md hover:bg-zinc-800/50 cursor-pointer group"
              onClick={() => handlePlaySpecificSong(track, index)}
            >
              <div className="flex items-center justify-center w-4 text-zinc-400">
                {isCurrentSong && isPlaying ? (
                  <Equalizer />
                ) : (
                  <span className="group-hover:hidden">{index + 1}</span>
                )}
                {!isCurrentSong && (
                  <Play className="h-4 w-4 hidden group-hover:block" />
                )}
              </div>
              <div className="w-12 h-12 flex-shrink-0">
                <img
                  src={getOptimizedImageUrl(
                    track.imageUrl || "/default-song-cover.png",
                    100
                  )}
                  alt={track.title}
                  className="w-full h-full object-cover rounded-md"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate">
                  {track.title}
                </h3>
                <p className="text-sm text-zinc-400 truncate">
                  {Array.isArray(track.artist) && track.artist.length > 0
                    ? track.artist[0]?.name || t("common.unknownArtist")
                    : t("common.unknownArtist")}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <span>{formatTime(track.duration)}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSongLike(track._id);
                  }}
                  className="p-1 hover:bg-zinc-700 rounded-full transition-colors"
                >
                  <Heart
                    className={`h-4 w-4 ${
                      isLiked
                        ? "text-violet-600 fill-violet-600"
                        : "text-zinc-400"
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TopTracksThisMonth;
