// src/pages/HomePage/GeneratedPlaylistGrid.tsx

import { useNavigate } from "react-router-dom";
import type { GeneratedPlaylist } from "../../types";
import SectionGridSkeleton from "./SectionGridSkeleton";
import { useTranslation } from "react-i18next";

type GeneratedPlaylistGridProps = {
  title: string;
  playlists: GeneratedPlaylist[];
  isLoading: boolean;
};

const GeneratedPlaylistGrid = ({
  title,
  playlists,
  isLoading,
}: GeneratedPlaylistGridProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (isLoading) return <SectionGridSkeleton />;
  if (!playlists || playlists.length === 0) return null;

  const playlistsToShow = playlists.slice(0, 4);

  return (
    <div className="mb-8 w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white">{title}</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {playlistsToShow.map((playlist) => (
          <div
            key={playlist._id}
            className="bg-[#1a1a1a] p-3 rounded-md hover:bg-[#2a2a2a] transition-all cursor-pointer group hover-scale"
            onClick={() => navigate(`/generated-playlists/${playlist._id}`)}
          >
            <div className="relative mb-3">
              <div className="aspect-square rounded-md shadow-lg overflow-hidden">
                <img
                  src={playlist.imageUrl || "/default_playlist_cover.png"}
                  alt={t(playlist.nameKey)}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "/default_playlist_cover.png";
                  }}
                />
              </div>
            </div>
            <h3 className="font-medium mb-1 truncate text-white text-sm">
              {t(playlist.nameKey)}
            </h3>
            <p className="text-xs text-gray-400 truncate">
              {t("sidebar.subtitle.playlist")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GeneratedPlaylistGrid;
