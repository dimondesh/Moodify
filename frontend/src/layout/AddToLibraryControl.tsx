/* eslint-disable @typescript-eslint/no-unused-vars */
// src/layout/AddToLibraryControl.tsx

import React, { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Heart, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuItem,
} from "../components/ui/dropdown-menu";
import { useLibraryStore } from "../stores/useLibraryStore";
import { usePlaylistStore } from "../stores/usePlaylistStore";
import { Song } from "../types";
import toast from "react-hot-toast";
import { useUIStore } from "../stores/useUIStore";

interface AddToLibraryControlProps {
  song: Song | null;
  className?: string;
  iconClassName?: string;
}

export const AddToLibraryControl: React.FC<AddToLibraryControlProps> = ({
  song,
  className,
  iconClassName = "h-5 w-5",
}) => {
  const { isSongLiked, toggleSongLike, likedSongs } = useLibraryStore();
  const {
    myPlaylists,
    fetchMyPlaylists,
    addSongToPlaylist,
    removeSongFromPlaylist,
  } = usePlaylistStore();
  const { openCreatePlaylistDialog } = useUIStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [songInPlaylists, setSongInPlaylists] = useState<string[]>([]);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    if (song) {
      fetchMyPlaylists();
    }
  }, [song, fetchMyPlaylists]);

  useEffect(() => {
    if (song) {
      const liked = isSongLiked(song._id);
      const playlistsWithSong = myPlaylists
        .filter((p) => p.songs.some((s) => s._id === song._id))
        .map((p) => p._id);

      setIsLiked(liked);
      setSongInPlaylists(playlistsWithSong);
    }
  }, [song, myPlaylists, likedSongs, isSongLiked]);

  if (!song) return null;

  const isAdded = isLiked || songInPlaylists.length > 0;

  const handleInitialAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdded) {
      await toggleSongLike(song._id);
      toast.success("Added to Liked Songs");
    }
  };

  const handlePlaylistToggle = async (
    playlistId: string,
    shouldBeInPlaylist: boolean
  ) => {
    try {
      if (shouldBeInPlaylist) {
        await addSongToPlaylist(playlistId, song._id);
        toast.success(`Added to playlist`);
      } else {
        await removeSongFromPlaylist(playlistId, song._id);
        toast.success(`Removed from playlist`);
      }
    } catch (e) {
      toast.error("Could not update playlist.");
    }
  };

  const handleLikeToggle = async (shouldBeLiked: boolean) => {
    if (isLiked !== shouldBeLiked) {
      await toggleSongLike(song._id);
      toast.success(
        shouldBeLiked ? "Added to Liked Songs" : "Removed from Liked Songs"
      );
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (isAdded) {
      setIsMenuOpen(open);
    }
  };

  return (
    <DropdownMenu open={isAdded && isMenuOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={`hover:text-white ${
            isAdded ? "text-violet-500" : "text-zinc-400"
          } ${className}`}
          onClick={handleInitialAdd}
          title={isAdded ? "Add to playlist" : "Save to Your Library"}
        >
          <Heart
            className={`${iconClassName} ${isAdded ? "fill-current" : ""}`}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="end"
        className="w-56 bg-zinc-800 border-zinc-700 text-white z-100"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuLabel>Add to...</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-zinc-700" />
        <DropdownMenuCheckboxItem
          checked={isLiked}
          onCheckedChange={handleLikeToggle}
        >
          Liked Songs
        </DropdownMenuCheckboxItem>
        {myPlaylists.map((playlist) => (
          <DropdownMenuCheckboxItem
            key={playlist._id}
            checked={songInPlaylists.includes(playlist._id)}
            onCheckedChange={(checked) =>
              handlePlaylistToggle(playlist._id, checked)
            }
          >
            <span className="truncate">{playlist.title}</span>
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator className="bg-zinc-700" />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setIsMenuOpen(false);
            openCreatePlaylistDialog();
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          <span>New Playlist</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
