import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import UniversalPlayButton from "@/components/ui/UniversalPlayButton";
import { getOptimizedImageUrl } from "@/lib/utils";
import { useMusicStore } from "@/stores/useMusicStore";
import type { Song, Album, Playlist, Artist } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { DisplayItem } from "@/types";
import {
  getDisplayTitle,
  getSubtitle,
  isPlaylistCoverOverlayItem,
} from "@/lib/entitySection";

export interface EntitySectionCardProps {
  item: DisplayItem;
  songsOnly: (Song & { itemType: "song" })[];
}

const EntitySectionCardComponent: React.FC<EntitySectionCardProps> = ({
  item,
  songsOnly,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { artists: allArtists } = useMusicStore();

  const handleItemClick = useCallback(() => {
    switch (item.itemType) {
      case "song":
        navigate(`/albums/${(item as Song).albumId}`);
        break;
      case "album":
        navigate(`/albums/${item._id}`);
        break;
      case "playlist":
        navigate(`/playlists/${item._id}`);
        break;
      case "artist":
        navigate(`/artists/${item._id}`);
        break;
      case "user":
        navigate(`/users/${item._id}`);
        break;
    }
  }, [item, navigate]);

  const title = getDisplayTitle(item);
  const subtitle = getSubtitle(item, t, allArtists);
  const showPlay =
    item.itemType === "song" ||
    item.itemType === "album" ||
    item.itemType === "playlist" ||
    item.itemType === "artist";

  return (
    <div
      className="bg-transparent p-2 rounded-md transition-all hover:bg-zinc-800/50 group cursor-pointer w-36 sm:w-44 flex-shrink-0"
      onClick={handleItemClick}
    >
      <div className="relative mb-2">
        <div className="relative aspect-square shadow-lg overflow-hidden rounded-md">
          {item.itemType === "artist" || item.itemType === "user" ? (
            <Avatar className="absolute inset-0 h-full w-full object-cover rounded-full">
              <AvatarImage
                src={getOptimizedImageUrl(item.imageUrl, 200)}
                alt={title}
                className="object-cover h-auto w-auto rounded-full"
              />
              <AvatarFallback>{title?.[0] || "?"}</AvatarFallback>
            </Avatar>
          ) : (
            <img
              src={getOptimizedImageUrl(
                item.imageUrl ||
                  "https://moodify.b-cdn.net/default-album-cover.png",
                200,
              )}
              alt={title}
              className="absolute inset-0 h-full w-full object-cover rounded-md"
            />
          )}
          {isPlaylistCoverOverlayItem(item) && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 pt-6 z-10">
              <h3 className="text-white text-sm font-bold drop-shadow-lg break-words">
                {title}
              </h3>
            </div>
          )}
        </div>
        {showPlay && (
          <UniversalPlayButton
            entity={item as Song | Album | Playlist | Artist}
            entityType={item.itemType}
            songs={item.itemType === "song" ? songsOnly : undefined}
            className={`absolute bottom-3 right-2 ${
              isPlaylistCoverOverlayItem(item) ? "z-50" : ""
            }`}
            size="sm"
          />
        )}
      </div>
      <div className="px-1">
        {!isPlaylistCoverOverlayItem(item) && (
          <h3 className="font-semibold text-sm truncate">{title}</h3>
        )}
        <p
          className="text-xs text-zinc-400 leading-tight"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            wordWrap: "break-word",
            wordBreak: "break-word",
          }}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
};

const EntitySectionCard = React.memo(EntitySectionCardComponent);
export default EntitySectionCard;
