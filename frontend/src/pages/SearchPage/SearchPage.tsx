// src/pages/SearchPage/SearchPage.tsx

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import AlbumGrid from "./AlbumGrid";
import SongGrid from "./SongGrid";
import PlaylistGrid from "./PlaylistGrid";
import ArtistGrid from "./ArtistGrid";
import useDebounce from "../../hooks/useDebounce";
import UserGrid from "./UserGrid";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import BrowseSecondaryPlaylists from "./BrowseSecondaryPlaylists";
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
import { axiosInstance } from "../../lib/axios";
import type {
  Playlist,
  Song,
  Album,
  Artist,
  User,
  RecentSearchItem,
} from "../../types";

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

  const [searchQuery, setSearchQuery] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);
  const [isRecentLoading, setIsRecentLoading] = useState(false);

  const debouncedInputSearchTerm = useDebounce(queryParam, 500);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSongs([]);
      setAlbums([]);
      setPlaylists([]);
      setArtists([]);
      setUsers([]);
      setLoading(false);
      setError(null);
      setSearchQuery("");
      return;
    }

    setLoading(true);
    setError(null);
    setSearchQuery(q);

    try {
      const res = await axiosInstance.get("/search", { params: { q } });
      setSongs(res.data.songs || []);
      setAlbums(res.data.albums || []);
      setPlaylists(res.data.playlists || []);
      setArtists(res.data.artists || []);
      setUsers(res.data.users || []);
      setLoading(false);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to search";
      setError(message);
      setLoading(false);
    }
  }, []);

  const fetchRecentSearches = useCallback(async () => {
    setIsRecentLoading(true);
    try {
      const res = await axiosInstance.get("/users/me/recent-searches");
      setRecentSearches(res.data);
    } catch (e) {
      console.error("Failed to fetch recent searches", e);
    } finally {
      setIsRecentLoading(false);
    }
  }, []);

  const addRecentSearch = useCallback(async (itemId: string, itemType: string) => {
    try {
      await axiosInstance.post("/users/me/recent-searches", {
        itemId,
        itemType,
      });
    } catch (e) {
      console.error("Failed to add recent search", e);
    }
  }, []);

  const removeRecentSearch = useCallback(
    async (searchId: string) => {
      setRecentSearches((prev) =>
        prev.filter((s) => s.searchId !== searchId),
      );
      try {
        await axiosInstance.delete(`/users/me/recent-searches/${searchId}`);
      } catch (e) {
        console.error("Failed to remove recent search", e);
        void fetchRecentSearches();
      }
    },
    [fetchRecentSearches],
  );

  const clearRecentSearches = useCallback(async () => {
    setRecentSearches([]);
    try {
      await axiosInstance.delete("/users/me/recent-searches/all");
    } catch (e) {
      console.error("Failed to clear recent searches", e);
      void fetchRecentSearches();
    }
  }, [fetchRecentSearches]);

  useEffect(() => {
    if (debouncedInputSearchTerm.trim() !== searchQuery) {
      void search(debouncedInputSearchTerm.trim());
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
      void fetchRecentSearches();
    }

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      if (val.trim() !== "") {
        navigate(`/search?q=${encodeURIComponent(val)}`);
      } else {
        navigate("/search");
      }
    }, 300);
  };

  const handleTriggerClick = () => {
    if (authUser && !query) {
      void fetchRecentSearches();
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
    ? `Find artists, songs, albums, and playlists for "${queryParam}" on Moodify Music.`
    : "Search for your favorite songs, artists, albums, playlists, and users on Moodify Music.";

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
                      value={query}
                      onChange={handleChange}
                      className="w-full bg-zinc-800/50 rounded-full py-2 pl-10 pr-4 text-base text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] transition duration-150 ease-in-out"
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
                    recentSearches={recentSearches}
                    isRecentLoading={isRecentLoading}
                    onRemoveRecentSearch={removeRecentSearch}
                    onClearRecentSearches={clearRecentSearches}
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
              <BrowseSecondaryPlaylists />
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
            users.length === 0 && (
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
                  onAddRecentSearch={addRecentSearch}
                />
              )}
              {songs.length > 0 && (
                <SongGrid
                  title={t("searchpage.songs")}
                  songs={songs}
                  isLoading={loading}
                  onAddRecentSearch={addRecentSearch}
                />
              )}
              {albums.length > 0 && (
                <AlbumGrid
                  title={t("searchpage.albums")}
                  albums={albums}
                  isLoading={loading}
                  onAddRecentSearch={addRecentSearch}
                />
              )}
              {playlists.length > 0 && (
                <PlaylistGrid
                  title={t("searchpage.playlists")}
                  playlists={playlists}
                  isLoading={loading}
                  onAddRecentSearch={addRecentSearch}
                />
              )}
              {users.length > 0 && (
                <UserGrid
                  title={t("searchpage.users")}
                  users={users}
                  isLoading={loading}
                  onAddRecentSearch={addRecentSearch}
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
