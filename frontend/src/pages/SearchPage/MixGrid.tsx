// src/pages/SearchPage/MixGrid.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import type { Mix } from "../../types";
import SectionGridSkeleton from "../../components/ui/skeletons/PlaylistSkeleton";
import { useTranslation } from "react-i18next";
import { useSearchStore } from "@/stores/useSearchStore";
import UniversalPlayButton from "../../components/ui/UniversalPlayButton";

type MixGridProps = {
  title: string;
  mixes: Mix[];
  isLoading: boolean;
};

const MixGrid = ({ title, mixes, isLoading }: MixGridProps) => {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const { t } = useTranslation();
  const { addRecentSearch } = useSearchStore();

  const handleMixClick = (mix: Mix) => {
    addRecentSearch(mix._id, "Mix");
    navigate(`/mixes/${mix._id}`);
  };

  if (isLoading) return <SectionGridSkeleton />;

  const mixesToShow = showAll ? mixes : mixes.slice(0, 5);

  return (
    <div className="mb-8 w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white">{title}</h2>
        {mixes.length > 5 && (
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
        {mixesToShow.map((mix) => (
          <div
            key={mix._id}
            className="bg-transparent p-0 rounded-md transition-all group cursor-pointer"
            onClick={() => handleMixClick(mix)}
          >
            <div className="relative mb-2">
              <div className="relative aspect-square shadow-lg overflow-hidden rounded-md">
                <img
                  src={mix.imageUrl || "https://moodify.b-cdn.net/artist.jpeg"}
                  alt={mix.name}
                  className="absolute inset-0 h-full w-full object-cover rounded-md transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://moodify.b-cdn.net/artist.jpeg";
                  }}
                />
                {/* Затемнение снизу с названием в левой нижней части */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 pt-6 z-10">
                  <h3 className="text-white text-sm font-bold drop-shadow-lg break-words">
                    {t(mix.name)}
                  </h3>
                </div>
              </div>
              <UniversalPlayButton
                entity={mix}
                entityType="mix"
                className="absolute bottom-3 right-2 z-50"
                size="sm"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MixGrid;
