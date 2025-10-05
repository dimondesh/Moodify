// frontend/src/components/ui/UniversalPlayButton.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
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
  PersonalMix,
  LibraryItem,
} from "@/types";

type EntityType =
  | "song"
  | "album"
  | "playlist"
  | "mix"
  | "artist"
  | "generated-playlist"
  | "personal-mix"
  | "liked-songs";

type UniversalPlayButtonProps = {
  entity:
    | Song
    | Album
    | Playlist
    | Mix
    | Artist
    | GeneratedPlaylist
    | PersonalMix
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
  const [loadedSongs, setLoadedSongs] = useState<Song[]>([]);
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);
  const loadedEntitiesRef = useRef<Set<string>>(new Set());

  // Извлекаем песни из entity для проверки
  const entitySongs = useMemo(() => {
    return (
      (entity as Album | Playlist | Mix | GeneratedPlaylist | PersonalMix)
        .songs || []
    );
  }, [entity]);

  // Загружаем песни для сущности при монтировании компонента
  useEffect(() => {
    const needsSongs = [
      "artist",
      "album",
      "playlist",
      "mix",
      "generated-playlist",
      "personal-mix",
      "liked-songs",
    ].includes(entityType);

    if (!needsSongs || isLoadingSongs) {
      return;
    }

    const entityKey = `${entityType}-${entity._id}`;

    // Если уже загружали эту сущность, не загружаем заново
    if (loadedEntitiesRef.current.has(entityKey)) {
      return;
    }

    const hasSongs = entitySongs.length > 0;
    const hasValidSongs = entitySongs.some((song) => song.hlsUrl);

    // Если песни есть и они валидные, не загружаем заново
    if (hasSongs && hasValidSongs) {
      loadedEntitiesRef.current.add(entityKey);
      return;
    }

    // Если уже загружаем или уже загружены, не загружаем заново
    if (entitySongs.length > 0) {
      loadedEntitiesRef.current.add(entityKey);
      return;
    }

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
      case "personal-mix":
        apiEndpoint = `/personal-mixes/${entity._id}`;
        break;
      case "liked-songs":
        apiEndpoint = `/library/liked-songs`;
        break;
    }

    if (apiEndpoint) {
      axiosInstance
        .get(apiEndpoint)
        .then((response) => {
          // Для альбомов данные приходят в формате { album: ... }
          // Для liked-songs данные приходят в формате { songs: ... }
          const songs =
            entityType === "album"
              ? response.data.album?.songs || []
              : entityType === "liked-songs"
              ? response.data.songs || []
              : response.data.songs || [];
          setLoadedSongs(songs);
          loadedEntitiesRef.current.add(entityKey);
        })
        .catch((error) => {
          console.error(`Failed to load ${entityType} songs:`, error);
          setLoadedSongs([]);
        })
        .finally(() => {
          setIsLoadingSongs(false);
        });
    } else {
      setIsLoadingSongs(false);
    }
  }, [entityType, entity._id, isLoadingSongs, entitySongs]);

  const songsToPlay = useMemo((): Song[] => {
    switch (entityType) {
      case "song":
        return songs || [entity as Song];
      case "album":
        // Проверяем, это LibraryItem или обычный Album
        if ("type" in entity && entity.type === "album") {
          return loadedSongs; // Для LibraryItem используем загруженные песни
        }
        return (entity as Album).songs?.length > 0
          ? (entity as Album).songs
          : loadedSongs;
      case "playlist":
        // Проверяем, это LibraryItem или обычный Playlist
        if ("type" in entity && entity.type === "playlist") {
          return loadedSongs; // Для LibraryItem используем загруженные песни
        }
        return (entity as Playlist).songs?.length > 0
          ? (entity as Playlist).songs
          : loadedSongs;
      case "mix":
        // Проверяем, это LibraryItem или обычный Mix
        if ("type" in entity && entity.type === "mix") {
          return loadedSongs; // Для LibraryItem используем загруженные песни
        }
        return (entity as Mix).songs?.length > 0
          ? (entity as Mix).songs
          : loadedSongs;
      case "generated-playlist":
        // Проверяем, это LibraryItem или обычный GeneratedPlaylist
        if ("type" in entity && entity.type === "generated-playlist") {
          return loadedSongs; // Для LibraryItem используем загруженные песни
        }
        return (entity as GeneratedPlaylist).songs?.length > 0
          ? (entity as GeneratedPlaylist).songs
          : loadedSongs;
      case "personal-mix":
        return (entity as PersonalMix).songs?.length > 0
          ? (entity as PersonalMix).songs
          : loadedSongs;
      case "liked-songs":
        // Для liked-songs всегда используем загруженные песни
        return loadedSongs;
      case "artist":
        // Проверяем, это LibraryItem или обычный Artist
        if (
          "type" in entity &&
          entity.type === "artist" &&
          !("songs" in entity)
        ) {
          // Это LibraryItem без песен, нужно загружать
          return loadedSongs.length > 0 ? loadedSongs.slice(0, 5) : [];
        }
        // Для артистов из ProfileSection песни уже приходят в entity.songs
        return (entity as Artist).songs?.slice(0, 5) || [];
      default:
        return [];
    }
  }, [entityType, loadedSongs, songs, entity]);

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
      case "personal-mix":
        return {
          type: "personal-mix" as const,
          entityId: entity._id,
          entityTitle: (entity as PersonalMix).name,
        };
      case "liked-songs":
        return {
          type: "liked-songs" as const,
          entityId: entity._id,
          entityTitle: (entity as LibraryItem).title,
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

    if (songsToPlay.length === 0) {
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
        ${
          isCurrentlyPlayingFromThisEntity
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100"
        } ${className}`;
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
      // Для overlay показываем play/pause в зависимости от состояния воспроизведения
      return isCurrentlyPlayingFromThisEntity ? (
        <Pause className="size-3 text-white fill-current" />
      ) : (
        <Play className="size-3 text-white fill-current" />
      );
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
