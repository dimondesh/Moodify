// frontend/src/pages/AllMixesPage/AllMixesPage.tsx

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ScrollArea, ScrollBar } from "../../components/ui/scroll-area";
import SectionGridSkeleton from "../../components/ui/skeletons/PlaylistSkeleton";
import type { Mix } from "../../types/index";
import { useTranslation } from "react-i18next";

const AllMixesPage = () => {
  const { t } = useTranslation();
  const [mixes, setMixes] = useState<Mix[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const initialMixes = location.state?.mixes;
  const pageTitle = location.state?.title || t("pages.allMixes.title");

  useEffect(() => {
    if (initialMixes && Array.isArray(initialMixes)) {
      setMixes(initialMixes);
    } else {
      setError(t("pages.allMixes.noData"));
    }
    setIsLoading(false);
  }, [initialMixes, t]);

  const handleNavigateToMix = (mixId: string) => {
    navigate(`/mixes/${mixId}`);
  };

  if (isLoading) return <SectionGridSkeleton />;
  if (error)
    return (
      <div className="p-4 text-red-500">
        {t("common.error")}: {error}
      </div>
    );

  if (!mixes || mixes.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4">{pageTitle}</h2>
        <p className="text-zinc-400">{t("pages.allMixes.noMixes")}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-120px)] w-full rounded-md pr-4 bg-zinc-950">
      <div className="p-4 pt-0">
        <h2 className="text-2xl font-bold mb-6">{pageTitle}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {mixes.map((mix) => (
            <div
              key={mix._id}
              onClick={() => handleNavigateToMix(mix._id)}
              className="group relative cursor-pointer overflow-hidden rounded-md bg-zinc-800/60 hover:bg-zinc-700/80 transition-all"
            >
              <img
                src={mix.imageUrl}
                alt={t(mix.name)}
                className="w-full h-full object-cover aspect-square transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-end justify-start p-4 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                <h3 className="text-white text-lg font-bold drop-shadow-lg break-words whitespace-normal leading-tight">
                  {t(mix.name)}
                </h3>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
};

export default AllMixesPage;
