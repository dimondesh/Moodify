// src/pages/SearchPage/MixGrid.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import type { Mix } from "../../types";
import SectionGridSkeleton from "../../components/ui/skeletons/PlaylistSkeleton";
import { useTranslation } from "react-i18next";
import { useSearchStore } from "@/stores/useSearchStore";

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

  const mixesToShow = showAll ? mixes : mixes.slice(0, 4);

  return (
    <div className="mb-8 w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white">{title}</h2>
        {mixes.length > 4 && (
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
        {mixesToShow.map((mix) => (
          <div
            key={mix._id}
            className="bg-zinc-800/40 p-4 rounded-md hover:bg-zinc-700/40 transition-all cursor-pointer group"
            onClick={() => handleMixClick(mix)}
          >
            <div className="relative mb-4">
              <div className=" aspect-square rounded-md shadow-lg overflow-hidden">
                <img
                  src={mix.imageUrl || "https://moodify.b-cdn.net/artist.jpeg"}
                  alt={mix.name}
                  className=" w-auto h-auto object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://moodify.b-cdn.net/artist.jpeg";
                  }}
                />
              </div>
            </div>
            <h3 className="font-medium mb-2 truncate text-white">
              {t(mix.name)}
            </h3>
            <p className="text-sm text-zinc-400 truncate">
              {t("sidebar.subtitle.dailyMix")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MixGrid;
