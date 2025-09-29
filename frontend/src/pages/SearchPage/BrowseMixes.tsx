// frontend/src/pages/SearchPage/BrowseMixes.tsx

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMixesStore } from "../../stores/useMixesStore";
import { Loader2 } from "lucide-react";
import type { Mix } from "../../types";
import { useTranslation } from "react-i18next";
import UniversalPlayButton from "../../components/ui/UniversalPlayButton";

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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {mixes.map((mix) => (
          <div
            key={mix._id}
            onClick={() => handleNavigateToMix(mix._id)}
            className="bg-transparent p-0 rounded-md transition-all group cursor-pointer"
          >
            <div className="relative mb-2">
              <div className="relative aspect-square shadow-lg overflow-hidden rounded-md">
                <img
                  src={mix.imageUrl}
                  alt={t(mix.name)}
                  className="absolute inset-0 h-full w-full object-cover rounded-md transition-transform duration-300 group-hover:scale-105"
                />
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
