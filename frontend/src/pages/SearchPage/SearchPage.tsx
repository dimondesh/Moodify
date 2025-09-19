// src/pages/SearchPage/SearchPage.tsx

import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useSearchStore } from "../../stores/useSearchStore";
import AlbumGrid from "./AlbumGrid";
import { ScrollArea } from "../../components/ui/scroll-area";
import SongGrid from "./SongGrid";
import PlaylistGrid from "./PlaylistGrid";
import ArtistGrid from "./ArtistGrid";
import useDebounce from "../../hooks/useDebounce";
import UserGrid from "./UserGrid";
import MixGrid from "./MixGrid";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import BrowseMixes from "./BrowseMixes";
import { Loader2 } from "lucide-react";

const SearchPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get("q") || "";

  const debouncedInputSearchTerm = useDebounce(queryParam, 500);

  const {
    query,
    songs,
    albums,
    playlists,
    artists,
    users,
    mixes,
    loading,
    error,
    search,
  } = useSearchStore();

  useEffect(() => {
    if (debouncedInputSearchTerm.trim() !== query) {
      search(debouncedInputSearchTerm.trim());
    }
  }, [debouncedInputSearchTerm, search, query]);

  const title = queryParam ? `Results for "${queryParam}"` : "Search Music";
  const description = queryParam
    ? `Find artists, songs, albums, mixes, and playlists for "${queryParam}" on Moodify Studio.`
    : "Search for your favorite songs, artists, albums, mixes, playlists, and users on Moodify Studio.";

  return (
    <>
      <Helmet>
        <title>{`${title}`}</title>
        <meta name="description" content={description} />
      </Helmet>
      <main className="rounded-md overflow-hidden h-full bg-gradient-to-b from-zinc-900 to-zinc-950">
        <ScrollArea className="h-[90vh] w-full pb-20 md:pb-20 lg:pb-10">
          <div className="py-10 px-4 sm:px-6">
            {queryParam ? (
              <h1 className="text-2xl sm:text-3xl font-bold mb-8 text-center text-white">
                {t("searchpage.resultsFor")} "{queryParam}"
              </h1>
            ) : (
              <>
                <h1 className="text-2xl sm:text-3xl font-bold mb-8 text-left text-white">
                  {t("searchpage.findYourFavorites")}
                </h1>
                <BrowseMixes />
              </>
            )}

            {loading && (
              <div className="flex justify-center">
                <Loader2 className="text-violet-600 size-10 animate-spin align-middle" />
              </div>
            )}
            {error && <p className="text-red-500">{error}</p>}

            {!loading &&
              !error &&
              queryParam &&
              songs.length === 0 &&
              albums.length === 0 &&
              playlists.length === 0 &&
              artists.length === 0 &&
              users.length === 0 &&
              mixes.length === 0 && (
                <p className="text-zinc-400 text-center">
                  {t("searchpage.noResults")}
                </p>
              )}

            {!loading && !error && queryParam && (
              <>
                {artists.length > 0 && (
                  <ArtistGrid
                    title={t("searchpage.artists")}
                    artists={artists}
                    isLoading={loading}
                  />
                )}
                {songs.length > 0 && (
                  <SongGrid
                    title={t("searchpage.songs")}
                    songs={songs}
                    isLoading={loading}
                  />
                )}
                {albums.length > 0 && (
                  <AlbumGrid
                    title={t("searchpage.albums")}
                    albums={albums}
                    isLoading={loading}
                  />
                )}
                {playlists.length > 0 && (
                  <PlaylistGrid
                    title={t("searchpage.playlists")}
                    playlists={playlists}
                    isLoading={loading}
                  />
                )}
                {mixes.length > 0 && (
                  <MixGrid title="Mixes" mixes={mixes} isLoading={loading} />
                )}
                {users.length > 0 && (
                  <UserGrid
                    title={t("searchpage.users")}
                    users={users}
                    isLoading={loading}
                  />
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </main>
    </>
  );
};

export default SearchPage;
