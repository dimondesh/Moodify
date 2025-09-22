/* eslint-disable @typescript-eslint/no-unused-vars */
// src/layout/AddToPlaylistControl.tsx

import React, { useEffect, useState, useMemo, memo } from "react";
import { Button } from "../components/ui/button";
import { Check, Plus, Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet";
import { useLibraryStore } from "../stores/useLibraryStore";
import { usePlaylistStore } from "../stores/usePlaylistStore";
import { Playlist, Song } from "../types";
import toast from "react-hot-toast";
import { ScrollArea } from "../components/ui/scroll-area";
import { Input } from "../components/ui/input";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";

interface PlaylistMenuContentProps {
  song: Song;
  isLikedInitial: boolean;
  playlistsWithSongInitial: string[];
  allOwnedPlaylists: Playlist[];
  onClose: () => void;
}

const PlaylistMenuContent: React.FC<PlaylistMenuContentProps> = memo(
  ({
    song,
    isLikedInitial,
    playlistsWithSongInitial,
    allOwnedPlaylists,
    onClose,
  }) => {
    const { t } = useTranslation();
    const { toggleSongLike } = useLibraryStore();
    const {
      addSongToPlaylist,
      removeSongFromPlaylist,
      createPlaylistFromSong,
    } = usePlaylistStore();

    const [searchTerm, setSearchTerm] = useState("");

    const filteredPlaylists = useMemo(
      () =>
        allOwnedPlaylists.filter((playlist) =>
          playlist.title.toLowerCase().includes(searchTerm.toLowerCase())
        ),
      [allOwnedPlaylists, searchTerm]
    );

    const handlePlaylistToggle = async (
      playlistId: string,
      shouldBeInPlaylist: boolean
    ) => {
      try {
        if (shouldBeInPlaylist) {
          await addSongToPlaylist(playlistId, song._id);
        } else {
          await removeSongFromPlaylist(playlistId, song._id);
        }
      } catch (e) {
        toast.error(t("player.playlistUpdateError"));
      }
    };

    const handleCreateAndAdd = async () => {
      onClose();
      await createPlaylistFromSong(song);
    };

    const handleLikeToggle = async (_shouldBeLiked: boolean) => {
      await toggleSongLike(song._id);
    };

    const CheckboxItem = ({
      checked,
      onCheckedChange,
      imageUrl,
      title,
      subtitle,
    }: {
      checked: boolean;
      onCheckedChange: (checked: boolean) => void;
      imageUrl?: string;
      title: string;
      subtitle?: string;
    }) => (
      <div
        className="flex items-center gap-3 p-2 rounded-md hover:bg-[#2a2a2a] cursor-pointer"
        onClick={() => onCheckedChange(!checked)}
      >
        {imageUrl && (
          <img
            src={imageUrl}
            alt={title}
            className="w-12 h-12 object-cover rounded-md"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate max-w-50">{title}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
        <div
          className={cn(
            "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0",
            checked
              ? "bg-violet-600 border-violet-600"
              : "border-gray-500 group-hover:border-white"
          )}
        >
          {checked && <Check className="w-4 h-4 text-white" />}
        </div>
      </div>
    );

    return (
      <div className="flex flex-col gap-4]">
        <Button
          variant="secondary"
          className="w-[200px] justify-center rounded-md bg-violet-700 hover:bg-violet-500 mx-auto mb-4"
          onClick={handleCreateAndAdd}
        >
          <Plus className="mr-2 h-5 w-5" /> {t("player.newPlaylist")}
        </Button>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder={t("player.findPlaylist")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-[#2a2a2a]/80 border-[#2a2a2a] pl-9"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <ScrollArea className="h-[70vh] max-h-[70vh] pr-3 lg:max-h-[30vh] lg:min-h-[20vh] overflow-hidden">
          <div className="space-y-1">
            <CheckboxItem
              checked={isLikedInitial}
              onCheckedChange={handleLikeToggle}
              imageUrl="/liked.png"
              title={t("sidebar.likedSongs")}
            />
            {filteredPlaylists.map((playlist) => (
              <CheckboxItem
                key={playlist._id}
                checked={playlistsWithSongInitial.includes(playlist._id)}
                onCheckedChange={(checked) =>
                  handlePlaylistToggle(playlist._id, checked)
                }
                imageUrl={playlist.imageUrl}
                title={playlist.title}
                subtitle={`${playlist.songs.length} ${t(
                  "sidebar.subtitle.songs"
                )}`}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }
);
PlaylistMenuContent.displayName = "PlaylistMenuContent";

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    window.addEventListener("resize", listener);
    return () => window.removeEventListener("resize", listener);
  }, [matches, query]);
  return matches;
};

interface AddToPlaylistControlProps {
  song: Song | null;
  className?: string;
  iconClassName?: string;
}

export const AddToPlaylistControl: React.FC<AddToPlaylistControlProps> = ({
  song,
  className,
  iconClassName = "size-5",
}) => {
  const { t } = useTranslation();
  const { isSongLiked, toggleSongLike } = useLibraryStore();
  const { ownedPlaylists, fetchOwnedPlaylists } = usePlaylistStore();
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (song) {
      fetchOwnedPlaylists();
    }
  }, [song, fetchOwnedPlaylists]);

  if (!song) return null;

  const isLiked = isSongLiked(song._id);
  const playlistsWithSong = ownedPlaylists
    .filter((p) => p.songs.some((s) => s._id === song._id))
    .map((p) => p._id);

  const isAdded = isLiked || playlistsWithSong.length > 0;

  const handleInitialAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdded) {
      await toggleSongLike(song._id);
      toast.success(t("player.addedToLiked"));
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (isAdded) {
      setIsOpen(open);
    }
  };

  const TriggerButton = (
    <Button
      size="icon"
      variant="ghost"
      className={cn(
        "hover:text-white",
        isAdded ? "text-violet-500" : "text-zinc-400",
        className
      )}
      onClick={handleInitialAdd}
      title={isAdded ? t("player.addToPlaylist") : t("player.saveToLibrary")}
    >
      {isAdded ? (
        <Check className={cn(iconClassName)} />
      ) : (
        <Plus className={cn(iconClassName)} />
      )}
    </Button>
  );

  return (
    <>
      {isMobile ? (
        <Sheet open={isAdded && isOpen} onOpenChange={handleOpenChange}>
          <SheetTrigger asChild>{TriggerButton}</SheetTrigger>
          <SheetContent
            aria-describedby={undefined}
            side="bottom"
            className="bg-zinc-900/80 backdrop-blur-lg border-zinc-800 text-white rounded-t-2xl h-full z-100 px-4"
          >
            <SheetHeader className="text-center">
              <SheetTitle>{t("player.addToPlaylist")}</SheetTitle>
            </SheetHeader>
            <PlaylistMenuContent
              song={song}
              isLikedInitial={isLiked}
              playlistsWithSongInitial={playlistsWithSong}
              allOwnedPlaylists={ownedPlaylists}
              onClose={() => setIsOpen(false)}
            />
            <Button
              onClick={() => setIsOpen(false)}
              className="w-[80px] mt-4 bg-violet-700 hover:bg-violet-600 mx-auto absolute inset-0 top-[90%]"
            >
              {t("player.done")}
            </Button>
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={isAdded && isOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>{TriggerButton}</PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            className="w-80 bg-[#0f0f0f]/70 backdrop-blur-md border-zinc-700 text-white p-4"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <PlaylistMenuContent
              song={song}
              isLikedInitial={isLiked}
              playlistsWithSongInitial={playlistsWithSong}
              allOwnedPlaylists={ownedPlaylists}
              onClose={() => setIsOpen(false)}
            />
          </PopoverContent>
        </Popover>
      )}
    </>
  );
};
