import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Play, Pause, Heart } from "lucide-react";
import { usePlayerStore } from "../../stores/usePlayerStore";
import { useLibraryStore } from "../../stores/useLibraryStore";
import { useAuthStore } from "../../stores/useAuthStore";
import { axiosInstance } from "../../lib/axios";
import Equalizer from "../../components/ui/equalizer";
import { getOptimizedImageUrl } from "../../lib/utils";
import { ScrollArea, ScrollBar } from "../../components/ui/scroll-area";
import { Helmet } from "react-helmet-async";
import type { Song } from "../../types";

interface TopTrack extends Song {
  listenCount: number;
  lastListened: string;
}

const TopTracksPage = () => {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const location = useLocation();
  const [tracks, setTracks] = useState<TopTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentSong, isPlaying, playAlbum, togglePlay } = usePlayerStore();
  const { isSongLiked, toggleSongLike } = useLibraryStore();
  const { user } = useAuthStore();

  const pageTitle =
    location.state?.title || t("pages.profile.topTracksThisMonth");

  useEffect(() => {
    const fetchAllTopTracks = async () => {
      if (!userId) return;

      try {
        setIsLoading(true);
        setError(null);
        const response = await axiosInstance.get(
          `/users/${userId}/all-top-tracks-this-month`
        );
        setTracks(response.data.tracks);
      } catch (err: any) {
        console.error("Error fetching all top tracks:", err);
        setError(err.response?.data?.message || "Failed to load top tracks");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllTopTracks();
  }, [userId]);

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

  const formatListenCount = (count: number) => {
    if (count === 1) return t("pages.profile.listen");
    if (count >= 2 && count <= 4) return t("pages.profile.listens");
    return t("pages.profile.listensMany");
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 bg-zinc-900 min-h-screen text-white">
        <h1 className="text-2xl sm:text-3xl mb-6 font-bold">{pageTitle}</h1>
        <div className="flex flex-col gap-2">
          {[...Array(10)].map((_, index) => (
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
      <div className="p-4 sm:p-6 bg-zinc-900 min-h-screen text-white">
        <h1 className="text-2xl sm:text-3xl mb-6 font-bold">{pageTitle}</h1>
        <div className="text-center py-8">
          <p className="text-red-500">{t("pages.profile.topTracksError")}</p>
        </div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="p-4 sm:p-6 bg-zinc-900 min-h-screen text-white">
        <h1 className="text-2xl sm:text-3xl mb-6 font-bold">{pageTitle}</h1>
        <div className="text-center py-8">
          <p className="text-gray-400">
            {t("pages.profile.noTopTracksThisMonth")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
      </Helmet>
      <ScrollArea className="h-[calc(100vh-120px)] w-full rounded-md pr-4 bg-zinc-950">
        <div className="p-4 pt-4 pb-14 md:pb-16">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6">{pageTitle}</h1>
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
                      {track.artist.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <span>
                      {track.listenCount} {formatListenCount(track.listenCount)}
                    </span>
                    <span>•</span>
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
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </>
  );
};

export default TopTracksPage;
