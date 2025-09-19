// frontend/src/pages/ProfilePage/PlaylistRow.tsx

import React from "react";
import { Link } from "react-router-dom";
import { Playlist } from "@/types";
import { Music } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PlaylistRowProps {
  playlist: Playlist;
}

const PlaylistRowComponent = ({ playlist }: PlaylistRowProps) => {
  const { t } = useTranslation();
  return (
    <Link
      to={`/playlists/${playlist._id}`}
      className="flex items-center gap-4 p-2 rounded-md hover:bg-zinc-800/50"
    >
      <div className="w-14 h-14 bg-zinc-800 flex items-center justify-center rounded-md flex-shrink-0">
        {playlist.imageUrl ? (
          <img
            src={playlist.imageUrl}
            alt={playlist.title}
            className="w-full h-full object-cover rounded-md"
          />
        ) : (
          <Music className="h-6 w-6 text-zinc-500" />
        )}
      </div>
      <div className="flex-grow min-w-0">
        <p className="font-medium truncate text-white">{playlist.title}</p>
        <p className="text-sm text-zinc-400 truncate">
          {playlist.likes ?? 0} {t("pages.playlist.saved")} •{" "}
          {playlist.owner?.fullName || t("common.unknownArtist")}
        </p>
      </div>
    </Link>
  );
};

const PlaylistRow = React.memo(PlaylistRowComponent);
export default PlaylistRow;
