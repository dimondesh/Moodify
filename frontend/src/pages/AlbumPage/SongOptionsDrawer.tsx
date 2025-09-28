// frontend/src/pages/AlbumPage/SongOptionsDrawer.tsx

import React, { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Share, Heart, Plus, User } from "lucide-react";
import { Song } from "@/types";
import { useUIStore } from "@/stores/useUIStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getArtistNames } from "@/lib/utils";
import AddToPlaylistSheet from "./AddToPlaylistSheet";
import { useHasFriends } from "@/hooks/useHasFriends";

interface SongOptionsDrawerProps {
  song: Song | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const SongOptionsDrawer: React.FC<SongOptionsDrawerProps> = ({
  song,
  isOpen,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openShareDialog } = useUIStore();
  const { isSongLiked, toggleSongLike } = useLibraryStore();
  const { hasFriends } = useHasFriends();
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);

  if (!song) return null;

  const songIsLiked = isSongLiked(song._id);

  const handleShare = () => {
    openShareDialog({ type: "song", id: song._id });
    onOpenChange(false);
  };

  const handleLikeToggle = async () => {
    await toggleSongLike(song._id);
  };

  const handleGoToArtist = () => {
    if (song.artist && song.artist.length > 0) {
      const artistId =
        typeof song.artist[0] === "string"
          ? song.artist[0]
          : song.artist[0]._id;
      navigate(`/artists/${artistId}`);
      onOpenChange(false);
    }
  };

  const handleAddToPlaylist = () => {
    setIsAddToPlaylistOpen(true);
  };

  return (
    <>
      <Drawer open={isOpen} onOpenChange={onOpenChange}>
        <DrawerContent
          className="bg-zinc-900 border-zinc-800 text-white pb-4"
          aria-describedby={undefined}
        >
          <div className="mx-auto w-full max-w-md">
            <DrawerHeader className="flex flex-col items-center text-center p-4 gap-4">
              <img
                src={song.imageUrl}
                alt={song.title}
                className="w-24 h-24 rounded-md"
              />
              <div>
                <DrawerTitle className="text-xl font-bold">
                  {song.title}
                </DrawerTitle>
                <p className="text-zinc-400">{getArtistNames(song.artist)}</p>
              </div>
            </DrawerHeader>
            <div className="p-4 flex flex-col gap-2">
              <Button
                variant="ghost"
                className={`justify-start p-3 h-auto ${
                  !hasFriends ? "opacity-50 cursor-not-allowed" : ""
                }`}
                onClick={handleShare}
                disabled={!hasFriends}
                title={
                  !hasFriends
                    ? t("common.noFriendsToShare")
                    : t("albumPage.options.share", "Поделиться")
                }
              >
                <Share className="w-5 h-5 mr-4" />
                <span className="text-base">
                  {t("albumPage.options.share", "Поделиться")}
                </span>
              </Button>
              <Button
                variant="ghost"
                className="justify-start p-3 h-auto"
                onClick={handleLikeToggle}
              >
                <Heart
                  className={`w-5 h-5 mr-4 ${
                    songIsLiked ? "fill-violet-500 text-violet-500" : ""
                  }`}
                />
                <span className="text-base">
                  {songIsLiked
                    ? t(
                        "albumPage.options.removeFromLiked",
                        "Удалить из любимых"
                      )
                    : t("albumPage.options.addToLiked", "Добавить в любимые")}
                </span>
              </Button>
              <Button
                variant="ghost"
                className="justify-start p-3 h-auto"
                onClick={handleAddToPlaylist}
              >
                <Plus className="w-5 h-5 mr-4" />
                <span className="text-base">
                  {t("albumPage.options.addToPlaylist", "Добавить в плейлист")}
                </span>
              </Button>
              {song.artist && song.artist.length > 0 && (
                <Button
                  variant="ghost"
                  className="justify-start p-3 h-auto"
                  onClick={handleGoToArtist}
                >
                  <User className="w-5 h-5 mr-4" />
                  <span className="text-base">
                    {t("albumPage.options.goToArtist", "Перейти к исполнителю")}
                  </span>
                </Button>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
      {song && (
        <AddToPlaylistSheet
          song={song}
          isOpen={isAddToPlaylistOpen}
          onOpenChange={(open) => {
            setIsAddToPlaylistOpen(open);
            if (!open) {
              onOpenChange(false);
            }
          }}
        />
      )}
    </>
  );
};

export default SongOptionsDrawer;
