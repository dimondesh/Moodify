import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

type AlbumCoverDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coverUrl: string;
  albumTitle: string;
};

export function AlbumCoverDialog({
  open,
  onOpenChange,
  coverUrl,
  albumTitle,
}: AlbumCoverDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-none bg-transparent p-0 shadow-none flex justify-center max-w-4xl text-white">
        <DialogTitle className="sr-only">
          Album Cover {albumTitle}
        </DialogTitle>
        <img
          src={coverUrl}
          alt={albumTitle}
          className="max-h-[85vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
        />
      </DialogContent>
    </Dialog>
  );
}
