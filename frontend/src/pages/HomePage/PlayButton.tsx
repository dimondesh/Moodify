// src/pages/HomePage/PlayButton.tsx

import { Pause, Play } from "lucide-react";
import { Button } from "../../components/ui/button";
import { usePlayerStore } from "../../stores/usePlayerStore";
import type { Song } from "../../types";

type PlayButtonProps = {
  song: Song;
  songs: Song[];
  songIndex: number;
  onClick?: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  playbackContext?: {
    type: string;
    entityId?: string;
    entityTitle?: string;
  };
};

const PlayButton = ({
  song,
  songs,
  songIndex,
  onClick,
  playbackContext,
}: PlayButtonProps) => {
  const { currentSong, isPlaying, playAlbum, togglePlay, queue } =
    usePlayerStore();

  const isCurrentlyPlayingFromThisList =
    isPlaying &&
    currentSong?._id === song._id &&
    queue.length === songs.length &&
    queue[0]?._id === songs[0]?._id;

  const handlePlay = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.stopPropagation();
    if (onClick) onClick(e);

    if (isCurrentlyPlayingFromThisList) {
      togglePlay();
    } else {
      playAlbum(songs, songIndex, playbackContext);
    }
  };

  return (
    <Button
      size={"icon"}
      onClick={handlePlay}
      className={`hidden sm:flex absolute bottom-3 right-2 bg-violet-500 hover:bg-violet-400 hover:scale-105 transition-all
        opacity-0 translate-y-2 group-hover:translate-y-0 ${
          isCurrentlyPlayingFromThisList
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100"
        }`}
    >
      {isCurrentlyPlayingFromThisList ? (
        <Pause className="size-5 text-black fill-current" />
      ) : (
        <Play className="size-5 text-black fill-current" />
      )}
    </Button>
  );
};

export default PlayButton;
