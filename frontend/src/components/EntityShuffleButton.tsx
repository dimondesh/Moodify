import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  readEntityShufflePref,
  type EntityType,
  type EntityShuffleMode,
} from "@/lib/entityShufflePrefs";
import SmartShuffle from "@/components/ui/smart-shuffle-icon";

interface EntityShuffleButtonProps {
  entityType: EntityType;
  entityId: string;
  supportsSmartShuffle: boolean;
  variant?: "page" | "bar";
  className?: string;
}

function clampMode(
  mode: EntityShuffleMode,
  supportsSmartShuffle: boolean,
): EntityShuffleMode {
  if (!supportsSmartShuffle && mode === "smart") return "regular";
  return mode;
}

export function EntityShuffleButton({
  entityType,
  entityId,
  supportsSmartShuffle,
  variant = "bar",
  className,
}: EntityShuffleButtonProps) {
  const { t } = useTranslation();
  const shuffleMode = usePlayerStore((s) => s.shuffleMode);
  const isAutoplayActive = usePlayerStore((s) => s.isAutoplayActive);
  const autoplaySourceContext = usePlayerStore((s) => s.autoplaySourceContext);
  const isActiveEntity = usePlayerStore(
    (s) =>
      s.currentPlaybackContext?.type === entityType &&
      s.currentPlaybackContext?.entityId === entityId,
  );
  const isAutoplaySourceEntity =
    isAutoplayActive &&
    autoplaySourceContext?.type === entityType &&
    autoplaySourceContext?.entityId === entityId;
  const savedPref = usePlayerStore((s) => {
    void s.entityShufflePrefsRevision;
    return readEntityShufflePref(entityType, entityId, supportsSmartShuffle);
  });
  const cycleEntityShufflePref = usePlayerStore(
    (s) => s.cycleEntityShufflePref,
  );

  const pref = isAutoplaySourceEntity
    ? "off"
    : clampMode(isActiveEntity ? shuffleMode : savedPref, supportsSmartShuffle);

  const handleClick = () => {
    if (isAutoplaySourceEntity) return;
    cycleEntityShufflePref(entityType, entityId, supportsSmartShuffle);
  };

  const title =
    pref === "smart"
      ? t("player.smartShuffle")
      : pref === "regular"
        ? t("player.shuffleOn")
        : t("player.shuffleOff");

  if (variant === "page") {
    return (
      <Button
        type="button"
        variant="ghost2"
        size="icon"
        onClick={handleClick}
        disabled={isAutoplaySourceEntity}
        title={title}
        aria-label={title}
        aria-pressed={pref !== "off"}
        className={cn(
          "relative w-12 h-12 sm:w-14 sm:h-14 rounded-full p-2 transition-colors group",
          pref !== "off" ? "text-[#8b5cf6]" : "text-white/80 hover:text-white",
          className,
        )}
      >
        {pref === "smart" ? (
          <SmartShuffle className="size-8" />
        ) : (
          <Shuffle className="size-8" />
        )}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isAutoplaySourceEntity}
      title={title}
      aria-label={title}
      aria-pressed={pref !== "off"}
      className={cn(
        "relative flex items-center justify-center transition-colors",
        pref !== "off" ? "text-violet-500" : "text-gray-400 hover:text-white",
        className,
      )}
    >
      {pref === "smart" ? (
        <SmartShuffle className={variant === "bar" ? "size-5.5" : "size-4.5"} />
      ) : (
        <Shuffle className={variant === "bar" ? "size-5.5" : "size-4.5"} />
      )}
    </button>
  );
}
