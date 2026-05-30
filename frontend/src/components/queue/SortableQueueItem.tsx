import React, { useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDuration, getArtistNames } from "@/lib/utils";
import type { Song } from "@/types";
import { getImageUrlByKey } from "@/lib/imageUrl";
import { CDN_DEFAULT_ALBUM_COVER } from "@/lib/cdn";

export type QueueItemDensity = "compact" | "comfortable";

const densityClass: Record<
  QueueItemDensity,
  {
    row: string;
    grip: string;
    cover: string;
    title: string;
    subtitle: string;
    meta: string;
    metaGap: string;
    removeBtn: string;
    removeIcon: string;
  }
> = {
  comfortable: {
    row: "px-3 py-2.5 rounded-none hover:bg-zinc-800/50",
    grip: "h-5 w-5",
    cover: "w-12 h-12",
    title: "text-base font-medium truncate min-w-0! max-w-45",
    subtitle: "text-sm text-gray-400 truncate",
    meta: "text-sm text-gray-400",
    metaGap: "gap-2",
    removeBtn: "h-8 w-8",
    removeIcon: "h-4 w-4",
  },
  compact: {
    row: "px-3 py-2 rounded-none hover:bg-zinc-800/50",
    grip: "h-4 w-4",
    cover: "w-8 h-8",
    title: "text-sm font-medium truncate max-w-40",
    subtitle: "text-xs text-gray-400 truncate",
    meta: "text-xs text-gray-400",
    metaGap: "gap-1",
    removeBtn: "h-6 w-6",
    removeIcon: "h-3 w-3",
  },
};

interface QueueItemContentProps {
  song: Song;
  isCurrent: boolean;
  density: QueueItemDensity;
  onRemove: (songId: string, e: React.MouseEvent) => void;
  onPlay: (song: Song, e: React.MouseEvent) => void;
  isDraggable?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  isDragging?: boolean;
}

function QueueItemContent({
  song,
  isCurrent,
  density,
  onRemove,
  onPlay,
  isDraggable = false,
  dragHandleProps,
  setNodeRef,
  style,
  isDragging = false,
}: QueueItemContentProps) {
  const styles = densityClass[density];
  const dragStartedRef = useRef(false);

  useEffect(() => {
    if (isDragging) {
      dragStartedRef.current = true;
    }
  }, [isDragging]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-vaul-no-drag
      className={cn(
        "flex items-center gap-2 group cursor-pointer touch-manipulation",
        styles.row,
        isCurrent && "bg-[#8b5cf6]/20",
      )}
      onClick={(e) => {
        if (dragStartedRef.current) {
          dragStartedRef.current = false;
          return;
        }
        onPlay(song, e);
      }}
    >
      <div
        className={cn(
          "flex-shrink-0",
          isDraggable
            ? "cursor-grab touch-none active:cursor-grabbing"
            : "pointer-events-none",
        )}
        data-vaul-no-drag
        {...(isDraggable ? dragHandleProps : undefined)}
      >
        <GripVertical
          className={cn(
            styles.grip,
            isDraggable
              ? "text-gray-400 group-hover:text-white"
              : "invisible",
          )}
        />
      </div>

      <div
        className={cn("flex-shrink-0 rounded overflow-hidden", styles.cover)}
      >
        <img
          src={getImageUrlByKey(song, "thumb", CDN_DEFAULT_ALBUM_COVER)}
          alt={song.title}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div
          className={cn(
            styles.title,
            isCurrent ? "text-[#8b5cf6]" : "text-white",
          )}
        >
          {song.title}
        </div>
        <div className={styles.subtitle}>
          {getArtistNames(Array.isArray(song.artist) ? song.artist : [], [])}
        </div>
      </div>

      <div className={cn("flex items-center flex-shrink-0", styles.metaGap)}>
        <div className={styles.meta}>{formatDuration(song.duration)}</div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            styles.removeBtn,
            "text-gray-400 hover:text-white lg:opacity-0 lg:group-hover:opacity-100",
          )}
          onClick={(e) => onRemove(song._id, e)}
        >
          <X className={styles.removeIcon} />
        </Button>
      </div>
    </div>
  );
}

interface SortableQueueItemProps {
  song: Song;
  density: QueueItemDensity;
  onRemove: (songId: string, e: React.MouseEvent) => void;
  onPlay: (song: Song, e: React.MouseEvent) => void;
}

export const SortableQueueItem: React.FC<SortableQueueItemProps> = ({
  song,
  density,
  onRemove,
  onPlay,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <QueueItemContent
      song={song}
      isCurrent={false}
      density={density}
      onRemove={onRemove}
      onPlay={onPlay}
      isDraggable
      isDragging={isDragging}
      setNodeRef={setNodeRef}
      style={style}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
};

interface QueueCurrentItemProps {
  song: Song;
  density: QueueItemDensity;
  onRemove: (songId: string, e: React.MouseEvent) => void;
  onPlay: (song: Song, e: React.MouseEvent) => void;
}

export const QueueCurrentItem: React.FC<QueueCurrentItemProps> = ({
  song,
  density,
  onRemove,
  onPlay,
}) => (
  <QueueItemContent
    song={song}
    isCurrent
    density={density}
    onRemove={onRemove}
    onPlay={onPlay}
  />
);
