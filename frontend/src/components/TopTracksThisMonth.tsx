import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { usePlayerStore } from "../stores/usePlayerStore";
import Equalizer from "./ui/equalizer";
import { getOptimizedImageUrl } from "../lib/utils";
import type { Song } from "../types";
import { Button } from "./ui/button";
import { useAuthStore } from "../stores/useAuthStore";
import { SaveSongToLibraryControl } from "../layout/SaveSongToLibraryControl";

interface TopTrack extends Song {
  listenCount: number;
  lastListened: string;
}

interface TopTracksThisMonthProps {
  userId: string;
  isMyProfile: boolean;
  tracks: TopTrack[];
  errorMessage: string | null;
}

const TopTracksThisMonth: React.FC<TopTracksThisMonthProps> = ({
  userId,
  isMyProfile,
  tracks,
  errorMessage,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentSong, isPlaying, playAlbum, togglePlay } = usePlayerStore();
  const user = useAuthStore((s) => s.user);

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

  if (!isMyProfile) {
    return null;
  }

  if (errorMessage) {
    return (
      <div className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold">
            {t("pages.profile.topTracksThisMonth")}
          </h2>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-400">{t("pages.profile.topTracksError")}</p>
        </div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold">
            {t("pages.profile.topTracksThisMonth")}
          </h2>
        </div>
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
        <h2 className="text-xl sm:text-2xl font-bold">
          {t("pages.profile.topTracksThisMonth")}
        </h2>
        <Button
          variant="link"
          className="text-sm text-zinc-400 hover:text-white p-0 h-auto"
          onClick={handleShowAllTracks}
        >
          {t("pages.profile.showAll")}
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {tracks.map((track, index) => {
          const isCurrentSong = currentSong?._id === track._id;

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
                  <Play className="h-4 w-4 hidden group-hover:block fill-current text-zinc-400  " />
                )}
              </div>
              <div className="w-12 h-12 flex-shrink-0">
                <img
                  src={getOptimizedImageUrl(
                    track.imageUrl || "/default-song-cover.png",
                    100,
                  )}
                  alt={track.title}
                  className="w-full h-full object-cover rounded-md"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate max-w-40 sm:max-w-900">
                  {track.title}
                </h3>
                <p className="text-sm text-zinc-400 truncate">
                  {Array.isArray(track.artist) && track.artist.length > 0
                    ? track.artist[0]?.name || t("common.unknownArtist")
                    : t("common.unknownArtist")}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <span>{formatTime(track.duration ?? 0)}</span>
                <SaveSongToLibraryControl
                  song={track}
                  disabled={!user}
                  className="shrink-0"
                  iconClassName="h-4 w-4"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TopTracksThisMonth;
