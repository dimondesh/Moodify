import { useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import StandardLoader from "../../components/ui/StandardLoader";
import HorizontalSection from "../HomePage/HorizontalSection";
import { useHub } from "@/hooks/queries";
import { getHubDisplayName } from "@/lib/entitySection";
import type { Album, Artist, Playlist } from "@/types";

const HubDetailsPage = () => {
  const { t, i18n } = useTranslation();
  const { hubId } = useParams<{ hubId: string }>();
  const navigate = useNavigate();
  const { data, isPending, error } = useHub(hubId);

  const hub = data?.hub;
  const displayName = hub ? getHubDisplayName(hub, i18n.language) : "";

  const albumPreviewItems = useMemo(
    () =>
      (data?.albums?.preview ?? []).map((album: Album) => ({
        ...album,
        songs: album.songs ?? [],
        itemType: "album" as const,
      })),
    [data?.albums?.preview],
  );

  const albumAllItems = useMemo(
    () =>
      (data?.albums?.items ?? []).map((album: Album) => ({
        ...album,
        songs: album.songs ?? [],
        itemType: "album" as const,
      })),
    [data?.albums?.items],
  );

  const artistPreviewItems = useMemo(
    () =>
      (data?.artists?.preview ?? []).map((artist: Artist) => ({
        ...artist,
        itemType: "artist" as const,
      })),
    [data?.artists?.preview],
  );

  const artistAllItems = useMemo(
    () =>
      (data?.artists?.items ?? []).map((artist: Artist) => ({
        ...artist,
        itemType: "artist" as const,
      })),
    [data?.artists?.items],
  );

  const playlistPreviewItems = useMemo(
    () =>
      (data?.playlists?.preview ?? []).map((playlist: Playlist) => ({
        ...playlist,
        itemType: "playlist" as const,
      })),
    [data?.playlists?.preview],
  );

  const playlistAllItems = useMemo(
    () =>
      (data?.playlists?.items ?? []).map((playlist: Playlist) => ({
        ...playlist,
        itemType: "playlist" as const,
      })),
    [data?.playlists?.items],
  );

  const handleShowAllAlbums = useCallback(() => {
    navigate("/list", {
      state: { title: t("hubpage.albums"), items: albumAllItems },
    });
  }, [navigate, t, albumAllItems]);

  const handleShowAllArtists = useCallback(() => {
    navigate("/list", {
      state: { title: t("hubpage.artists"), items: artistAllItems },
    });
  }, [navigate, t, artistAllItems]);

  const handleShowAllPlaylists = useCallback(() => {
    navigate("/list", {
      state: { title: t("hubpage.playlists"), items: playlistAllItems },
    });
  }, [navigate, t, playlistAllItems]);

  if (isPending) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <StandardLoader />
      </div>
    );
  }

  if (error || !hub) {
    return (
      <div className="p-6 text-center text-zinc-400">
        {t("hubpage.notFound")}
      </div>
    );
  }

  const heroGradient = `linear-gradient(
    to bottom,
    ${hub.accentColor} 0%,
    ${hub.accentColor} 12%,
    color-mix(in srgb, ${hub.accentColor} 82%, #121212) 28%,
    color-mix(in srgb, ${hub.accentColor} 58%, #121212) 45%,
    color-mix(in srgb, ${hub.accentColor} 36%, #121212) 62%,
    color-mix(in srgb, ${hub.accentColor} 18%, #121212) 78%,
    color-mix(in srgb, ${hub.accentColor} 6%, #121212) 90%,
    #121212 100%
  )`;

  return (
    <>
      <Helmet>
        <title>{displayName}</title>
      </Helmet>
      <div className="relative min-h-screen pb-40 lg:pb-0 bg-[#121212]">
        <div
          className="absolute inset-x-0 top-0 h-[52vh] min-h-[400px] max-h-[580px] pointer-events-none"
          aria-hidden="true"
          style={{ background: heroGradient }}
        />
        <div className="relative z-10">
          <div className="px-4 sm:px-6 pt-8 pb-20 sm:pt-12 sm:pb-28">
            <h1 className="text-white text-4xl sm:text-6xl font-bold leading-tight">
              {displayName}
            </h1>
          </div>

          <div className="p-4 sm:p-6 space-y-8">
            <HorizontalSection
              title={t("hubpage.albums")}
              items={albumPreviewItems}
              totalCount={data?.albums?.total}
              isLoading={false}
              t={t}
              onShowAll={handleShowAllAlbums}
            />
            <HorizontalSection
              title={t("hubpage.artists")}
              items={artistPreviewItems}
              totalCount={data?.artists?.total}
              isLoading={false}
              t={t}
              onShowAll={handleShowAllArtists}
            />
            <HorizontalSection
              title={t("hubpage.playlists")}
              items={playlistPreviewItems}
              totalCount={data?.playlists?.total}
              isLoading={false}
              t={t}
              onShowAll={handleShowAllPlaylists}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default HubDetailsPage;
