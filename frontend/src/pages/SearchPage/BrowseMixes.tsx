// frontend/src/pages/SearchPage/BrowseMixes.tsx

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMixesStore } from "../../stores/useMixesStore";
import { Loader2 } from "lucide-react";
import type { Mix } from "../../types";
import { useTranslation } from "react-i18next";

const MixCategoryGrid = ({ title, mixes }: { title: string; mixes: Mix[] }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!mixes || mixes.length === 0) {
    return null;
  }

  const handleNavigateToMix = (mixId: string) => {
    navigate(`/mixes/${mixId}`);
  };

  return (
    <div className="mb-10">
      <h2 className="text-2xl font-bold mb-4 text-white">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {mixes.map((mix) => (
          <div
            key={mix._id}
            onClick={() => handleNavigateToMix(mix._id)}
            className="group relative cursor-pointer overflow-hidden rounded-md bg-[#1a1a1a] hover:bg-[#2a2a2a] transition-all hover-scale"
          >
            <img
              src={mix.imageUrl}
              alt={t(mix.name)}
              className="w-full h-full object-cover aspect-square transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-end justify-start p-3 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
              <h3 className="text-white text-sm font-bold drop-shadow-lg break-words whitespace-normal leading-tight">
                {t(mix.name)}
              </h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const BrowseMixes = () => {
  const { t } = useTranslation();
  const { genreMixes, moodMixes, isLoading, error, fetchDailyMixes } =
    useMixesStore();

  useEffect(() => {
    if (genreMixes.length === 0 && moodMixes.length === 0) {
      fetchDailyMixes();
    }
  }, [fetchDailyMixes, genreMixes, moodMixes]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="animate-spin text-violet-500 size-12" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 p-8">
        Error loading mixes: {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <MixCategoryGrid title={t("homepage.genreMixes")} mixes={genreMixes} />
      <MixCategoryGrid title={t("homepage.moodMixes")} mixes={moodMixes} />
    </div>
  );
};

export default BrowseMixes;
