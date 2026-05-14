import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePlaylistStore } from "@/stores/usePlaylistStore";
import type { Playlist } from "@/types";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Lock, MoreHorizontal, Unlock } from "lucide-react";

const DEFAULT_PLAYLIST_COVER =
  "https://moodify.b-cdn.net/default-album-cover.png";

function isDefaultPlaylistCoverUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  if (url === DEFAULT_PLAYLIST_COVER) return true;
  const u = url.toLowerCase();
  if (u.includes("default-album-cover")) return true;
  if (u.includes("default_playlist_cover")) return true;
  if (u.includes("default-song-cover")) return true;
  return false;
}

export interface PlaylistFormDialogProps {
  isOpen: boolean;
  playlist: Playlist | null;
  onClose: () => void;
  editSuccessCallback?: (() => void) | null;
}

export const PlaylistFormDialog: React.FC<PlaylistFormDialogProps> = ({
  isOpen,
  playlist,
  onClose,
  editSuccessCallback,
}) => {
  const { t } = useTranslation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [removeCoverOnSubmit, setRemoveCoverOnSubmit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { updatePlaylist, isLoading } = usePlaylistStore();

  useEffect(() => {
    if (!isOpen || !playlist) return;
    setTitle(playlist.title || "");
    setDescription(playlist.description || "");
    setIsPublic(playlist.isPublic ?? false);
    setImageFile(null);
    setImagePreviewUrl(playlist.imageUrl || null);
    setRemoveCoverOnSubmit(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [isOpen, playlist?._id, playlist]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (imagePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    if (file) {
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setRemoveCoverOnSubmit(false);
    }
  };

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose();
    },
    [onClose],
  );

  const handleEditCover = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDeleteCover = useCallback(() => {
    if (imagePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setRemoveCoverOnSubmit(true);
    setImagePreviewUrl(DEFAULT_PLAYLIST_COVER);
  }, [imagePreviewUrl]);

  const canDeleteCover =
    !!imageFile ||
    (!!imagePreviewUrl && !isDefaultPlaylistCoverUrl(imagePreviewUrl));

  const handleSave = async () => {
    if (!playlist) return;
    if (!title.trim()) {
      toast.error(t("pages.playlist.form.titleRequired"));
      return;
    }
    try {
      const updated = await updatePlaylist(
        playlist._id,
        title,
        description,
        isPublic,
        imageFile,
        removeCoverOnSubmit && !imageFile,
      );
      if (updated) {
        toast.success(t("pages.playlist.editDialog.saveSuccess"));
        editSuccessCallback?.();
        onClose();
      } else {
        toast.error(t("pages.playlist.form.saveError"));
      }
    } catch (error) {
      console.error("Playlist form submit error:", error);
      toast.error(t("pages.playlist.form.saveError"));
    }
  };

  if (!playlist) return null;

  const inputClass =
    "w-full rounded-none border border-[#3d3d3d] bg-[#1f1f1f] px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-[#8b5cf6] focus:outline-none focus:ring-0";

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "max-w-[calc(100vw-1.5rem)] gap-0 rounded-none border-0 bg-zinc-800/50 p-0 text-white shadow-xl sm:max-w-[560px]",
          "[&_[data-slot=dialog-close]]:text-zinc-300 [&_[data-slot=dialog-close]]:hover:text-white",
        )}
      >
        <DialogHeader className=" px-5 py-4 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight text-white">
            {t("pages.playlist.editDialog.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col p-5">
          <div className="grid gap-6 md:grid-cols-[200px_1fr] md:items-start">
            {/* Left: cover + visibility + save */}
            <div className="flex flex-col gap-4">
              <div
                className="relative aspect-square w-full max-w-[200 px] shrink-0 overflow-hidden rounded-none border border-[#3d3d3d] bg-[#1a1a1a] md:max-w-none"
                aria-label={t("pages.playlist.editDialog.fieldCover")}
              >
                <button
                  type="button"
                  onClick={handleEditCover}
                  className="group absolute inset-0 z-0 cursor-pointer border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#8b5cf6] focus-visible:ring-offset-0"
                  aria-label={t("pages.playlist.form.editCover")}
                >
                  {imagePreviewUrl ? (
                    <img
                      src={imagePreviewUrl}
                      alt=""
                      className="pointer-events-none h-full w-full object-cover transition-opacity group-hover:opacity-80"
                    />
                  ) : (
                    <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center text-xs text-zinc-500 transition-opacity group-hover:opacity-80">
                      <span className="text-zinc-400">
                        {t("pages.playlist.form.coverEmpty")}
                      </span>
                    </div>
                  )}
                </button>

                <div className="absolute top-2 right-2 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 rounded-none border border-[#3d3d3d] bg-black/55 text-white hover:bg-black/75 hover:text-white"
                        aria-label={t("pages.playlist.form.coverMenu")}
                      >
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="min-w-[10rem] rounded-none border border-[#3d3d3d] bg-[#1f1f1f] p-0 text-white"
                    >
                      <DropdownMenuItem
                        className="rounded-none focus:bg-zinc-800/50 focus:text-white"
                        onSelect={() => {
                          setTimeout(() => handleEditCover(), 0);
                        }}
                      >
                        {t("pages.playlist.form.editCover")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="rounded-none text-red-400 focus:bg-zinc-800/50 focus:text-red-300"
                        disabled={!canDeleteCover}
                        onSelect={() => {
                          if (canDeleteCover) handleDeleteCover();
                        }}
                      >
                        {t("pages.playlist.form.deleteCover")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
              />
            </div>

            {/* Right: title + description */}
            <div className="flex min-h-0 flex-col gap-4">
              <input
                id="playlist-form-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                required
                autoComplete="off"
                placeholder={t("pages.playlist.form.titlePlaceholder")}
              />

              <textarea
                id="playlist-form-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={cn(
                  inputClass,
                  "min-h-[120px] flex-1 resize-none py-2.5",
                )}
                rows={5}
                placeholder={t("pages.playlist.form.descriptionPlaceholder")}
              />
            </div>
          </div>
          <div className="flex flex-row items-center justify-between gap-3 mt-4">
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-none border border-[#3d3d3d] bg-transparent px-3 py-2 text-left text-xs font-medium text-white transition-colors hover:bg-[#333333] sm:text-sm"
            >
              {isPublic ? (
                <>
                  <Lock
                    className="h-4 w-4 shrink-0 text-zinc-300"
                    aria-hidden
                  />
                  <span>{t("pages.playlist.form.makePrivate")}</span>
                </>
              ) : (
                <>
                  <Unlock
                    className="h-4 w-4 shrink-0 text-zinc-300"
                    aria-hidden
                  />
                  <span>{t("pages.playlist.form.makePublic")}</span>
                </>
              )}
            </button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isLoading || !title.trim()}
              className="h-auto min-h-10 shrink-0 rounded-none bg-[#8b5cf6] px-5 text-sm font-medium text-white hover:bg-[#7c3aed]"
            >
              {isLoading
                ? t("admin.common.saving")
                : t("pages.playlist.editDialog.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
