// frontend/src/pages/ProfilePage/ProfileSection.tsx

import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslation } from "react-i18next";

interface Item {
  _id: string;
  name: string;
  imageUrl: string;
  type: "user" | "artist" | "playlist";
  subtitle?: string;
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
        {displayedItems.map((item) => (
          <Link
            to={getLink(item)}
            key={item._id}
            className="flex flex-col text-center group bg-zinc-800/40 rounded-md p-2 hover:bg-zinc-700/40 transition-colors"
          >
            {item.type === "playlist" ? (
              <div className="aspect-square w-full mb-2 group hover:bg-zinc-800">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-auto h-auto object-cover rounded-md transition-transform group-hover:scale-105"
                />
              </div>
            ) : (
              <Avatar className="w-auto h-auto object-cover aspect-square mb-2 transition-transform group-hover:scale-105">
                <AvatarImage
                  src={item.imageUrl}
                  className="w-auto h-auto object-cover group-hover:scale-105 transition-all duration-300"
                />
                <AvatarFallback>{item.name?.[0] || "?"}</AvatarFallback>
              </Avatar>
            )}
            <div className="px-2">
              <p className="text-sm font-semibold truncate">{item.name}</p>
              <p className="text-xs text-zinc-400 capitalize truncate">
                {item.subtitle || t(`sidebar.subtitle.${item.type}`)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ProfileSection;
