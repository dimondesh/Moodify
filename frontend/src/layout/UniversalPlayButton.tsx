// frontend/src/components/ui/UniversalPlayButton.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { fetchEntitySongsForPlay } from "@/lib/api/music";
import type { Song, Album, Playlist, Artist, LibraryItem } from "@/types";
import { useTranslation } from "react-i18next";
import { getPlaylistDisplayTitle } from "@/lib/entitySection";

type EntityType = "song" | "album" | "playlist" | "artist";

type UniversalPlayButtonProps = {
  entity: Song | Album | Playlist | Artist | LibraryItem;
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
  const { t, i18n } = useTranslation();
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
    return (entity as Album | Playlist | Artist).songs || [];
  }, [entity]);

  // Загружаем песни для сущности при монтировании компонента
  useEffect(() => {
    const needsSongs = ["artist", "album", "playlist"].includes(entityType);

    if (!needsSongs || isLoadingSongs) {
      return;
    }

    const entityKey = `${entityType}-${entity._id}`;

    // Если уже загружали эту сущность, не загружаем заново
    if (loadedEntitiesRef.current.has(entityKey)) {
      return;
    }

    const hasSongs = entitySongs.length > 0;
    const populatedSongs = entitySongs.every(
      (s) =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as Song)._id === "string" &&
        (s as Song)._id.length > 0,
    );

    if (hasSongs && populatedSongs) {
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
    }

    if (apiEndpoint) {
      fetchEntitySongsForPlay(
        entityType as "artist" | "album" | "playlist",
        entity._id,
      )
        .then((songs) => {
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
        if ("type" in entity && entity.type === "album") {
          return loadedSongs;
        }
        {
          const a = entity as Album;
          return loadedSongs.length > 0
            ? loadedSongs
            : a.songs?.length
              ? a.songs
              : [];
        }
      case "playlist":
        if ("type" in entity && entity.type === "playlist") {
          return loadedSongs;
        }
        {
          const p = entity as Playlist;
          return loadedSongs.length > 0
            ? loadedSongs
            : p.songs?.length
              ? p.songs
              : [];
        }
      case "artist":
        if (
          "type" in entity &&
          entity.type === "artist" &&
          !("songs" in entity)
        ) {
          return loadedSongs.length > 0 ? loadedSongs.slice(0, 5) : [];
        }
        {
          const a = entity as Artist;
          const slice = a.songs?.slice(0, 5) || [];
          return loadedSongs.length > 0 ? loadedSongs.slice(0, 5) : slice;
        }
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
          entityTitle: getPlaylistDisplayTitle(
            entity as Playlist,
            i18n.language,
            t,
          ),
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

  const isCurrentlyPlayingFromThisEntity = useMemo(() => {
    if (!isPlaying || !currentSong) return false;

    // Для конкретного трека (entityType="song") важен только факт,
    // что текущая песня совпадает с entity. currentPlaybackContext при
    // переключении next/prev может оставаться прежним и не должен ломать UI.
    if (entityType === "song") {
      return currentSong._id === entity._id;
    }

    return (
      songsToPlay.length > 0 &&
      songsToPlay.some((song) => song._id === currentSong._id) &&
      !!currentPlaybackContext &&
      currentPlaybackContext.type === entityType &&
      currentPlaybackContext.entityId === entity._id
    );
  }, [
    isPlaying,
    currentSong,
    entityType,
    entity._id,
    songsToPlay,
    currentPlaybackContext,
  ]);

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
