// src/pages/SearchPage/PlaylistGrid.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import type { Playlist } from "../../types";
import SectionGridSkeleton from "../../components/ui/skeletons/PlaylistSkeleton";
import { useTranslation } from "react-i18next";
import { CoverImage } from "@/components/CoverImage";
import { CDN_DEFAULT_ALBUM_COVER } from "@/lib/cdn";
import { playlistOwnerLabel } from "@/lib/site-meta";
import { getPlaylistDisplayTitle } from "@/lib/entitySection";
import UniversalPlayButton from "@/layout/UniversalPlayButton";

import { useAddRecentSearch } from "@/hooks/queries/useSearch";

type PlaylistGridProps = {
  title: string;
  playlists: Playlist[];
  isLoading: boolean;
};

const PlaylistGridComponent = ({
  title,
  playlists,
  isLoading,
}: PlaylistGridProps) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const { mutate: addRecentSearch } = useAddRecentSearch();

  const handlePlaylistClick = (playlist: Playlist) => {
    addRecentSearch({ itemId: playlist._id, itemType: "Playlist" });
    navigate(`/playlists/${playlist._id}`);
  };

  if (isLoading) return <SectionGridSkeleton />;

  const playlistsToShow = showAll ? playlists : playlists.slice(0, 5);

  return (
    <div className="mb-6 w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-white">{title}</h2>
        {playlists.length > 5 && (
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
        {playlistsToShow.map((playlist) => {
          const displayTitle = getPlaylistDisplayTitle(
            playlist,
            i18n.language,
            t,
          );
          return (
            <div
              key={playlist._id}
              className="bg-transparent p-0 rounded-md transition-all group cursor-pointer"
              onClick={() => handlePlaylistClick(playlist)}
            >
              <div className="relative mb-2">
                <div className="relative aspect-square shadow-lg overflow-hidden rounded-md">
                  <CoverImage
                    entity={playlist}
                    size="card"
                    defaultUrl={CDN_DEFAULT_ALBUM_COVER}
                    alt={displayTitle}
                    className="absolute inset-0 h-full w-full object-cover rounded-md transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <UniversalPlayButton
                  entity={playlist}
                  entityType="playlist"
                  className="absolute bottom-3 right-2"
                  size="sm"
                />
              </div>
              <div className="px-1">
                <h3 className="font-semibold text-sm truncate">
                  {displayTitle}
                </h3>
                <p className="text-xs text-zinc-400 leading-tight truncate">
                  {playlistOwnerLabel(playlist.owner, t("common.unknownArtist"))}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PlaylistGrid = React.memo(PlaylistGridComponent);
export default PlaylistGrid;
