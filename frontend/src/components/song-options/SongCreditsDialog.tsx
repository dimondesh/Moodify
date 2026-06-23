import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import type { Song } from "@/types";
import { getArtistNames } from "@/lib/utils";
import { formatLicenseLabel } from "./songCredits";

type SongCreditsDialogProps = {
  song: Song;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const linkClassName =
  "text-zinc-100 underline-offset-2 hover:underline focus:outline-none focus-visible:underline";

export function SongCreditsDialog({
  song,
  open,
  onOpenChange,
}: SongCreditsDialogProps) {
  const { t } = useTranslation();
  const artistNames = getArtistNames(song.artist);
  const licenseLabel = formatLicenseLabel(song.licenseCcUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-zinc-800 bg-zinc-900 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("songOptions.creditsDialog.title", "Credits")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-zinc-300">
          <p className="text-zinc-100">
            {t("songOptions.creditsDialog.work", {
              artist: artistNames,
              title: song.title,
              defaultValue: "{{artist}} — {{title}}",
            })}
          </p>
          {licenseLabel && song.licenseCcUrl && (
            <p>
              {t("songOptions.creditsDialog.licensePrefix", "Licensed under")}{" "}
              <a
                href={song.licenseCcUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClassName}
              >
                {licenseLabel}
              </a>
            </p>
          )}
          {song.sourceShareUrl && (
            <p>
              {t("songOptions.creditsDialog.sourcePrefix", "Source:")}{" "}
              <a
                href={song.sourceShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClassName}
              >
                {t("songOptions.creditsDialog.link", "View on Jamendo")}
              </a>{" "}
              ({t("songOptions.creditsDialog.via", "via Jamendo")})
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
