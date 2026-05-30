import React, { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { Song } from "@/types";
import { useTranslation } from "react-i18next";
import { cn, getArtistNames } from "@/lib/utils";
import AddSongToPlaylistSheet from "@/components/AddSongToPlaylistSheet";
import { CoverImage } from "@/components/CoverImage";
import { CDN_DEFAULT_ALBUM_COVER } from "@/lib/cdn";
import { SongOptionsDropdownContent } from "@/components/song-options/SongOptionsDropdownContent";
import { SongOptionsDrawerContent } from "@/components/song-options/SongOptionsDrawerContent";
import { useSongOptionsActions } from "@/components/song-options/useSongOptionsActions";

export type SongOptionsContext = "album" | "playlist";

export interface SongOptionsMenuProps {
  song: Song;
  context: SongOptionsContext;
  variant: "dropdown" | "drawer";
  playlistId?: string;
  isOwner?: boolean;
  className?: string;
}

const SongOptionsMenu: React.FC<SongOptionsMenuProps> = ({
  song,
  context,
  variant,
  playlistId = "",
  isOwner = false,
  className,
}) => {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const onClose = () => {
    setDrawerOpen(false);
    setDropdownOpen(false);
  };

  const triggerButton = (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "rounded-full size-7 shrink-0 hover:bg-transparent!",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      title={t("common.moreOptions", "More options")}
    >
      <MoreHorizontal className="h-5 w-5 text-zinc-400 group-hover:text-white" />
    </Button>
  );

  const isPlaylist = context === "playlist";

  const actions = useSongOptionsActions(
    song,
    context,
    playlistId,
    isOwner,
    onClose,
  );

  if (variant === "dropdown") {
    return (
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
        <SongOptionsDropdownContent
          song={song}
          context={context}
          playlistId={playlistId}
          isOwner={isOwner}
          onClose={onClose}
        />
      </DropdownMenu>
    );
  }

  return (
    <>
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} modal>
        <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
        <DrawerContent
          hideHandle
          className="border-zinc-800 bg-zinc-900 pb-4 text-zinc-100"
          aria-describedby={undefined}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto w-full max-w-md">
            <DrawerHeader className="flex flex-col items-center gap-4 p-4 text-center">
              <CoverImage
                entity={song}
                size="card"
                defaultUrl={CDN_DEFAULT_ALBUM_COVER}
                alt={song.title}
                className="pointer-events-none size-24 rounded-md object-cover select-none"
                draggable={false}
              />
              <div className="pointer-events-none select-none">
                <DrawerTitle className="text-xl font-bold">{song.title}</DrawerTitle>
                <p className="text-zinc-400">{getArtistNames(song.artist)}</p>
              </div>
            </DrawerHeader>
            <SongOptionsDrawerContent actions={actions} />
          </div>
        </DrawerContent>
      </Drawer>
      <AddSongToPlaylistSheet
        song={song}
        isOpen={actions.isAddToPlaylistOpen}
        notifyPlaylistMembershipChanges={isPlaylist}
        notifyLibraryChanges={isPlaylist}
        onOpenChange={actions.setIsAddToPlaylistOpen}
      />
    </>
  );
};

export default SongOptionsMenu;
