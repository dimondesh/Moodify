import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import SectionGridSkeleton from "./SectionGridSkeleton";
import { Playlist } from "@/types";
import { useTranslation } from "react-i18next";

type PlaylistSectionGridProps = {
  title: string;
  playlists: Playlist[];
  isLoading: boolean;
  showAllPath?: string;
};

const PlaylistSectionGrid = ({
  title,
  playlists,
  isLoading,
  showAllPath,
}: PlaylistSectionGridProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (isLoading) {
    return <SectionGridSkeleton />;
  }
  if (!playlists || playlists.length === 0) {
    return null;
  }

  const playlistsToShow = playlists.slice(0, 4);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
        {playlists.length > 4 && showAllPath && (
          <Button
            variant="link"
            className="text-sm text-zinc-400 hover:text-white"
            onClick={() => navigate(showAllPath)}
          >
            {t("searchpage.showAll")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {playlistsToShow.map((playlist) => (
          <div
            key={playlist._id}
            className="bg-zinc-800/40 p-4 rounded-md hover:bg-zinc-700/40 transition-all group cursor-pointer"
            onClick={() => navigate(`/playlists/${playlist._id}`)}
          >
            <div className="relative mb-4">
              <div className=" aspect-square rounded-md shadow-lg overflow-hidden">
                <img
                  src={playlist.imageUrl || "/default_playlist_cover.png"}
                  alt={playlist.title}
                  className=" w-auto h-auto object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "/default_playlist_cover.png";
                  }}
                />
              </div>
            </div>
            <h3 className="font-medium mb-2 truncate">{playlist.title}</h3>
            <p className="text-sm text-zinc-400 truncate">
              {t("sidebar.subtitle.byUser", {
                name: playlist.owner?.fullName || t("common.unknownArtist"),
              })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlaylistSectionGrid;
