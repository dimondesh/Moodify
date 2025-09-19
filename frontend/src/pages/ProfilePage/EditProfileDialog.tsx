// frontend/src/pages/ProfilePage/EditProfileDialog.tsx

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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/useAuthStore";
import { User } from "@/types";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface EditProfileDialogProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditProfileDialog: React.FC<EditProfileDialogProps> = ({
  isOpen,
  onClose,
  user,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(
    user?.imageUrl || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { updateUserProfile, isLoading } = useAuthStore();

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setImageFile(null);
      setImagePreviewUrl(user.imageUrl || null);
    }
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    } else {
      setImageFile(null);
      setImagePreviewUrl(user?.imageUrl || null);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!fullName.trim()) {
      toast.error("Full Name cannot be empty.");
      return;
    }
    try {
      await updateUserProfile({ fullName: fullName, imageUrl: imageFile });
      toast.success("Profile updated successfully!");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error updating profile in dialog:", error);
    }
  }, [fullName, imageFile, updateUserProfile, onClose, onSuccess]);

  const handleClose = useCallback(() => {
    if (user) {
      setFullName(user.fullName);
      setImageFile(null);
      setImagePreviewUrl(user.imageUrl || null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  }, [onClose, user]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-zinc-900 text-white border-zinc-700">
        <DialogHeader>
          <DialogTitle className="text-white">
            {t("pages.editProfileDialog.title")}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {t("pages.editProfileDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="w-24 h-24 object-cover">
              <AvatarImage
                src={imagePreviewUrl || undefined}
                className="object-cover"
              />
              <AvatarFallback>{user.fullName?.[0] || "U"}</AvatarFallback>
            </Avatar>
            <Button
              type="button"
              variant="outline"
              className="bg-zinc-800 hover:bg-zinc-700 border-zinc-700"
              onClick={() => fileInputRef.current?.click()}
            >
              {t("pages.editProfileDialog.changePhoto")}
            </Button>
            <Input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="hidden"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-white">
              {t("pages.editProfileDialog.fullName")}
            </Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="bg-zinc-800 text-white border-zinc-700 focus:ring-violet-500"
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleClose}
            variant="outline"
            disabled={isLoading}
            className="bg-zinc-700 text-white hover:bg-zinc-600 border-none"
          >
            {t("pages.editProfileDialog.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("pages.editProfileDialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
