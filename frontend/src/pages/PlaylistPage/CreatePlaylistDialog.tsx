// frontend/src/pages/PlaylistPage/CreatePlaylistDialog.tsx

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { usePlaylistStore } from "../../stores/usePlaylistStore";
import toast from "react-hot-toast";
import { Playlist } from "../../types";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WandSparkles, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CreatePlaylistDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Playlist | null;
  onSuccess?: () => void;
}

export const CreatePlaylistDialog: React.FC<CreatePlaylistDialogProps> = ({
  isOpen,
  onClose,
  initialData,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const { createPlaylist, updatePlaylist, generateAiPlaylist, isLoading } =
    usePlaylistStore();

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title || "");
        setDescription(initialData.description || "");
        setIsPublic(initialData.isPublic);
        setImagePreviewUrl(initialData.imageUrl || null);
        setImageFile(null);
      } else {
        setTitle("");
        setDescription("");
        setIsPublic(false);
        setImageFile(null);
        setImagePreviewUrl(null);
        setPrompt("");
      }
    }
  }, [initialData, isOpen]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Название плейлиста не может быть пустым.");
      return;
    }
    try {
      if (initialData) {
        await updatePlaylist(
          initialData._id,
          title,
          description,
          isPublic,
          imageFile
        );
        toast.success("Плейлист обновлен!");
      } else {
        await createPlaylist(title, description, isPublic, imageFile);
        toast.success("Плейлист создан!");
      }
      onClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Ошибка операции с плейлистом:", error);
      toast.error("Не удалось сохранить плейлист.");
    }
  };

  const handleAiGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Пожалуйста, опишите плейлист, который вы хотите.");
      return;
    }
    setIsGenerating(true);
    const newPlaylist = await generateAiPlaylist(prompt);
    setIsGenerating(false);

    if (newPlaylist) {
      onClose();
      navigate(`/playlists/${newPlaylist._id}`);
    }
  };

  const dialogTitle = initialData
    ? t("pages.playlist.editDialog.title")
    : t("pages.playlist.createDialog.title");
  const dialogDescription = initialData
    ? t("pages.playlist.editDialog.description")
    : t("pages.playlist.createDialog.description");
  const submitButtonText = initialData
    ? t("pages.playlist.editDialog.save")
    : t("pages.playlist.createDialog.buttonText");
  const submittingText = initialData
    ? t("admin.common.saving")
    : t("admin.common.creating");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-[#0f0f0f]/70 backdrop-blur-md   text-white border-[#2a2a2a] z-[120]">
        <DialogHeader>
          <DialogTitle className="text-white">{dialogTitle}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        {initialData ? (
          <form onSubmit={handleManualSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title-edit" className="text-right text-white">
                {t("pages.playlist.editDialog.fieldTitle")}
              </Label>
              <Input
                id="title-edit"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="col-span-3 bg-zinc-800 text-white border-zinc-700"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="description-edit"
                className="text-right text-white"
              >
                {t("pages.playlist.editDialog.fieldDescription")}
              </Label>
              <Textarea
                id="description-edit"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="col-span-3 bg-zinc-800 text-white border-zinc-700"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="image-edit" className="text-right text-white">
                {t("pages.playlist.editDialog.fieldCover")}
              </Label>
              <Input
                id="image-edit"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="col-span-3 bg-zinc-800 text-white border-zinc-700 file:text-white file:bg-zinc-700 file:border-none hover:file:bg-zinc-600"
              />
            </div>
            {imagePreviewUrl && (
              <div className="flex justify-center">
                <img
                  src={imagePreviewUrl}
                  alt="Preview"
                  className="max-w-[100px] rounded-md"
                />
              </div>
            )}
            <div className="flex items-center justify-between col-span-full mt-2 pl-4 pr-4">
              <Label htmlFor="isPublic-edit" className="text-white">
                {t("pages.playlist.editDialog.fieldPublic")}
              </Label>
              <Switch
                id="isPublic-edit"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                {t("admin.common.cancel")}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? submittingText : submitButtonText}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <Tabs defaultValue="manual" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-[#2a2a2a]">
              <TabsTrigger value="manual">
                {t("pages.playlist.createDialog.manual")}
              </TabsTrigger>
              <TabsTrigger value="ai">
                {t("pages.playlist.createDialog.withAi")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual">
              <div className="min-h-[360px] flex flex-col">
                <form
                  onSubmit={handleManualSubmit}
                  className="flex flex-col flex-grow gap-4 py-4"
                >
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label
                      htmlFor="title-manual"
                      className="text-right text-white"
                    >
                      {t("pages.playlist.editDialog.fieldTitle")}
                    </Label>
                    <Input
                      id="title-manual"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="col-span-3 bg-[#2a2a2a] text-white border-[#2a2a2a]"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label
                      htmlFor="description-manual"
                      className="text-right text-white"
                    >
                      {t("pages.playlist.editDialog.fieldDescription")}
                    </Label>
                    <Textarea
                      id="description-manual"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="col-span-3 bg-[#2a2a2a] text-white border-[#2a2a2a]"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label
                      htmlFor="image-manual"
                      className="text-right text-white"
                    >
                      {t("pages.playlist.editDialog.fieldCover")}
                    </Label>
                    <Input
                      id="image-manual"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="col-span-3 bg-zinc-800 text-white border-zinc-700 file:text-white file:bg-zinc-700 file:border-none hover:file:bg-zinc-600"
                    />
                  </div>
                  {imagePreviewUrl && (
                    <div className="flex justify-center">
                      <img
                        src={imagePreviewUrl}
                        alt="Preview"
                        className="max-w-[100px] rounded-md"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-start col-span-full mt-2 pr-4">
                    <Label
                      htmlFor="isPublic-manual"
                      className="text-white mr-4"
                    >
                      {t("pages.playlist.editDialog.fieldPublic")}
                    </Label>
                    <Switch
                      id="isPublic-manual"
                      checked={isPublic}
                      onCheckedChange={setIsPublic}
                    />
                  </div>
                  <DialogFooter className="mt-auto pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      disabled={isLoading}
                    >
                      {t("admin.common.cancel")}
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? submittingText : submitButtonText}
                    </Button>
                  </DialogFooter>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="ai">
              <div className="min-h-[360px] flex flex-col">
                <div className="flex flex-col flex-grow gap-4 py-4">
                  <Label htmlFor="ai-prompt" className="text-white">
                    {t("pages.playlist.createDialog.aiPromptLabel")}
                  </Label>
                  <Textarea
                    id="ai-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="col-span-3 bg-zinc-800 text-white border-zinc-700 flex-grow"
                    placeholder={t(
                      "pages.playlist.createDialog.aiPromptPlaceholder"
                    )}
                  />
                  <DialogFooter className="mt-auto pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      disabled={isGenerating}
                    >
                      {t("admin.common.cancel")}
                    </Button>
                    <Button
                      onClick={handleAiGenerate}
                      disabled={isGenerating || !prompt.trim()}
                      className="bg-violet-600 hover:bg-violet-700"
                    >
                      {isGenerating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <WandSparkles className="mr-2 h-4 w-4" />
                      )}
                      {isGenerating
                        ? t("pages.playlist.createDialog.generating")
                        : t("pages.playlist.createDialog.generate")}
                    </Button>
                  </DialogFooter>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
