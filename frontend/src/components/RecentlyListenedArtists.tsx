// frontend/src/components/RecentlyListenedArtists.tsx

import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import UniversalPlayButton from "./ui/UniversalPlayButton";
import type { Artist } from "../types";
import FixedRowEntitySection from "@/pages/HomePage/FixedRowEntitySection";

interface RecentlyListenedArtistsProps {
  isMyProfile: boolean;
  showRecentlyListenedArtists?: boolean;
  artists: Artist[];
  fetchStatus: "ok" | "private" | "error";
}

const RecentlyListenedArtists: React.FC<RecentlyListenedArtistsProps> = ({
  isMyProfile,
  showRecentlyListenedArtists = true,
  artists,
  fetchStatus,
}) => {
  const { t } = useTranslation();

  const displayItems = useMemo(
    () =>
      artists.map(
        (a) =>
          ({ ...a, itemType: "artist" as const }) as Artist & {
            itemType: "artist";
          },
      ),
    [artists],
  );

  const listPageItems = useMemo(
    () =>
      artists.map((a) => ({
        _id: a._id,
        name: a.name,
        imageUrl: a.imageUrl || "",
        type: "artist" as const,
        itemType: "artist" as const,
      })),
    [artists],
  );

  if (fetchStatus === "private" && !isMyProfile) {
    return null;
  }

  if (fetchStatus === "private" && isMyProfile) {
    return null;
  }

  if (fetchStatus === "error") {
    return null;
  }

  if (artists.length === 0) {
    return (
      <div className="mt-12">
        <div className="flex items-center justify-between mb-4">
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

  const noticeSlot =
    isMyProfile && showRecentlyListenedArtists === false ? (
      <p className="text-xs text-gray-400 mb-4">
        {t("pages.profile.visibleOnlyToYou")}
      </p>
    ) : undefined;

  return (
    <div>
      <div className="sm:hidden mt-12">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white">
          {t("pages.profile.recentlyListenedArtists")}
        </h2>
        {noticeSlot}
        <div className="flex flex-col gap-2">
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
                    className="w-full h-full object-cover"
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
      </div>

      <div className="hidden sm:block">
        <FixedRowEntitySection
          title={t("pages.profile.recentlyListenedArtists")}
          items={displayItems}
          listPageItems={listPageItems}
          noticeSlot={noticeSlot}
        />
      </div>
    </div>
  );
};

export default RecentlyListenedArtists;
