// frontend/src/pages/PlaylistPage/EditPlaylistDialog.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePlaylistStore } from "@/stores/usePlaylistStore";
import { Playlist } from "@/types";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

interface EditPlaylistDialogProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: Playlist | null;
  onSuccess: () => void;
}

export const EditPlaylistDialog: React.FC<EditPlaylistDialogProps> = ({
  isOpen,
  onClose,
  playlist,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState(playlist?.title || "");
  const [description, setDescription] = useState(playlist?.description || "");
  const [isPublic, setIsPublic] = useState(playlist?.isPublic ?? false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(
    playlist?.imageUrl || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { updatePlaylist, isLoading } = usePlaylistStore();

  useEffect(() => {
    if (playlist) {
      setTitle(playlist.title);
      setDescription(playlist.description || "");
      setIsPublic(playlist.isPublic ?? false);
      setImageFile(null);
      setImagePreviewUrl(playlist.imageUrl || null);
    } else {
      setTitle("");
      setDescription("");
      setIsPublic(false);
      setImageFile(null);
      setImagePreviewUrl(null);
    }
  }, [playlist]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    } else {
      setImageFile(null);
      setImagePreviewUrl(playlist?.imageUrl || null);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!playlist) {
      toast.error("No playlist selected for editing.");
      return;
    }
    if (!title.trim()) {
      toast.error("Playlist title cannot be empty.");
      return;
    }
    try {
      const updated = await updatePlaylist(
        playlist._id,
        title,
        description,
        isPublic,
        imageFile
      );
      if (updated) {
        toast.success("Playlist updated successfully!");
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error("Error updating playlist in dialog:", error);
    }
  }, [
    playlist,
    title,
    description,
    isPublic,
    imageFile,
    updatePlaylist,
    onClose,
    onSuccess,
  ]);

  const handleClose = useCallback(() => {
    if (playlist) {
      setTitle(playlist.title);
      setDescription(playlist.description || "");
      setIsPublic(playlist.isPublic ?? false);
      setImageFile(null);
      setImagePreviewUrl(playlist.imageUrl || null);
    } else {
      setTitle("");
      setDescription("");
      setIsPublic(false);
      setImageFile(null);
      setImagePreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  }, [onClose, playlist]);

  if (!playlist) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-zinc-900/70 backdrop-blur-md text-white border-zinc-700">
        <DialogHeader>
          <DialogTitle className="text-white">
            {t("pages.playlist.editDialog.title")}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {t("pages.playlist.editDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right text-white">
              {t("pages.playlist.editDialog.fieldTitle")}
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3 bg-zinc-800 text-white border-zinc-700 focus:ring-green-500"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right text-white">
              {t("pages.playlist.editDialog.fieldDescription")}
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3 min-h-[80px] bg-zinc-800 text-white border-zinc-700 rounded-md p-2 focus:ring-green-500 focus:border-green-500"
              rows={3}
              placeholder="A brief description of the playlist"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="image" className="text-right text-white">
              {t("pages.playlist.editDialog.fieldCover")}
            </Label>
            <div className="col-span-3">
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="file:text-sm file:font-medium file:cursor-pointer mb-2 bg-zinc-800 text-white border-zinc-700"
                ref={fileInputRef}
              />
              {imagePreviewUrl && (
                <img
                  src={imagePreviewUrl}
                  alt="Cover preview"
                  className="w-24 h-24 object-cover rounded-md mt-2"
                />
              )}
            </div>
          </div>
          <div className="flex items-center justify-start col-span-full mt-2">
            <Label htmlFor="public" className="text-white mr-4">
              {t("pages.playlist.editDialog.fieldPublic")}
            </Label>
            <Switch
              id="public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
              className="data-[state=checked]:bg-violet-500"
            />
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button
            onClick={handleClose}
            variant="outline"
            disabled={isLoading}
            className="bg-zinc-700 text-white hover:bg-zinc-600 border-none"
          >
            {t("admin.common.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-violet-500 hover:bg-violet-600 text-white"
          >
            {isLoading
              ? t("admin.common.saving")
              : t("admin.common.saveChanges")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
