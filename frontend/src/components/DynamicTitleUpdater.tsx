// frontend/src/components/DynamicTitleUpdater.tsx

import { useEffect } from "react";
import { usePlayerStore } from "../stores/usePlayerStore";
import { getArtistNames } from "../lib/utils";

const DynamicTitleUpdater = () => {
  const {
    currentSong,
    isPlaying,
    isDesktopLyricsOpen,
    isMobileLyricsFullScreen,
  } = usePlayerStore();

  useEffect(() => {
    const isLyricsOpen = isDesktopLyricsOpen || isMobileLyricsFullScreen;

    if (currentSong) {
      const artistName = getArtistNames(currentSong.artist);

      if (isLyricsOpen) {
        document.title = `Lyrics: ${currentSong.title} by ${artistName}`;
      } else if (isPlaying) {
        document.title = `${currentSong.title} • ${artistName}`;
      }
    }
  }, [currentSong, isPlaying, isDesktopLyricsOpen, isMobileLyricsFullScreen]);

  return null;
};

export default DynamicTitleUpdater;
