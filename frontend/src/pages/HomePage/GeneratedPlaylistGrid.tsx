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

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {playlistsToShow.map((playlist) => (
          <div
            key={playlist._id}
            className="bg-zinc-800/40 p-4 rounded-md hover:bg-zinc-700/40 transition-all cursor-pointer group"
            onClick={() => navigate(`/generated-playlists/${playlist._id}`)}
          >
            <div className="relative mb-4">
              <div className=" aspect-square object-cover flex rounded-md shadow-lg overflow-hidden">
                <img
                  src={playlist.imageUrl || "/default_playlist_cover.png"}
                  alt={t(playlist.nameKey)}
                  className="object-cover w-auto h-auto transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "/default_playlist_cover.png";
                  }}
                />
              </div>
            </div>
            <h3 className="font-medium mb-2 truncate text-white">
              {t(playlist.nameKey)}
            </h3>
            <p className="text-sm text-zinc-400 truncate">
              {t("sidebar.subtitle.playlist")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GeneratedPlaylistGrid;
