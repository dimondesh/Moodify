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
  LibraryItem,
} from "@/types";

type EntityType =
  | "song"
  | "album"
  | "playlist"
  | "mix"
  | "artist"
  | "generated-playlist";

type UniversalPlayButtonProps = {
  entity:
    | Song
    | Album
    | Playlist
    | Mix
    | Artist
    | GeneratedPlaylist
    | LibraryItem;
  entityType: EntityType;
  songs?: Song[];
  onClick?: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "overlay";
};

const UniversalPlayButton = ({
  entity,
  entityType,
  songs,
  onClick,
  className = "",
  variant = "default",
}: UniversalPlayButtonProps) => {
  const {
    currentSong,
    isPlaying,
    playAlbum,
    togglePlay,
    currentPlaybackContext,
  } = usePlayerStore();
  const [entitySongs, setEntitySongs] = useState<Song[]>([]);
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);

  // Загружаем песни для сущности при монтировании компонента
  useEffect(() => {
    const needsSongs = [
      "artist",
      "album",
      "playlist",
      "mix",
      "generated-playlist",
    ].includes(entityType);
    const hasSongs =
      (entity as Album | Playlist | Mix | GeneratedPlaylist).songs &&
      (entity as Album | Playlist | Mix | GeneratedPlaylist).songs!.length > 0;

    console.log(`UniversalPlayButton useEffect:`, {
      entityType,
      entityId: entity._id,
      needsSongs,
      hasSongs,
      entitySongsLength: entitySongs.length,
      isLoadingSongs,
      entity,
    });

    if (needsSongs && !hasSongs && !entitySongs.length && !isLoadingSongs) {
      setIsLoadingSongs(true);

      let apiEndpoint = "";
      switch (entityType) {
        case "artist":
          apiEndpoint = `/artists/${entity._id}`;
          break;
        case "album":
          apiEndpoint = `/albums/${entity._id}`;
          break;
        case "playlist":
          apiEndpoint = `/playlists/${entity._id}`;
          break;
        case "mix":
          apiEndpoint = `/mixes/${entity._id}`;
          break;
        case "generated-playlist":
          apiEndpoint = `/generated-playlists/${entity._id}`;
          break;
      }

      if (apiEndpoint) {
        console.log(`Loading songs for ${entityType} from ${apiEndpoint}`);
        axiosInstance
          .get(apiEndpoint)
          .then((response) => {
            console.log(`Loaded data for ${entityType}:`, response.data);
            // Для альбомов данные приходят в формате { album: ... }
            const songs =
              entityType === "album"
                ? response.data.album?.songs || []
                : response.data.songs || [];
            console.log(`Extracted ${songs.length} songs for ${entityType}`);
            setEntitySongs(songs);
          })
          .catch((error) => {
            console.error(`Failed to load ${entityType} songs:`, error);
            setEntitySongs([]);
          })
          .finally(() => {
            setIsLoadingSongs(false);
          });
      }
    }
  }, [entityType, entity._id, entitySongs.length, isLoadingSongs, entity]);

  const getSongsFromEntity = (): Song[] => {
    switch (entityType) {
      case "song":
        return songs || [entity as Song];
      case "album":
        // Проверяем, это LibraryItem или обычный Album
        if ("type" in entity && entity.type === "album") {
          return entitySongs; // Для LibraryItem используем загруженные песни
        }
        return (entity as Album).songs?.length > 0
          ? (entity as Album).songs
          : entitySongs;
      case "playlist":
        // Проверяем, это LibraryItem или обычный Playlist
        if ("type" in entity && entity.type === "playlist") {
          return entitySongs; // Для LibraryItem используем загруженные песни
        }
        return (entity as Playlist).songs?.length > 0
          ? (entity as Playlist).songs
          : entitySongs;
      case "mix":
        // Проверяем, это LibraryItem или обычный Mix
        if ("type" in entity && entity.type === "mix") {
          return entitySongs; // Для LibraryItem используем загруженные песни
        }
        return (entity as Mix).songs?.length > 0
          ? (entity as Mix).songs
          : entitySongs;
      case "generated-playlist":
        // Проверяем, это LibraryItem или обычный GeneratedPlaylist
        if ("type" in entity && entity.type === "generated-playlist") {
          return entitySongs; // Для LibraryItem используем загруженные песни
        }
        return (entity as GeneratedPlaylist).songs?.length > 0
          ? (entity as GeneratedPlaylist).songs
          : entitySongs;
      case "artist":
        // Проверяем, это LibraryItem или обычный Artist
        if ("type" in entity && entity.type === "artist") {
          return entitySongs.length > 0 ? entitySongs.slice(0, 5) : [];
        }
        return entitySongs.length > 0
          ? entitySongs.slice(0, 5)
          : (entity as Artist).songs?.slice(0, 5) || [];
      default:
        return [];
    }
  };

  const getPlaybackContext = () => {
    switch (entityType) {
      case "song":
        return {
          type: "song" as const,
          entityId: entity._id,
          entityTitle: (entity as Song).title,
        };
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

  const songsToPlay = getSongsFromEntity();
  const playbackContext = getPlaybackContext();

  const isCurrentlyPlayingFromThisEntity =
    isPlaying &&
    currentSong &&
    songsToPlay.length > 0 &&
    songsToPlay.some((song) => song._id === currentSong._id) &&
    currentPlaybackContext &&
    currentPlaybackContext.type === entityType &&
    currentPlaybackContext.entityId === entity._id;

  const handlePlay = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClick) onClick(e);

    console.log(`UniversalPlayButton handlePlay:`, {
      entityType,
      entityId: entity._id,
      songsToPlay: songsToPlay.length,
      isLoadingSongs,
      entity,
    });

    if (songsToPlay.length === 0) {
      console.warn(`No songs available for ${entityType}:`, entity);
      return;
    }

    if (isCurrentlyPlayingFromThisEntity) {
      togglePlay();
    } else {
      // Для треков находим индекс конкретного трека в массиве
      let startIndex = 0;
      if (entityType === "song") {
        const songIndex = songsToPlay.findIndex(
          (song) => song._id === entity._id
        );
        startIndex = songIndex !== -1 ? songIndex : 0;
      }

      console.log(
        `Playing ${entityType} with ${songsToPlay.length} songs, startIndex: ${startIndex}`
      );
      playAlbum(songsToPlay, startIndex, playbackContext);
    }
  };

  // Показываем кнопку только если есть песни или они загружаются
  if (songsToPlay.length === 0 && !isLoadingSongs) {
    return null;
  }

  const getButtonStyles = () => {
    if (variant === "overlay") {
      return `hidden sm:flex bg-transparent hover:bg-transparent hover:scale-105 transition-all rounded-full w-6 h-6
        opacity-0 group-hover:opacity-100 ${className}`;
    }

    return `hidden sm:flex bg-violet-500 hover:bg-violet-400 hover:scale-105 transition-all rounded-full w-12 h-12
      opacity-0 translate-y-2 group-hover:translate-y-0 ${
        isCurrentlyPlayingFromThisEntity
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100"
      } ${className}`;
  };

  const getIconStyles = () => {
    if (variant === "overlay") {
      // Для overlay всегда показываем play, чтобы избежать дергания
      return <Play className="size-3 text-white fill-current" />;
    }

    return isCurrentlyPlayingFromThisEntity ? (
      <Pause className="size-5 text-black fill-current" />
    ) : (
      <Play className="size-5 text-black fill-current" />
    );
  };

  return (
    <Button size={"icon"} onClick={handlePlay} className={getButtonStyles()}>
      {getIconStyles()}
    </Button>
  );
};

export default UniversalPlayButton;
