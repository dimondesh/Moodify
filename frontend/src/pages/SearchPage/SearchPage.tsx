// src/pages/SearchPage/SearchPage.tsx

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
import StandardLoader from "../../components/ui/StandardLoader";
import { Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import { useAuthStore } from "../../stores/useAuthStore";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import RecentSearchesList from "./RecentSearchesList";

const SearchPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get("q") || "";
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { user: authUser } = useAuthStore();
  const navigate = useNavigate();
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const [query, setQuery] = useState(queryParam);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const debouncedInputSearchTerm = useDebounce(queryParam, 500);

  const {
    query: searchQuery,
    songs,
    albums,
    playlists,
    artists,
    users,
    mixes,
    loading,
    error,
    search,
    fetchRecentSearches,
  } = useSearchStore();

  useEffect(() => {
    if (debouncedInputSearchTerm.trim() !== searchQuery) {
      search(debouncedInputSearchTerm.trim());
    }
  }, [debouncedInputSearchTerm, search, searchQuery]);

  useEffect(() => {
    setQuery(queryParam);
  }, [queryParam]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (val.trim() !== "") {
      setIsPopoverOpen(false);
    } else if (authUser) {
      setIsPopoverOpen(true);
      fetchRecentSearches();
    }

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      if (val.trim() !== "") {
        navigate(`/search?q=${encodeURIComponent(val)}`);
      } else {
        navigate(`/search`);
      }
    }, 300);
  };

  const handleTriggerClick = () => {
    if (authUser && !query) {
      fetchRecentSearches();
      setIsPopoverOpen(true);
    }
  };

  const handleItemClickInPopover = () => {
    setIsPopoverOpen(false);
    setQuery("");
  };

  const title = queryParam
    ? `${t("common.resultsFor")} "${queryParam}"`
    : t("common.searchMusic");
  const description = queryParam
    ? `Find artists, songs, albums, mixes, and playlists for "${queryParam}" on Moodify.`
    : "Search for your favorite songs, artists, albums, mixes, playlists, and users on Moodify.";

  return (
    <>
      <Helmet>
        <title>{`${title}`}</title>
        <meta name="description" content={description} />
      </Helmet>
      <main className="overflow-hidden h-full bg-[#0f0f0f]">
        <ScrollArea className="h-[90vh] w-full pb-20 md:pb-20 lg:pb-10">
          <div className="py-6 px-4 sm:px-6">
            {isMobile && (
              <div className="mb-6">
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <div onClick={handleTriggerClick}>
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                      <input
                        type="text"
                        placeholder={t("topbar.searchPlaceholder")}
                        value={query}
                        onChange={handleChange}
                        className="w-full bg-[#2a2a2a] rounded-full py-2 pl-10 pr-4 text-base text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] transition duration-150 ease-in-out cursor-pointer"
                        spellCheck={false}
                        autoComplete="off"
                      />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] mt-2 p-0 bg-[#1a1a1a] border-[#2a2a2a]"
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <RecentSearchesList
                      onItemClick={handleItemClickInPopover}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
            {queryParam ? (
              <h1 className="hidden md:block text-2xl sm:text-3xl font-bold mb-6 text-center text-white">
                {t("searchpage.resultsFor")} "{queryParam}"
              </h1>
            ) : (
              <>
                <h1 className="hidden md:block text-2xl sm:text-3xl font-bold mb-6 text-left text-white">
                  {t("searchpage.findYourFavorites")}
                </h1>
                <BrowseMixes />
              </>
            )}

            {loading && (
              <div className="flex justify-center">
                <StandardLoader size="lg" />
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
                <p className="text-gray-400 text-center">
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
                  <MixGrid
                    title={t("common.mixes")}
                    mixes={mixes}
                    isLoading={loading}
                  />
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
