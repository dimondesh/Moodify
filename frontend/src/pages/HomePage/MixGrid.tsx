import type { Mix } from "@/types";
import { useNavigate } from "react-router-dom";
import SectionGridSkeleton from "./SectionGridSkeleton";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { getArtistNames } from "@/lib/utils";

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

  const getFirstTwoArtists = (mix: Mix): string => {
    if (!mix.songs || mix.songs.length === 0) {
      return t("sidebar.subtitle.dailyMix");
    }

    const allArtists = mix.songs.flatMap((song) => song.artist);
    const uniqueArtists = allArtists.filter(
      (artist, index, self) =>
        index === self.findIndex((a) => a._id === artist._id)
    );
    const firstTwoUniqueArtists = uniqueArtists.slice(0, 2);
    const artistNames = getArtistNames(firstTwoUniqueArtists);

    if (uniqueArtists.length > 2) {
      return `${artistNames} ${t("common.andMore")}`;
    }
    return artistNames;
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {mixesToShow.map((mix) => (
          <div
            key={mix._id}
            onClick={() => handleNavigateToMix(mix)}
            className="bg-transparent p-0 rounded-md transition-all group cursor-pointer"
          >
            <div className="relative mb-2">
              <div className="relative aspect-square shadow-lg overflow-hidden rounded-md">
                <img
                  src={mix.imageUrl || "https://moodify.b-cdn.net/artist.jpeg"}
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
            <div className="px-1">
              <p
                className="text-xs text-zinc-400 leading-tight"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  wordWrap: "break-word",
                  wordBreak: "break-word",
                }}
              >
                {getFirstTwoArtists(mix)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MixGrid;
