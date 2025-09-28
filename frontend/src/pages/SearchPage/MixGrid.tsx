// src/pages/SearchPage/MixGrid.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import type { Mix } from "../../types";
import SectionGridSkeleton from "../../components/ui/skeletons/PlaylistSkeleton";
import { useTranslation } from "react-i18next";
import { useSearchStore } from "@/stores/useSearchStore";
import { getArtistNames } from "@/lib/utils";
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

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {mixesToShow.map((mix) => (
          <div
            key={mix._id}
            className="bg-[#1a1a1a] rounded-md hover:bg-[#2a2a2a] transition-all cursor-pointer group hover-scale overflow-hidden"
            onClick={() => handleMixClick(mix)}
          >
            <div className="relative aspect-square rounded-md shadow-lg overflow-hidden">
              <img
                src={mix.imageUrl || "https://moodify.b-cdn.net/artist.jpeg"}
                alt={mix.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://moodify.b-cdn.net/artist.jpeg";
                }}
              />
              {/* Затемнение снизу с названием в левой нижней части */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-8 z-10">
                <h3 className="text-white text-lg font-bold drop-shadow-lg break-words">
                  {t(mix.name)}
                </h3>
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
