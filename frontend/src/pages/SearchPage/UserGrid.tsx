// frontend/src/pages/SearchPage/UserGrid.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import type { User } from "../../types";
import SectionGridSkeleton from "../../components/ui/skeletons/PlaylistSkeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useTranslation } from "react-i18next";
import { useSearchStore } from "@/stores/useSearchStore";
import { getOptimizedImageUrl } from "@/lib/utils";

type UserGridProps = {
  title: string;
  users: User[];
  isLoading: boolean;
};

const UserGrid: React.FC<UserGridProps> = ({ title, users, isLoading }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const { addRecentSearch } = useSearchStore();

  const handleUserClick = (user: User) => {
    addRecentSearch(user._id, "User");
    navigate(`/users/${user._id}`);
  };

  if (isLoading) return <SectionGridSkeleton />;

  const usersToShow = showAll ? users : users.slice(0, 4);

  return (
    <div className="mb-8 w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white">{title}</h2>
        {users.length > 4 && (
          <Button
            variant="link"
            className="text-sm text-zinc-400 hover:text-white"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? t("searchpage.showLess") : t("searchpage.showAll")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {usersToShow.map((user) => (
          <div
            key={user._id}
            className="bg-zinc-800/40 p-4 rounded-md hover:bg-zinc-700/40 transition-all group cursor-pointer"
            onClick={() => handleUserClick(user)}
          >
            <div className="relative mb-4 aspect-square">
              <Avatar className="h-full w-full shadow-lg">
                <AvatarImage
                  src={getOptimizedImageUrl(user.imageUrl, 300)}
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <AvatarFallback>{user.fullName?.[0]}</AvatarFallback>
              </Avatar>
            </div>
            <h3 className="font-medium mb-1 truncate text-white text-center">
              {user.fullName}
            </h3>
            <p className="text-sm text-zinc-400 text-center">
              {t("sidebar.subtitle.user")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserGrid;
