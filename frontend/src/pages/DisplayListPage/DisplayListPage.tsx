// frontend/src/pages/DisplayListPage/DisplayListPage.tsx

import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { axiosInstance } from "@/lib/axios";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SectionGridSkeleton from "@/components/ui/skeletons/PlaylistSkeleton";
import { useTranslation } from "react-i18next";
import { getOptimizedImageUrl, getArtistNames } from "@/lib/utils";
import { Artist } from "@/types";

interface ListItem {
  _id: string;
  name?: string;
  title?: string;
  imageUrl: string;
  type: "user" | "artist" | "playlist" | "album";
  itemType?: "user" | "artist" | "playlist" | "album";
  artist?: Artist[];
  owner?: { fullName: string };
  albumType?: string;
}

const DisplayListPage = () => {
  const { t } = useTranslation();
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
      const formattedItems = initialItems.map((item) => ({
        ...item,
        type: item.itemType || item.type,
      }));
      setItems(formattedItems);
      setIsLoading(false);
    } else if (apiEndpoint) {
      const fetchItems = async () => {
        try {
          const response = await axiosInstance.get(apiEndpoint);
          const data = response.data.items || response.data;
          if (Array.isArray(data)) {
            const formattedData = data.map((item) => ({
              ...item,
              type: item.itemType || item.type,
            }));
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
      item.type.charAt(0).toUpperCase() + item.type.slice(1)
    );

    if (item.type === "album" && item.artist) {
      return `${typeName} • ${getArtistNames(item.artist)}`;
    }
    if (item.type === "playlist" && item.owner) {
      return t("sidebar.subtitle.byUser", {
        name: item.owner?.fullName || t("common.unknownArtist"),
      });
    }
    return typeName;
  };

  if (isLoading) return <SectionGridSkeleton />;

  return (
    <ScrollArea className="h-full w-full rounded-md pr-4">
      <div className="p-4 sm:p-6">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6">{title}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {items?.map((item) => (
            <Link
              to={getLink(item)}
              key={item._id}
              className="p-3 rounded-md bg-[#1a1a1a] hover:bg-[#2a2a2a] transition-all group cursor-pointer hover-scale"
            >
              <div className="relative mb-3 aspect-square object-cover shadow-lg overflow-hidden rounded-md">
                {item.type === "playlist" || item.type === "album" ? (
                  <img
                    src={
                      getOptimizedImageUrl(item.imageUrl, 300) || "/liked.png"
                    }
                    alt={item.title || t("common.itemCover")}
                    className="absolute inset-0 h-full w-full object-cover rounded-md transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <Avatar className="absolute inset-0 h-full w-full rounded-full">
                    <AvatarImage
                      src={getOptimizedImageUrl(item.imageUrl, 300)}
                      className="object-cover h-auto w-auto transition-transform duration-300 group-hover:scale-105"
                    />
                    <AvatarFallback>
                      {(item.name || item.title)?.[0]}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
              <h3 className="font-semibold truncate text-white text-sm">
                {item.name || item.title}
              </h3>
              <p className="text-xs text-gray-400 truncate">
                {getSubtitle(item)}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
};

export default DisplayListPage;
