// frontend/src/pages/AdminPage/EditArtistDialog.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Upload } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { useMusicStore } from "../../stores/useMusicStore";
import { Artist } from "../../types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";

interface EditArtistDialogProps {
  artist: Artist | null;
  isOpen: boolean;
  onClose: () => void;
}

const EditArtistDialog = ({
  artist,
  isOpen,
  onClose,
}: EditArtistDialogProps) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const { updateArtist: updateArtistInStore } = useMusicStore();
  const [editedArtist, setEditedArtist] = useState({ name: "", bio: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [deleteBanner, setDeleteBanner] = useState(false);

  useEffect(() => {
    if (artist) {
      setEditedArtist({ name: artist.name, bio: artist.bio || "" });
      setImageFile(null);
      setBannerFile(null);
      setDeleteBanner(false);
    }
  }, [artist, isOpen]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImageFile(file);
  };

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      setDeleteBanner(false);
    }
  };

  const handleDeleteBanner = () => {
    setBannerFile(null);
    setDeleteBanner(true);
  };

  const handleSubmit = async () => {
    if (!artist) return;
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", editedArtist.name);
      formData.append("bio", editedArtist.bio);
      if (imageFile) formData.append("imageFile", imageFile);
      if (bannerFile) formData.append("bannerFile", bannerFile);
      else if (deleteBanner && artist.bannerUrl)
        formData.append("bannerUrl", "");
      await updateArtistInStore(artist._id, formData);
      onClose();
      toast.success("Artist updated successfully!");
    } catch (error: any) {
      console.error("Failed to update artist:", error);
      toast.error(
        "Failed to update artist: " +
          (error.response?.data?.message || error.message)
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-200 h-auto">
        <ScrollArea className="h-[73vh]">
          <DialogHeader>
            <DialogTitle className="text-zinc-200">
              {t("admin.artists.editDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.artists.editDialogDesc")}: {artist?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 text-zinc-200">
            <input
              type="file"
              ref={imageInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />
            <div
              className="flex items-center justify-center p-6 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer"
              onClick={() => imageInputRef.current?.click()}
            >
              <div className="text-center">
                <div className="p-3 bg-zinc-800 rounded-full inline-block mb-2">
                  <Upload className="h-6 w-6 text-zinc-400" />
                </div>
                <div className="text-sm text-zinc-400 mb-2">
                  {imageFile
                    ? imageFile.name
                    : artist?.imageUrl
                    ? `${t(
                        "admin.common.currentFile"
                      )} ${artist.imageUrl.substring(
                        artist.imageUrl.lastIndexOf("/") + 1
                      )}`
                    : t("admin.artists.uploadImageRequired")}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  disabled={isLoading}
                >
                  {t("admin.artists.chooseImage")}
                </Button>
              </div>
            </div>
            <input
              type="file"
              ref={bannerInputRef}
              onChange={handleBannerSelect}
              accept="image/*"
              className="hidden"
            />
            <div
              className="flex items-center justify-center p-6 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer"
              onClick={() => bannerInputRef.current?.click()}
            >
              <div className="text-center">
                <div className="p-3 bg-zinc-800 rounded-full inline-block mb-2">
                  <Upload className="h-6 w-6 text-zinc-400" />
                </div>
                <div className="text-sm text-zinc-400 mb-2">
                  {bannerFile
                    ? bannerFile.name
                    : deleteBanner
                    ? t("admin.artists.bannerWillBeRemoved")
                    : artist?.bannerUrl
                    ? `${t(
                        "admin.common.currentFile"
                      )} ${artist.bannerUrl.substring(
                        artist.bannerUrl.lastIndexOf("/") + 1
                      )}`
                    : t("admin.artists.uploadBannerOptional")}
                </div>
                <div className="flex justify-center gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={isLoading}
                  >
                    {t("admin.artists.chooseBanner")}
                  </Button>
                  {artist?.bannerUrl && !deleteBanner && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-xs"
                      onClick={handleDeleteBanner}
                      disabled={isLoading}
                    >
                      {t("admin.artists.removeBanner")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("admin.artists.fieldName")}
              </label>
              <Input
                value={editedArtist.name}
                onChange={(e) =>
                  setEditedArtist({ ...editedArtist, name: e.target.value })
                }
                className="bg-zinc-800 border-zinc-700"
                placeholder={t("admin.artists.placeholderName")}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("admin.artists.fieldBioOptional")}
              </label>
              <Textarea
                value={editedArtist.bio}
                onChange={(e) =>
                  setEditedArtist({ ...editedArtist, bio: e.target.value })
                }
                className="bg-zinc-800 border-zinc-700 resize-y"
                placeholder={t("admin.artists.placeholderBio")}
                rows={4}
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="text-zinc-200"
            >
              {t("admin.common.cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-orange-500 hover:bg-orange-600 text-zinc-200"
              disabled={isLoading || !editedArtist.name}
            >
              {isLoading
                ? t("admin.common.updating")
                : t("admin.common.saveChanges")}
            </Button>
          </DialogFooter>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default EditArtistDialog;
