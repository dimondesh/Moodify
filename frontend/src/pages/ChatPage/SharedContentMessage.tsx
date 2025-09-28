import React, { useEffect, useState } from "react";
import { axiosInstance } from "@/lib/axios";
import { Album, Playlist, Song, Artist, Mix } from "@/types";
import { Loader2, Music, Play, Plus, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface SharedContentMessageProps {
  entityType: "song" | "album" | "playlist" | "mix";
  entityId: string;
}

type EntityData = Song | Album | Playlist | Mix;

const getArtistNames = (artists: Artist[] = []): string => {
  return artists.map((a) => a.name).join(", ");
};

export const SharedContentMessage: React.FC<SharedContentMessageProps> = ({
  entityType,
  entityId,
}) => {
  const [entity, setEntity] = useState<EntityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { setCurrentSong, playAlbum } = usePlayerStore();
  const {
    toggleSongLike,
    toggleAlbum,
    togglePlaylist,
    isSongLiked,
    isAlbumInLibrary,
    isPlaylistInLibrary,
    isMixSaved,
    toggleMixInLibrary,
    fetchLibrary,
  } = useLibraryStore();

  useEffect(() => {
    const fetchEntity = async () => {
      try {
        const response = await axiosInstance.get(
          `/share/${entityType}/${entityId}`
        );
        setEntity(response.data);
      } catch (error) {
        console.error("Failed to fetch shared entity:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEntity();
  }, [entityType, entityId]);

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!entity) return;
    if (entityType === "song") {
      setCurrentSong(entity as Song);
    } else if (
      entityType === "album" ||
      entityType === "playlist" ||
      entityType === "mix"
    ) {
      if ((entity as Album | Playlist | Mix).songs?.length > 0) {
        playAlbum((entity as Album | Playlist | Mix).songs, 0, {
          type:
            entityType === "mix"
              ? "mix"
              : entityType === "playlist"
              ? "playlist"
              : "album",
          entityId: (entity as Album | Playlist | Mix)._id,
          entityTitle:
            (entity as Album | Playlist).title || (entity as Mix).name,
        });
      } else {
        toast.error(t("common.noSongsToPlay"));
      }
    }
  };

  const handleAddToLibrary = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!entity) return;
    try {
      if (entityType === "song") {
        await toggleSongLike(entity._id);
      } else if (entityType === "album") {
        await toggleAlbum(entity._id);
      } else if (entityType === "playlist") {
        await togglePlaylist(entity._id);
      } else if (entityType === "mix") {
        await toggleMixInLibrary(entity._id);
      }

      await fetchLibrary();
    } catch (err) {
      console.error("Failed to update library.", err);
      toast.error(t("common.failedToUpdateLibrary"));
    }
  };

  if (isLoading) {
    return (
      <div className="mt-2 w-full max-w-sm bg-zinc-800/80 p-3 rounded-lg flex items-center justify-center h-[124px]">
        <Loader2 className="animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="mt-2 w-full max-w-sm bg-zinc-800/80 p-3 rounded-lg">
        <p className="text-zinc-400 text-sm">
          {t("common.contentNotAvailable")}
        </p>
      </div>
    );
  }

  const handleNavigate = () => {
    let path = "";
    if (entityType === "song") {
      path = `/albums/${(entity as Song).albumId}`;
    } else if (entityType === "mix") {
      path = `/mixes/${entity._id}`;
    } else {
      path = `/${entityType}s/${entity._id}`;
    }
    navigate(path);
  };

  const isAdded =
    entityType === "song"
      ? isSongLiked(entity._id)
      : entityType === "album"
      ? isAlbumInLibrary(entity._id)
      : entityType === "playlist"
      ? isPlaylistInLibrary(entity._id)
      : entityType === "mix"
      ? isMixSaved(entity._id)
      : false;

  const getSubtitle = () => {
    if (entityType === "song") return getArtistNames((entity as Song).artist);
    if (entityType === "album") return getArtistNames((entity as Album).artist);
    if (entityType === "playlist")
      return `by ${(entity as Playlist).owner.fullName}`;
    if (entityType === "mix") {
      const mix = entity as Mix;
      if (!mix.songs || mix.songs.length === 0) {
        return t("sidebar.subtitle.dailyMix");
      }

      const allArtists = mix.songs.flatMap((song) => song.artist);
      const uniqueArtists = allArtists.filter(
        (artist, index, self) =>
          index === self.findIndex((a) => a._id === artist._id)
      );
      const firstTwoUniqueArtists = uniqueArtists.slice(0, 2);
      const artistNames = getArtistNames(firstTwoUniqueArtists);

      if (uniqueArtists.length > 2) {
        return `${artistNames} ${t("common.andMore")}`;
      }
      return artistNames;
    }
    return entityType;
  };

  const getDisplayTitle = () => {
    if (entityType === "mix") {
      return t((entity as Mix).name);
    }
    return (entity as Song | Album | Playlist).title;
  };

  return (
    <div className="mt-2 w-full max-w-sm bg-zinc-800/80 p-3 rounded-lg flex flex-col gap-2">
      <div
        className="flex gap-3 items-start cursor-pointer"
        onClick={handleNavigate}
      >
        {entity.imageUrl ? (
          <img
            src={entity.imageUrl}
            alt={getDisplayTitle()}
            className="w-16 h-16 object-cover rounded"
          />
        ) : (
          <div className="w-16 h-16 bg-zinc-700 rounded flex items-center justify-center">
            <Music />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{getDisplayTitle()}</p>{" "}
          <p className="text-sm text-zinc-400 capitalize truncate">
            {getSubtitle()}
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-1">
        <Button
          size="sm"
          className={`flex-1 ${
            isAdded
              ? "bg-violet-600 hover:bg-violet-700"
              : "bg-zinc-700 hover:bg-zinc-600"
          }`}
          onClick={handleAddToLibrary}
        >
          {entityType === "song" ? (
            <Heart className={`mr-2 h-4 w-4 ${isAdded ? "fill-white" : ""}`} />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          {isAdded ? t("common.added") : t("common.add")}
        </Button>
        <Button size="sm" className="flex-1" onClick={handlePlay}>
          <Play className="mr-2 h-4 w-4" /> {t("common.play")}
        </Button>
      </div>
    </div>
  );
};
