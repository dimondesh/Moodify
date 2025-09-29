// frontend/src/pages/AllMixesPage/AllMixesPage.tsx

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ScrollArea, ScrollBar } from "../../components/ui/scroll-area";
import SectionGridSkeleton from "../../components/ui/skeletons/PlaylistSkeleton";
import type { Mix } from "../../types/index";
import { useTranslation } from "react-i18next";
import UniversalPlayButton from "../../components/ui/UniversalPlayButton";

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
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
};

export default AllMixesPage;
