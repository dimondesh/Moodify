// frontend/src/components/ui/DownloadButton.tsx

import { X } from "lucide-react";
import { useOfflineStore } from "@/stores/useOfflineStore";
import { Button } from "./button";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

type ItemType = "albums" | "playlists" | "mixes" | "generated-playlists";

interface DownloadButtonProps {
  itemId: string;
  itemType: ItemType;
  itemTitle: string;
  disabled?: boolean;
}

export const DownloadButton = ({
  itemId,
  itemType,
  itemTitle,
  disabled = false,
}: DownloadButtonProps) => {
  const { t } = useTranslation();
  const downloadedItemIds = useOfflineStore((s) => s.downloadedItemIds);
  const downloadingItemIds = useOfflineStore((s) => s.downloadingItemIds);
  const downloadProgress = useOfflineStore((s) => s.downloadProgress);
  const { downloadItem, deleteItem, cancelDownload, getDownloadProgress } =
    useOfflineStore((s) => s.actions);

  const isDownloaded = downloadedItemIds.has(itemId);
  const isDownloading = downloadingItemIds.has(itemId);
  const progress = getDownloadProgress(itemId);

  const status = isDownloaded
    ? "downloaded"
    : isDownloading
    ? "downloading"
    : "idle";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (disabled) return;

    if (status === "idle") {
      toast.promise(downloadItem(itemId, itemType), {
        loading: t("toasts.downloading", { itemTitle }),
        success: t("toasts.downloadSuccess", { itemTitle }),
        error: (err) => t("toasts.downloadError", { error: err.toString() }),
      });
    } else if (status === "downloading") {
      cancelDownload(itemId);
      toast.success(t("toasts.downloadCancelled", { itemTitle }));
    } else if (status === "downloaded") {
      deleteItem(itemId, itemType, itemTitle);
    }
  };

  const getTooltipText = () => {
    if (disabled) return t("auth.loginRequired");

    switch (status) {
      case "downloaded":
        return t("tooltips.removeFromDownloads", { itemTitle });
      case "downloading":
        return t("tooltips.cancelDownload", { itemTitle });
      case "idle":
      default:
        return t("tooltips.download", { itemTitle });
    }
  };

  return (
    <Button
      onClick={handleClick}
      variant="ghost"
      size="icon"
      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex-shrink-0 ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
      disabled={disabled}
      title={getTooltipText()}
    >
      {status === "downloading" && (
        <div className="relative group">
          <svg
            className="size-6 transform -rotate-90"
            xmlns="http://www.w3.org/2000/svg"
            width="100"
            height="100"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path
              d="M12 2 A 10 10 0 0 1 12 22"
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="3"
              strokeDasharray={`${2 * Math.PI * 10 * (progress / 100)} ${
                2 * Math.PI * 10
              }`}
              strokeLinecap="round"
            />
          </svg>
          <X className="absolute stroke-3 inset-0 m-auto size-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </div>
      )}
      {status === "downloaded" && (
        <svg
          className="size-6"
          xmlns="http://www.w3.org/2000/svg"
          width="100"
          height="100"
          fill="none"
          stroke="#000"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="#805AD5"
            stroke="#805AD5"
          ></circle>
          <path d="m16 12-4 4-4-4m4-4v7"></path>
        </svg>
      )}
      {status === "idle" && (
        <svg
          className="size-6"
          xmlns="http://www.w3.org/2000/svg"
          width="100"
          height="100"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {" "}
          <circle cx="12" cy="12" r="10" />
          <path d="M16 12l-4 4-4-4M12 8v7" />
        </svg>
      )}
    </Button>
  );
};
