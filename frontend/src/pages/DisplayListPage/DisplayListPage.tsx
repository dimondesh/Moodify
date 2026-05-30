// frontend/src/pages/DisplayListPage/DisplayListPage.tsx

import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { axiosInstance } from "@/lib/axios";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SectionGridSkeleton from "@/components/ui/skeletons/PlaylistSkeleton";
import { useTranslation } from "react-i18next";
import { getArtistNames, getPlaylistDisplayTitle } from "@/lib/utils";
import type { Playlist, PlaylistKind } from "@/types";
import { playlistOwnerLabel } from "@/lib/site-meta";
import { CoverImage } from "@/components/CoverImage";
import { getImageUrlByKey } from "@/lib/imageUrl";
import {
  CDN_DEFAULT_ALBUM_COVER,
  CDN_DEFAULT_ARTIST_IMAGE,
  CDN_DEFAULT_USER_IMAGE,
} from "@/lib/cdn";
import { Artist, User } from "@/types";
import UniversalPlayButton from "@/components/ui/UniversalPlayButton";

interface ListItem {
  _id: string;
  name?: string;
  title?: string;
  images?: { size: number; url: string }[];
  type: "user" | "artist" | "playlist" | "album";
  itemType?: "user" | "artist" | "playlist" | "album";
  /** Mix/smart kind when `type` is the entity kind `playlist`. */
  playlistKind?: PlaylistKind;
  localizedNames?: Playlist["localizedNames"];
  artist?: Artist[];
  owner?: User;
  albumType?: string;
}

function formatListItem(item: Record<string, unknown> & { _id: string }): ListItem {
  const itemType = item.itemType as string | undefined;
  const rawType = item.type as string | undefined;
  const entityType = (itemType || rawType) as ListItem["type"];
  const playlistKind =
    entityType === "playlist" && rawType && rawType !== entityType
      ? (rawType as PlaylistKind)
      : undefined;
  return {
    ...(item as unknown as ListItem),
    type: entityType,
    playlistKind,
  };
}

const DisplayListPage = () => {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  const {
    title,
    apiEndpoint,
    items: initialItems,
  } = location.state || {
    title: t("pages.displayList.title"),
    apiEndpoint: null,
    items: null,
  };

  useEffect(() => {
    if (initialItems && Array.isArray(initialItems)) {
      const formattedItems = initialItems.map(formatListItem);
      setItems(formattedItems);
      setIsLoading(false);
    } else if (apiEndpoint) {
      const fetchItems = async () => {
        try {
          const response = await axiosInstance.get(apiEndpoint);
          const data = response.data.items || response.data;
          if (Array.isArray(data)) {
            const formattedData = data.map(formatListItem);
            setItems(formattedData);
          }
        } catch (err) {
          console.error(`Failed to fetch ${title}:`, err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchItems();
    } else {
      setIsLoading(false);
      setItems([]);
    }
  }, [apiEndpoint, title, initialItems]);

  const getLink = (item: ListItem) => {
    switch (item.type) {
      case "user":
        return `/users/${item._id}`;
      case "artist":
        return `/artists/${item._id}`;
      case "playlist":
        return `/playlists/${item._id}`;
      case "album":
        return `/albums/${item._id}`;
      default:
        return "/";
    }
  };

  const getSubtitle = (item: ListItem) => {
    const itemTypeCapitalized =
      (item.albumType as string) ||
      item.type.charAt(0).toUpperCase() + item.type.slice(1);
    const typeName = t(
      `sidebar.subtitle.${itemTypeCapitalized}`,
      item.type.charAt(0).toUpperCase() + item.type.slice(1),
    );

    if (item.type === "album" && item.artist) {
      return `${typeName} • ${getArtistNames(item.artist)}`;
    }
    if (item.type === "playlist") {
      return t("sidebar.subtitle.byUser", {
        name: playlistOwnerLabel(item.owner, t("common.unknownArtist")),
      });
    }
    return typeName;
  };

  const resolveItemTitle = (item: ListItem) => {
    if (item.type === "playlist") {
      return getPlaylistDisplayTitle(
        {
          title: item.title ?? item.name ?? "",
          type: item.playlistKind,
          localizedNames: item.localizedNames,
        },
        i18n.language,
        t,
      );
    }
    return item.name || item.title || "";
  };

  if (isLoading) return <SectionGridSkeleton />;

  return (
    <div className="pb-40 lg:pb:0">
      <div className="p-4 sm:p-6">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6">{title}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items?.map((item) => {
            const displayTitle = resolveItemTitle(item);
            return (
            <Link
              to={getLink(item)}
              key={item._id}
              className="bg-transparent p-0 rounded-md transition-all group cursor-pointer"
            >
              <div className="relative mb-2">
                {item.type === "playlist" || item.type === "album" ? (
                  <div className="relative aspect-square shadow-lg overflow-hidden rounded-md">
                    <CoverImage
                      entity={item}
                      size="card"
                      defaultUrl={CDN_DEFAULT_ALBUM_COVER}
                      alt={displayTitle || t("common.itemCover")}
                      className="absolute inset-0 h-full w-full object-cover rounded-md transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="relative aspect-square shadow-lg overflow-hidden rounded-full">
                    <Avatar className="h-full w-full">
                      <AvatarImage
                        src={getImageUrlByKey(
                          item,
                          "card",
                          item.type === "user"
                            ? CDN_DEFAULT_USER_IMAGE
                            : CDN_DEFAULT_ARTIST_IMAGE,
                        )}
                        className="object-cover rounded-full transition-transform duration-300 group-hover:scale-105"
                      />
                      <AvatarFallback>
                        {(item.name || item.title)?.[0]}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
                <UniversalPlayButton
                  entity={item as any}
                  entityType={item.type as any}
                  className="absolute bottom-3 right-2"
                  size="sm"
                />
              </div>
              <div className="px-1">
                <h3 className="font-semibold text-sm truncate">
                  {displayTitle}
                </h3>
                <p className="text-xs text-zinc-400 leading-tight truncate">
                  {getSubtitle(item)}
                </p>
              </div>
            </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DisplayListPage;
