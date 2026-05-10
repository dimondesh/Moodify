import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import SectionGridSkeleton from "../../components/ui/skeletons/PlaylistSkeleton";
import type { Playlist } from "../../types";
import { useTranslation } from "react-i18next";
import UniversalPlayButton from "../../components/ui/UniversalPlayButton";
import { useMusicStore } from "../../stores/useMusicStore";

type BrowseLocationState = { playlists?: Playlist[]; title?: string };

const PlaylistBrowsePage = () => {
  const { t } = useTranslation();
  const { category } = useParams<{ category: string }>();
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const genreMixes = useMusicStore((s) => s.genreMixes);
  const moodMixes = useMusicStore((s) => s.moodMixes);
  const fetchSecondaryHomePlaylists = useMusicStore(
    (s) => s.fetchSecondaryHomePlaylists,
  );

  const { playlists: initialFromState, title: stateTitle } =
    (location.state as BrowseLocationState) || {};

  useEffect(() => {
    const run = async () => {
      if (initialFromState?.length) {
        setPlaylists(initialFromState);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      if (genreMixes.length === 0 && moodMixes.length === 0) {
        await fetchSecondaryHomePlaylists();
      }
      const { genreMixes: g, moodMixes: m } = useMusicStore.getState();
      if (category === "genres") setPlaylists(g);
      else if (category === "moods") setPlaylists(m);
      else setPlaylists([]);
      setIsLoading(false);
    };
    void run();
  }, [
    category,
    initialFromState,
    genreMixes.length,
    moodMixes.length,
    fetchSecondaryHomePlaylists,
  ]);

  const pageTitle = useMemo(() => {
    if (stateTitle) return stateTitle;
    if (category === "genres") return t("homepage.genreMixes");
    if (category === "moods") return t("homepage.moodMixes");
    return t("pages.allMixes.title");
  }, [stateTitle, category, t]);

  const handleOpen = (id: string) => {
    navigate(`/playlists/${id}`);
  };

  if (isLoading) return <SectionGridSkeleton />;

  if (!playlists || playlists.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4">{pageTitle}</h2>
        <p className="text-zinc-400">{t("pages.allMixes.noMixes")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="p-4 pt-4 pb-40 lg:pb-0">
        <h2 className="text-2xl font-bold mb-6">{pageTitle}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {playlists.map((pl) => (
            <div
              key={pl._id}
              onClick={() => handleOpen(pl._id)}
              className="bg-transparent p-0 rounded-md transition-all group cursor-pointer"
            >
              <div className="relative mb-2">
                <div className="relative aspect-square shadow-lg overflow-hidden rounded-md">
                  <img
                    src={pl.imageUrl}
                    alt={pl.title}
                    className="absolute inset-0 h-full w-full object-cover rounded-md transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 pt-6 z-10">
                    <h3 className="text-white text-sm font-bold drop-shadow-lg break-words">
                      {pl.title}
                    </h3>
                  </div>
                </div>
                <UniversalPlayButton
                  entity={pl}
                  entityType="playlist"
                  className="absolute bottom-3 right-2 z-50"
                  size="sm"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlaylistBrowsePage;
