// frontend/src/components/RecentlyListenedArtists.tsx

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { axiosInstance } from "../lib/axios";
import UniversalPlayButton from "./ui/UniversalPlayButton";
import { Artist } from "../types";

interface RecentlyListenedArtist extends Artist {
  listenCount: number;
  lastListened: string;
  songs: any[];
}

interface RecentlyListenedArtistsProps {
  userId: string;
  isMyProfile: boolean;
  showRecentlyListenedArtists?: boolean;
}

const RecentlyListenedArtists: React.FC<RecentlyListenedArtistsProps> = ({
  userId,
  isMyProfile,
  showRecentlyListenedArtists = true,
}) => {
  const { t } = useTranslation();
  const [artists, setArtists] = useState<RecentlyListenedArtist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentlyListenedArtists = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await axiosInstance.get(
          `/users/${userId}/recently-listened-artists`
        );
        setArtists(response.data.artists);
      } catch (err: any) {
        if (err.response?.status === 403) {
          setError("recentlyListenedArtists.private");
        } else {
          setError("recentlyListenedArtists.error");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecentlyListenedArtists();
  }, [userId]);

  if (isLoading) {
    return null;
  }

  if (error) {
    // Если это не профиль владельца и секция скрыта - не показываем ничего
    if (error === "recentlyListenedArtists.private" && !isMyProfile) {
      return null;
    }

    // Если это профиль владельца, но секция скрыта - не показываем ничего
    if (error === "recentlyListenedArtists.private" && isMyProfile) {
      return null;
    }

    return null;
  }

  if (artists.length === 0) {
    return null;
  }

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold mb-4">
        {t("pages.profile.recentlyListenedArtists")}
      </h2>
      {isMyProfile && showRecentlyListenedArtists === false && (
        <p className="text-xs text-gray-400 mb-4">
          {t("pages.profile.visibleOnlyToYou")}
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {artists.map((artist) => (
          <Link
            to={`/artists/${artist._id}`}
            key={artist._id}
            className="bg-transparent p-0 rounded-md transition-all group cursor-pointer"
          >
            <div className="relative mb-2">
              <div className="relative aspect-square shadow-lg overflow-hidden rounded-full">
                <img
                  src={
                    artist.imageUrl ||
                    "https://moodify.b-cdn.net/default-album-cover.png"
                  }
                  alt={artist.name}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://moodify.b-cdn.net/default-album-cover.png";
                  }}
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
              <h3 className="font-semibold text-sm truncate text-white">
                {artist.name}
              </h3>
              <p className="text-xs text-zinc-400 leading-tight truncate">
                {t("pages.profile.artist")}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default RecentlyListenedArtists;
