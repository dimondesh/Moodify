// frontend/src/components/ui/UniversalPlayButton.tsx
import React, { useState, useEffect } from "react";
import { Button } from "./button";
import { Play, Pause } from "lucide-react";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { axiosInstance } from "@/lib/axios";
import type {
  Song,
  Album,
  Playlist,
  Mix,
  Artist,
  GeneratedPlaylist,
} from "@/types";

type EntityType =
  | "song"
  | "album"
  | "playlist"
  | "mix"
  | "artist"
  | "generated-playlist";

type UniversalPlayButtonProps = {
  entity: Song | Album | Playlist | Mix | Artist | GeneratedPlaylist;
  entityType: EntityType;
  songs?: Song[];
  onClick?: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const UniversalPlayButton = ({
  entity,
  entityType,
  songs,
  onClick,
  className = "",
}: UniversalPlayButtonProps) => {
  const {
    currentSong,
    isPlaying,
    playAlbum,
    togglePlay,
    currentPlaybackContext,
  } = usePlayerStore();
  const [artistSongs, setArtistSongs] = useState<Song[]>([]);
  const [isLoadingArtistSongs, setIsLoadingArtistSongs] = useState(false);

  // Загружаем песни артиста при монтировании компонента
  useEffect(() => {
    if (
      entityType === "artist" &&
      !artistSongs.length &&
      !isLoadingArtistSongs
    ) {
      setIsLoadingArtistSongs(true);
      axiosInstance
        .get(`/artists/${entity._id}`)
        .then((response) => {
          setArtistSongs(response.data.songs || []);
        })
        .catch((error) => {
          console.error("Failed to load artist songs:", error);
          setArtistSongs([]);
        })
        .finally(() => {
          setIsLoadingArtistSongs(false);
        });
    }
  }, [entityType, entity._id, artistSongs.length, isLoadingArtistSongs]);

  const getSongsFromEntity = (): Song[] => {
    switch (entityType) {
      case "song":
        return songs || [entity as Song];
      case "album":
        return (entity as Album).songs || [];
      case "playlist":
        return (entity as Playlist).songs || [];
      case "mix":
        return (entity as Mix).songs || [];
      case "generated-playlist":
        return (entity as GeneratedPlaylist).songs || [];
      case "artist":
        // Для артистов используем загруженные песни или песни из entity
        return artistSongs.length > 0
          ? artistSongs.slice(0, 5)
          : (entity as Artist).songs?.slice(0, 5) || [];
      default:
        return [];
    }
  };

  const getPlaybackContext = () => {
    switch (entityType) {
      case "album":
        return {
          type: "album" as const,
          entityId: entity._id,
          entityTitle: (entity as Album).title,
        };
      case "playlist":
        return {
          type: "playlist" as const,
          entityId: entity._id,
          entityTitle: (entity as Playlist).title,
        };
      case "mix":
        return {
          type: "mix" as const,
          entityId: entity._id,
          entityTitle: (entity as Mix).name,
        };
      case "generated-playlist":
        return {
          type: "generated-playlist" as const,
          entityId: entity._id,
          entityTitle: (entity as GeneratedPlaylist).nameKey,
        };
      case "artist":
        return {
          type: "artist" as const,
          entityId: entity._id,
          entityTitle: (entity as Artist).name,
        };
      default:
        return undefined;
    }
  };

  const entitySongs = getSongsFromEntity();
  const playbackContext = getPlaybackContext();

  const isCurrentlyPlayingFromThisEntity =
    isPlaying &&
    currentSong &&
    entitySongs.length > 0 &&
    entitySongs.some((song) => song._id === currentSong._id) &&
    currentPlaybackContext &&
    currentPlaybackContext.type === entityType &&
    currentPlaybackContext.entityId === entity._id;

  const handlePlay = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.stopPropagation();
    if (onClick) onClick(e);

    // Для артистов используем загруженные песни
    const songsToPlay =
      entityType === "artist" && artistSongs.length > 0
        ? artistSongs
        : entitySongs;

    if (songsToPlay.length === 0) {
      console.warn(`No songs available for ${entityType}:`, entity);
      return;
    }

    if (isCurrentlyPlayingFromThisEntity) {
      togglePlay();
    } else {
      playAlbum(songsToPlay, 0, playbackContext);
    }
  };

  // Для артистов показываем кнопку даже если песни еще загружаются
  if (entitySongs.length === 0 && entityType !== "artist") {
    return null;
  }

  // Для артистов показываем кнопку только если песни загружены или загружаются
  if (
    entityType === "artist" &&
    !isLoadingArtistSongs &&
    artistSongs.length === 0
  ) {
    return null;
  }

  return (
    <Button
      size={"icon"}
      onClick={handlePlay}
      className={`hidden sm:flex bg-violet-500 hover:bg-violet-400 hover:scale-105 transition-all rounded-full w-12 h-12
        opacity-0 translate-y-2 group-hover:translate-y-0 ${
          isCurrentlyPlayingFromThisEntity
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100"
        } ${className}`}
    >
      {isCurrentlyPlayingFromThisEntity ? (
        <Pause className="size-5 text-black fill-current" />
      ) : (
        <Play className="size-5 text-black fill-current" />
      )}
    </Button>
  );
};

export default UniversalPlayButton;
