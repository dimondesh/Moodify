/* eslint-disable @typescript-eslint/no-explicit-any */
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
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentlyListenedArtists = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Показываем скелетон через 200ms, если загрузка еще идет
        const skeletonTimer = setTimeout(() => {
          setShowSkeleton(true);
        }, 200);

        const response = await axiosInstance.get(
          `/users/${userId}/recently-listened-artists`
        );

        clearTimeout(skeletonTimer);
        setArtists(response.data.artists);
      } catch (err: any) {
        if (err.response?.status === 403) {
          setError("recentlyListenedArtists.private");
        } else {
          setError("recentlyListenedArtists.error");
        }
      } finally {
        setIsLoading(false);
        setShowSkeleton(false);
      }
    };

    fetchRecentlyListenedArtists();
  }, [userId]);

  if (isLoading && showSkeleton) {
    return (
      <div className="px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            {t("pages.profile.recentlyListenedArtists")}
          </h2>
        </div>
        {/* Мобильная версия скелетона - список */}
        <div className="flex flex-col gap-2 sm:hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-2 rounded-md animate-pulse"
            >
              <div className="w-4 h-4 bg-[#2a2a2a] rounded"></div>
              <div className="w-12 h-12 bg-[#2a2a2a] rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-[#2a2a2a] rounded mb-2 w-3/4"></div>
                <div className="h-3 bg-[#2a2a2a] rounded w-1/2"></div>
              </div>
              <div className="w-8 h-8 bg-[#2a2a2a] rounded-full"></div>
            </div>
          ))}
        </div>

        {/* Десктопная версия скелетона - сетка */}
        <div className="hidden sm:grid sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <div className="aspect-square bg-[#2a2a2a] rounded-lg animate-pulse"></div>
              <div className="space-y-2">
                <div className="h-4 bg-[#2a2a2a] rounded animate-pulse"></div>
                <div className="h-3 bg-[#2a2a2a] rounded w-2/3 animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
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
    return (
      <div className="px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            {t("pages.profile.recentlyListenedArtists")}
          </h2>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-400">
            {isMyProfile
              ? t("pages.profile.noRecentlyListenedArtists")
              : t("pages.profile.noRecentlyListenedArtistsPublic")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12">
      <h2 className="text-xl sm:text-2xl font-bold mb-4">
        {t("pages.profile.recentlyListenedArtists")}
      </h2>
      {isMyProfile && showRecentlyListenedArtists === false && (
        <p className="text-xs text-gray-400 mb-4">
          {t("pages.profile.visibleOnlyToYou")}
        </p>
      )}
      {/* Мобильная версия - список */}
      <div className="flex flex-col gap-2 sm:hidden">
        {artists.slice(0, 4).map((artist, index) => (
          <Link
            to={`/artists/${artist._id}`}
            key={artist._id}
            className="flex items-center gap-4 p-2 rounded-md hover:bg-zinc-800/50 cursor-pointer group"
          >
            <div className="flex items-center justify-center w-4 text-zinc-400">
              <span className="group-hover:hidden">{index + 1}</span>
            </div>
            <div className="w-12 h-12 flex-shrink-0">
              <div className="relative aspect-square shadow-lg overflow-hidden rounded-full">
                <img
                  src={
                    artist.imageUrl ||
                    "https://moodify.b-cdn.net/default-album-cover.png"
                  }
                  alt={artist.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://moodify.b-cdn.net/default-album-cover.png";
                  }}
                />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate">
                {artist.name}
              </h3>
              <p className="text-sm text-zinc-400 truncate">
                {t("pages.profile.artist")}
              </p>
            </div>
            <UniversalPlayButton
              entity={artist}
              entityType="artist"
              size="sm"
            />
          </Link>
        ))}
      </div>

      {/* Десктопная версия - сетка */}
      <div className="hidden sm:grid sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
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
