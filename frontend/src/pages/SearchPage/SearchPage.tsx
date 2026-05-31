// src/pages/SearchPage/SearchPage.tsx

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import AlbumGrid from "./AlbumGrid";
import SongGrid from "./SongGrid";
import PlaylistGrid from "./PlaylistGrid";
import ArtistGrid from "./ArtistGrid";
import useDebounce from "../../hooks/useDebounce";
import UserGrid from "./UserGrid";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import HubBrowseGrid from "./HubBrowseGrid";
import StandardLoader from "../../components/ui/StandardLoader";
import { Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import { useAuthStore } from "../../stores/useAuthStore";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { DROPDOWN_SURFACE } from "@/components/song-options/menuStyles";
import { cn } from "@/lib/utils";
import RecentSearchesList from "./RecentSearchesList";
import { useSearchQuery } from "@/hooks/useSearch";

const SearchPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get("q") || "";
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { user: authUser } = useAuthStore();
  const navigate = useNavigate();
  const navigateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [inputValue, setInputValue] = useState(queryParam);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const debouncedQuery = useDebounce(queryParam, 500);
  const {
    data: searchResults,
    isPending: isSearchPending,
    error: searchError,
  } = useSearchQuery(debouncedQuery);

  const isSearchLoading = isSearchPending && !searchResults;
  const error = searchError?.message ?? null;
  const songs = searchResults?.songs ?? [];
  const albums = searchResults?.albums ?? [];
  const playlists = searchResults?.playlists ?? [];
  const artists = searchResults?.artists ?? [];
  const users = searchResults?.users ?? [];

  useEffect(() => {
    setInputValue(queryParam);
  }, [queryParam]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    if (val.trim() !== "") {
      setIsPopoverOpen(false);
    } else if (authUser) {
      setIsPopoverOpen(true);
    }

    if (navigateTimeoutRef.current) clearTimeout(navigateTimeoutRef.current);
    navigateTimeoutRef.current = setTimeout(() => {
      if (val.trim() !== "") {
        navigate(`/search?q=${encodeURIComponent(val)}`);
      } else {
        navigate("/search");
      }
    }, 300);
  };

  const handleTriggerClick = () => {
    if (authUser && !inputValue) {
      setIsPopoverOpen(true);
    }
  };

  const handleItemClickInPopover = () => {
    setIsPopoverOpen(false);
    setInputValue("");
  };

  const title = queryParam
    ? `${t("common.resultsFor")} "${queryParam}"`
    : t("common.searchMusic");
  const description = queryParam
    ? `Find artists, songs, albums, and playlists for "${queryParam}" on Moodify Music.`
    : "Search for your favorite songs, artists, albums, playlists, and users on Moodify Music.";

  const hasResults =
    artists.length > 0 ||
    songs.length > 0 ||
    albums.length > 0 ||
    playlists.length > 0 ||
    users.length > 0;

  return (
    <>
      <Helmet>
        <title>{`${title}`}</title>
        <meta name="description" content={description} />
      </Helmet>
      <main className="min-h-screen pb-40 lg:pb-0 bg-[#0f0f0f]">
        <div className="py-6 px-4 sm:px-6">
          {isMobile && (
            <div className="mb-6">
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                  <div onClick={handleTriggerClick} className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    <input
                      type="text"
                      placeholder={t("topbar.searchPlaceholder")}
                      value={inputValue}
                      onChange={handleChange}
                      className="w-full bg-zinc-800/50 rounded-full py-2 pl-10 pr-4 text-base text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] transition duration-150 ease-in-out"
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  className={cn(
                    "mt-2 w-[var(--radix-popover-trigger-width)] overflow-hidden p-0",
                    DROPDOWN_SURFACE,
                  )}
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <RecentSearchesList
                    onItemClick={handleItemClickInPopover}
                    enabled={isPopoverOpen && Boolean(authUser)}
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
              <HubBrowseGrid />
            </>
          )}

          {queryParam && isSearchLoading && (
            <div className="flex justify-center py-12">
              <StandardLoader size="lg" />
            </div>
          )}
          {error && <p className="text-red-500">{error}</p>}

          {queryParam && !isSearchLoading && !error && !hasResults && (
            <p className="text-gray-400 text-center">
              {t("searchpage.noResults")}
            </p>
          )}

          {queryParam && !isSearchLoading && !error && (
            <>
              {artists.length > 0 && (
                <ArtistGrid
                  title={t("searchpage.artists")}
                  artists={artists}
                  isLoading={false}
                />
              )}
              {songs.length > 0 && (
                <SongGrid
                  title={t("searchpage.songs")}
                  songs={songs}
                  isLoading={false}
                />
              )}
              {albums.length > 0 && (
                <AlbumGrid
                  title={t("searchpage.albums")}
                  albums={albums}
                  isLoading={false}
                />
              )}
              {playlists.length > 0 && (
                <PlaylistGrid
                  title={t("searchpage.playlists")}
                  playlists={playlists}
                  isLoading={false}
                />
              )}
              {users.length > 0 && (
                <UserGrid
                  title={t("searchpage.users")}
                  users={users}
                  isLoading={false}
                />
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
};

export default SearchPage;
