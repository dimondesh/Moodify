import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";

type DuplicateSongInPlaylistDialogProps = {
  open: boolean;
  playlistTitle: string;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirmAdd: () => void;
};

export function DuplicateSongInPlaylistDialog({
  open,
  playlistTitle,
  onOpenChange,
  onCancel,
  onConfirmAdd,
}: DuplicateSongInPlaylistDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[#0f0f0f] text-white border border-[#2a2a2a]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">
            {t("songOptions.duplicateDialog.title", "Track already in playlist")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            {t("songOptions.duplicateDialog.description", {
              playlist: playlistTitle,
              defaultValue:
                "This track is already in «{{playlist}}». Add it again?",
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onCancel}
            className="rounded-none bg-zinc-800/50 text-white hover:bg-zinc-700 border-none"
          >
            {t("songOptions.duplicateDialog.cancel", "Don't add")}
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-none bg-[#8b5cf6] text-white hover:bg-[#7c4fe0]"
            onClick={onConfirmAdd}
          >
            {t("songOptions.duplicateDialog.confirm", "Add anyway")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
