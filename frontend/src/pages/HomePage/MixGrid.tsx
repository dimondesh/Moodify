import type { Mix } from "@/types";
import { useNavigate } from "react-router-dom";
import SectionGridSkeleton from "./SectionGridSkeleton";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface MixGridProps {
  title: string;
  mixes: Mix[];
  isLoading: boolean;
}

const MixGrid = ({ title, mixes, isLoading }: MixGridProps) => {
  const { t } = useTranslation();

  const navigate = useNavigate();
  const mixesToShow = mixes.slice(0, 4);

  if (isLoading) {
    return <SectionGridSkeleton />;
  }

  if (!mixes || mixes.length === 0) {
    return null;
  }

  const handleShowAll = () => {
    navigate(`/all-mixes/${encodeURIComponent(title)}`, {
      state: {
        mixes: mixes,
        title: title,
      },
    });
  };

  const handleNavigateToMix = (mix: Mix) => {
    navigate(`/mixes/${mix._id}`);
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
        {mixes.length > 4 && (
          <Button
            variant="link"
            className="text-sm text-zinc-400 hover:text-white"
            onClick={handleShowAll}
          >
            {t("searchpage.showAll")}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {mixesToShow.map((mix) => (
          <div
            key={mix._id}
            onClick={() => handleNavigateToMix(mix)}
            className="group relative cursor-pointer overflow-hidden rounded-md bg-[#1a1a1a] hover:bg-[#2a2a2a] transition-all hover-scale"
          >
            <img
              src={mix.imageUrl || "https://moodify.b-cdn.net/artist.jpeg"}
              alt={t(mix.name)}
              className="w-full h-full object-cover aspect-square transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-start justify-start p-3 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
              <h3 className="text-white text-lg font-bold drop-shadow-lg break-words">
                {t(mix.name)}
              </h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MixGrid;
