// frontend/src/components/DynamicTitleUpdater.tsx

import { useEffect } from "react";
import { usePlayerStore } from "../stores/usePlayerStore";
import { getArtistNames } from "../lib/utils";
import { SITE_NAME } from "@/lib/site-meta";

const DynamicTitleUpdater = () => {
  const {
    currentSong,
    isPlaying,
    isDesktopLyricsOpen,
    isMobileLyricsFullScreen,
  } = usePlayerStore();

  useEffect(() => {
    const isLyricsOpen = isDesktopLyricsOpen || isMobileLyricsFullScreen;

    if (!currentSong) {
      document.title = SITE_NAME;
      return;
    }

    const artistName = getArtistNames(currentSong.artist);

    if (isLyricsOpen) {
      document.title = `Lyrics: ${currentSong.title} by ${artistName}`;
    } else if (isPlaying) {
      document.title = `${currentSong.title} • ${artistName}`;
    } else {
      document.title = SITE_NAME;
    }
  }, [currentSong, isPlaying, isDesktopLyricsOpen, isMobileLyricsFullScreen]);

  return null;
};

export default DynamicTitleUpdater;
