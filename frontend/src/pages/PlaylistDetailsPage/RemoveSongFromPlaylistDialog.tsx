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
import type { TFunction } from "i18next";

type RemoveSongFromPlaylistDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  t: TFunction;
};

export function RemoveSongFromPlaylistDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  t,
}: RemoveSongFromPlaylistDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-zinc-900 text-white border-0">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">
            {t("pages.playlist.removeSongDialog.title")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            {t("pages.playlist.removeSongDialog.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onCancel}
            className="bg-zinc-700 text-white hover:bg-zinc-600 border-none"
          >
            {t("pages.playlist.removeSongDialog.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={onConfirm}
          >
            {t("pages.playlist.removeSongDialog.remove")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
