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

  const usersToShow = showAll ? users : users.slice(0, 5);

  return (
    <div className="mb-8 w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white">{title}</h2>
        {users.length > 5 && (
          <Button
            variant="link"
            className="text-sm text-zinc-400 hover:text-white"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? t("searchpage.showLess") : t("searchpage.showAll")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {usersToShow.map((user) => (
          <div
            key={user._id}
            className="bg-transparent p-0 rounded-md transition-all group cursor-pointer"
            onClick={() => handleUserClick(user)}
          >
            <div className="relative mb-2">
              <div className="relative aspect-square shadow-lg overflow-hidden rounded-full">
                <Avatar className="h-full w-full">
                  <AvatarImage
                    src={getOptimizedImageUrl(user.imageUrl, 200)}
                    className="object-cover rounded-full transition-transform duration-300 group-hover:scale-105"
                  />
                  <AvatarFallback>{user.fullName?.[0]}</AvatarFallback>
                </Avatar>
              </div>
            </div>
            <div className="px-1">
              <h3 className="font-semibold text-sm truncate text-center">
                {user.fullName}
              </h3>
              <p className="text-xs text-zinc-400 leading-tight text-center">
                {t("sidebar.subtitle.user")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserGrid;
