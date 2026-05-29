import { Button } from "@/components/ui/button";
import StandardLoader from "@/components/ui/StandardLoader";
import {
  fetchDiscoverSearchCategory,
  fetchDiscoverSearchPreview,
  type DiscoverSearchCategory,
  type DiscoverTopResult,
} from "@/lib/playlistDiscoverSearch";
import { usePlayerStore } from "@/stores/usePlayerStore";
import {
  useArtist,
  useAlbum,
  usePlaylistRecommendations,
} from "@/hooks/queries";
import type { Album, Artist, Song } from "@/types";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PlaylistDiscoverListItem } from "./PlaylistDiscoverListItem";

type DiscoverView =
  | { kind: "root" }
  | { kind: "artist"; artistId: string; name: string }
  | { kind: "album"; albumId: string; title: string }
  | {
      kind: "searchCategory";
      category: DiscoverSearchCategory;
      query: string;
      title: string;
    };

type PlaylistDiscoverSectionProps = {
  playlistId: string;
  playlistSongCount: number;
  playlistSongIds: Set<string>;
  onAddSong: (songId: string) => Promise<void>;
};

function SongListHeader({
  showAlbumColumn = true,
  showPlayColumn = false,
}: {
  showAlbumColumn?: boolean;
  showPlayColumn?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`hidden sm:grid gap-3 sm:gap-4 px-2 py-2 text-xs text-zinc-500 border-b border-white/5 mb-1 ${
        showPlayColumn
          ? "sm:grid-cols-[16px_minmax(0,4fr)_minmax(0,2fr)_auto]"
          : "sm:grid-cols-[minmax(0,4fr)_minmax(0,2fr)_auto]"
      }`}
    >
      {showPlayColumn ? <div>#</div> : null}
      <div>{t("pages.playlist.headers.title")}</div>
      {showAlbumColumn ? (
        <div>{t("pages.playlist.discover.headers.album")}</div>
      ) : (
        <div />
      )}
      <div />
    </div>
  );
}

export function PlaylistDiscoverSection({
  playlistId,
  playlistSongCount,
  playlistSongIds,
  onAddSong,
}: PlaylistDiscoverSectionProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewStack, setViewStack] = useState<DiscoverView[]>([{ kind: "root" }]);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [topResults, setTopResults] = useState<DiscoverTopResult[]>([]);
  const [searchCounts, setSearchCounts] = useState({
    songs: 0,
    albums: 0,
    artists: 0,
  });

  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categorySongs, setCategorySongs] = useState<Song[]>([]);
  const [categoryAlbums, setCategoryAlbums] = useState<Album[]>([]);
  const [categoryArtists, setCategoryArtists] = useState<Artist[]>([]);

  const currentView = viewStack[viewStack.length - 1];
  const isRoot = currentView.kind === "root";
  const hasSearchQuery = searchTerm.trim().length > 0;
  const showRecommendations =
    isRoot && !hasSearchQuery && playlistSongCount > 3;

  const artistId =
    currentView.kind === "artist" ? currentView.artistId : undefined;
  const albumId =
    currentView.kind === "album" ? currentView.albumId : undefined;

  const { data: artistData, isPending: artistLoading } = useArtist(artistId);
  const { data: currentAlbum, isPending: albumLoading } = useAlbum(albumId);
  const currentArtist = artistData?.artist;
  const musicLoading = artistLoading || albumLoading;

  const {
    data: playlistRecommendations = null,
    isPending: isRecommendationsLoading,
    refetch: refetchRecommendations,
  } = usePlaylistRecommendations(
    showRecommendations ? playlistId : undefined,
  );

  const {
    playAlbum,
    setCurrentSong,
    togglePlay,
    isPlaying,
    currentSong,
    queue,
  } = usePlayerStore();

  const hasSearchResults =
    topResults.length > 0 ||
    searchCounts.songs > 0 ||
    searchCounts.albums > 0 ||
    searchCounts.artists > 0;

  useEffect(() => {
    if (!hasSearchQuery || !isRoot) {
      setTopResults([]);
      setSearchCounts({ songs: 0, albums: 0, artists: 0 });
      return;
    }

    const handler = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const data = await fetchDiscoverSearchPreview(searchTerm.trim());
        setTopResults(data.topResults);
        setSearchCounts(data.counts);
      } catch {
        setTopResults([]);
        setSearchCounts({ songs: 0, albums: 0, artists: 0 });
      } finally {
        setPreviewLoading(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm, hasSearchQuery, isRoot]);

  useEffect(() => {
    if (currentView.kind === "searchCategory") {
      const loadCategory = async () => {
        setCategoryLoading(true);
        setCategorySongs([]);
        setCategoryAlbums([]);
        setCategoryArtists([]);
        try {
          const data = await fetchDiscoverSearchCategory(
            currentView.query,
            currentView.category,
          );
          setCategorySongs(data.songs);
          setCategoryAlbums(data.albums);
          setCategoryArtists(data.artists);
        } finally {
          setCategoryLoading(false);
        }
      };
      loadCategory();
    }
  }, [currentView]);

  const pushView = useCallback((view: DiscoverView) => {
    setViewStack((prev) => [...prev, view]);
  }, []);

  const popView = useCallback(() => {
    setViewStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const openArtist = useCallback(
    (artistId: string, name: string) => {
      pushView({ kind: "artist", artistId, name });
    },
    [pushView],
  );

  const openAlbum = useCallback(
    (albumId: string, title: string) => {
      pushView({ kind: "album", albumId, title });
    },
    [pushView],
  );

  const isQueueForSongs = useCallback(
    (songs: Song[]) => {
      if (!songs.length || queue.length === 0) return false;
      return songs.some((s) => s._id === queue[0]?._id);
    },
    [queue],
  );

  const playDiscoverSongs = useCallback(
    (
      songs: Song[],
      index: number,
      context: { entityId: string; entityTitle: string },
    ) => {
      if (!songs.length || index < 0 || index >= songs.length) return;
      const song = songs[index];
      const playbackContext = { type: "playlist" as const, ...context };
      if (isQueueForSongs(songs)) {
        if (currentSong?._id === song._id) {
          togglePlay();
        } else {
          setCurrentSong(song);
          playAlbum(songs, index, playbackContext);
        }
      } else {
        playAlbum(songs, index, playbackContext);
      }
    },
    [isQueueForSongs, currentSong?._id, togglePlay, setCurrentSong, playAlbum],
  );

  const topResultSongs = useMemo(
    () =>
      topResults
        .filter((r) => r.kind === "song")
        .map((r) => {
          const { kind: _k, ...song } = r;
          return song as Song;
        }),
    [topResults],
  );

  const openSearchCategory = useCallback(
    (category: DiscoverSearchCategory, entityLabel: string) => {
      pushView({
        kind: "searchCategory",
        category,
        query: searchTerm.trim(),
        title: entityLabel,
      });
    },
    [pushView, searchTerm],
  );

  const renderSong = (
    song: Song,
    opts?: {
      showAlbumColumn?: boolean;
      trackIndex?: number;
      playIndex?: number;
      onPlay?: (song: Song, index: number) => void;
    },
  ) => {
    const playIndex = opts?.playIndex;
    const onPlay = opts?.onPlay;
    return (
      <PlaylistDiscoverListItem
        key={song._id}
        variant="song"
        title={song.title}
        images={song.images}
        artists={song.artist}
        albumTitle={song.albumTitle}
        showAlbumColumn={opts?.showAlbumColumn ?? true}
        trackIndex={opts?.trackIndex}
        isAdded={playlistSongIds.has(song._id)}
        onAdd={() => onAddSong(song._id)}
        onAlbumClick={() => {
          if (song.albumId) openAlbum(song.albumId, song.albumTitle || song.title);
        }}
        onArtistClick={(id) => {
          const artist = song.artist.find((a) => a._id === id);
          openArtist(id, artist?.name || "");
        }}
        playIndex={playIndex}
        onPlay={
          onPlay != null && playIndex != null
            ? () => onPlay(song, playIndex)
            : undefined
        }
        isCurrentlyPlaying={currentSong?._id === song._id}
        isPlayerPlaying={isPlaying}
      />
    );
  };

  const renderTopResultItem = (item: DiscoverTopResult) => {
    if (item.kind === "song") {
      const { kind: _k, ...song } = item;
      const s = song as Song;
      const index = topResultSongs.findIndex((x) => x._id === s._id);
      return renderSong(s, {
        playIndex: index,
        onPlay: (_, i) =>
          playDiscoverSongs(topResultSongs, i, {
            entityId: `${playlistId}:search-preview`,
            entityTitle: t("pages.playlist.discover.topResults"),
          }),
      });
    }
    if (item.kind === "album") {
      const { kind: _k, ...album } = item;
      return (
        <PlaylistDiscoverListItem
          key={album._id}
          variant="album"
          title={album.title}
          images={album.images}
          onDrillDown={() => openAlbum(album._id, album.title)}
        />
      );
    }
    const { kind: _k, ...artist } = item;
    return (
      <PlaylistDiscoverListItem
        key={artist._id}
        variant="artist"
        title={artist.name}
        images={artist.images}
        onDrillDown={() => openArtist(artist._id, artist.name)}
      />
    );
  };

  const renderSeeAllRow = (
    category: DiscoverSearchCategory,
    entityLabel: string,
    count: number,
  ) => {
    if (count === 0) return null;

    return (
      <button
        key={category}
        type="button"
        onClick={() => openSearchCategory(category, entityLabel)}
        className="w-full grid grid-cols-[minmax(0,4fr)_minmax(0,2fr)_auto] gap-3 sm:gap-4 items-center px-2 py-3 rounded-md hover:bg-white/5 transition-colors text-left border-t border-white/5"
      >
        <span className="text-sm font-medium text-white">
          {t("pages.playlist.discover.seeAll", { entity: entityLabel })}
        </span>
        <span />
        <ChevronRight className="size-5 text-zinc-400 justify-self-end" />
      </button>
    );
  };

  const artistAlbums = useMemo(
    () => currentArtist?.albums ?? [],
    [currentArtist?.albums],
  );

  const backLabel = useMemo(() => {
    if (viewStack.length <= 1) return "";
    const prev = viewStack[viewStack.length - 2];
    if (prev.kind === "root") return t("pages.playlist.discover.back");
    if (prev.kind === "artist") return prev.name;
    if (prev.kind === "album") return prev.title;
    if (prev.kind === "searchCategory") return prev.title;
    return t("pages.playlist.discover.back");
  }, [viewStack, t]);

  return (
    <section className="border-t border-white/10 px-4 sm:px-6 md:px-10 py-8">
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
        {t("pages.playlist.discover.title")}
      </h2>

      {!isRoot && (
        <button
          type="button"
          onClick={popView}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-4 transition-colors"
        >
          <ChevronLeft className="size-5" />
          {backLabel}
        </button>
      )}

      {isRoot && (
        <div className="relative w-full max-w-lg mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("pages.playlist.discover.searchPlaceholder")}
            spellCheck={false}
            autoComplete="off"
            className="w-full bg-zinc-800/50 rounded-full py-2 pl-10 pr-4 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#8b5cf6] transition"
          />
        </div>
      )}

      {isRoot && hasSearchQuery && (
        <div className="space-y-6">
          {previewLoading ? (
            <div className="flex justify-center py-6">
              <StandardLoader size="md" />
            </div>
          ) : !hasSearchResults ? (
            <p className="text-zinc-400 px-2">{t("pages.playlist.discover.noResults")}</p>
          ) : (
            <>
              {topResults.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2 px-2">
                    {t("pages.playlist.discover.topResults")}
                  </h3>
                  {topResultSongs.length > 0 && (
                    <SongListHeader showPlayColumn />
                  )}
                  <div className="space-y-1">
                    {topResults.map((item) => renderTopResultItem(item))}
                  </div>
                </div>
              )}

              <div className="space-y-0">
                {renderSeeAllRow(
                  "songs",
                  t("pages.playlist.discover.songsSection"),
                  searchCounts.songs,
                )}
                {renderSeeAllRow(
                  "albums",
                  t("pages.playlist.discover.albumsSection"),
                  searchCounts.albums,
                )}
                {renderSeeAllRow(
                  "artists",
                  t("pages.playlist.discover.artistsSection"),
                  searchCounts.artists,
                )}
              </div>
            </>
          )}
        </div>
      )}

      {currentView.kind === "searchCategory" && (
        <div>
          <h3 className="text-lg font-bold text-white mb-3 px-2">{currentView.title}</h3>
          {categoryLoading ? (
            <div className="flex justify-center py-8">
              <StandardLoader size="md" />
            </div>
          ) : currentView.category === "songs" ? (
            categorySongs.length > 0 ? (
              <>
                <SongListHeader showPlayColumn />
                <div className="space-y-1">
                  {categorySongs.map((song, index) =>
                    renderSong(song, {
                      playIndex: index,
                      onPlay: (_, i) =>
                        playDiscoverSongs(categorySongs, i, {
                          entityId: `${playlistId}:search-songs:${currentView.query}`,
                          entityTitle: currentView.title,
                        }),
                    }),
                  )}
                </div>
              </>
            ) : (
              <p className="text-zinc-400 px-2">{t("pages.playlist.discover.noResults")}</p>
            )
          ) : currentView.category === "albums" ? (
            categoryAlbums.length > 0 ? (
              <div className="space-y-1">
                {categoryAlbums.map((album) => (
                  <PlaylistDiscoverListItem
                    key={album._id}
                    variant="album"
                    title={album.title}
                    images={album.images}
                    onDrillDown={() => openAlbum(album._id, album.title)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-zinc-400 px-2">{t("pages.playlist.discover.noResults")}</p>
            )
          ) : categoryArtists.length > 0 ? (
            <div className="space-y-1">
              {categoryArtists.map((artist) => (
                <PlaylistDiscoverListItem
                  key={artist._id}
                  variant="artist"
                  title={artist.name}
                  images={artist.images}
                  onDrillDown={() => openArtist(artist._id, artist.name)}
                />
              ))}
            </div>
          ) : (
            <p className="text-zinc-400 px-2">{t("pages.playlist.discover.noResults")}</p>
          )}
        </div>
      )}

      {isRoot && !hasSearchQuery && showRecommendations && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 px-2">
            <h3 className="text-lg font-bold text-white">
              {t("pages.playlist.discover.recommended")}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={isRecommendationsLoading}
              onClick={() => void refetchRecommendations()}
              title={t("common.refreshRecommendations")}
              className="text-zinc-400 hover:text-white hover:bg-transparent! font-medium"
            >
              {t("pages.playlist.discover.refresh")}
            </Button>
          </div>
          {isRecommendationsLoading ? (
            <div className="flex justify-center py-6">
              <StandardLoader size="md" />
            </div>
          ) : playlistRecommendations && playlistRecommendations.length > 0 ? (
            <>
              <SongListHeader showPlayColumn />
              <div className="space-y-1">
                {playlistRecommendations.map((song, index) =>
                  renderSong(song, {
                    playIndex: index,
                    onPlay: (_, i) =>
                      playDiscoverSongs(playlistRecommendations, i, {
                        entityId: `${playlistId}:recommendations`,
                        entityTitle: t("pages.playlist.discover.recommended"),
                      }),
                  }),
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {currentView.kind === "artist" && (
        <div className="space-y-8">
          {musicLoading && !currentArtist ? (
            <div className="flex justify-center py-8">
              <StandardLoader size="md" />
            </div>
          ) : (
            <>
              {currentArtist?.songs && currentArtist.songs.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-white mb-3 px-2">
                    {t("pages.playlist.discover.popular")}
                  </h3>
                  <SongListHeader showPlayColumn />
                  <div className="space-y-1">
                    {currentArtist.songs.map((song, index) =>
                      renderSong(song, {
                        playIndex: index,
                        onPlay: (_, i) =>
                          playDiscoverSongs(currentArtist.songs, i, {
                            entityId: `${playlistId}:artist:${currentView.artistId}`,
                            entityTitle: currentView.name,
                          }),
                      }),
                    )}
                  </div>
                </div>
              )}
              {artistAlbums.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-white mb-3 px-2">
                    {t("pages.playlist.discover.albums")}
                  </h3>
                  <div className="space-y-1">
                    {artistAlbums.map((album) => (
                      <PlaylistDiscoverListItem
                        key={album._id}
                        variant="album"
                        title={album.title}
                        images={album.images}
                        onDrillDown={() => openAlbum(album._id, album.title)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {currentView.kind === "album" && (
        <div>
          {musicLoading && !currentAlbum ? (
            <div className="flex justify-center py-8">
              <StandardLoader size="md" />
            </div>
          ) : currentAlbum?.songs && currentAlbum.songs.length > 0 ? (
            <>
              <SongListHeader showAlbumColumn={false} showPlayColumn />
              <div className="space-y-1">
                {currentAlbum.songs.map((song, index) =>
                  renderSong(song, {
                    showAlbumColumn: false,
                    playIndex: index,
                    onPlay: (_, i) =>
                      playDiscoverSongs(currentAlbum.songs, i, {
                        entityId: `${playlistId}:album:${currentView.albumId}`,
                        entityTitle: currentView.title,
                      }),
                  }),
                )}
              </div>
            </>
          ) : (
            <p className="text-zinc-400 px-2">{t("pages.playlist.discover.noResults")}</p>
          )}
        </div>
      )}
    </section>
  );
}
