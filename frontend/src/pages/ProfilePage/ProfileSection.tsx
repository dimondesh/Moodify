// frontend/src/pages/ProfilePage/ProfileSection.tsx

import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslation } from "react-i18next";
import UniversalPlayButton from "@/components/ui/UniversalPlayButton";
import type { Song, Artist } from "@/types";

interface Item {
  _id: string;
  name: string;
  imageUrl: string;
  type: "user" | "artist" | "playlist";
  subtitle?: string;
  songs?: Song[];
}

interface ProfileSectionProps {
  title: string;
  items: Item[];
  apiEndpoint: string;
}

const ProfileSection = ({ title, items, apiEndpoint }: ProfileSectionProps) => {
  const { t } = useTranslation();
  if (!items || items.length === 0) {
    return null;
  }

  const getLink = (item: Item) => {
    switch (item.type) {
      case "user":
        return `/users/${item._id}`;
      case "artist":
        return `/artists/${item._id}`;
      case "playlist":
        return `/playlists/${item._id}`;
      default:
        return "/";
    }
  };
  const displayedItems = items.slice(0, 6);

  return (
    <div className="mb-12">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
        {items.length > 6 && (
          <Link
            to="/list"
            state={{ title, apiEndpoint }}
            className="text-sm font-bold text-zinc-400 hover:underline"
          >
            {t("pages.profile.showAll")}
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {displayedItems.map((item) => {
          return (
            <Link
              to={getLink(item)}
              key={item._id}
              className="bg-transparent p-0 rounded-md transition-all group cursor-pointer"
            >
              <div className="relative mb-2">
                {item.type === "playlist" ? (
                  <div className="relative aspect-square shadow-lg overflow-hidden rounded-md">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="absolute inset-0 h-full w-full object-cover rounded-md transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="relative aspect-square shadow-lg overflow-hidden rounded-full">
                    <Avatar className="h-full w-full">
                      <AvatarImage
                        src={item.imageUrl}
                        className="object-cover rounded-full transition-transform duration-300 group-hover:scale-105"
                      />
                      <AvatarFallback>{item.name?.[0] || "?"}</AvatarFallback>
                    </Avatar>
                  </div>
                )}
                {/* Добавляем кнопку воспроизведения только для артистов */}
                {item.type === "artist" && (
                  <UniversalPlayButton
                    entity={item as unknown as Artist}
                    entityType="artist"
                    className="absolute bottom-3 right-2"
                    size="sm"
                  />
                )}
              </div>
              <div className="px-1">
                <p className="font-semibold text-sm truncate text-center">
                  {item.name}
                </p>
                <p className="text-xs text-zinc-400 leading-tight truncate text-center">
                  {item.subtitle || t(`sidebar.subtitle.${item.type}`)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default ProfileSection;
