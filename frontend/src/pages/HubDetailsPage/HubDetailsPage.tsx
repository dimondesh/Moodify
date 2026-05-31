import { useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import StandardLoader from "../../components/ui/StandardLoader";
import HorizontalSection from "../HomePage/HorizontalSection";
import { useHub } from "@/hooks/queries";
import { getHubDisplayName } from "@/lib/utils";
import type { Album, Artist, Playlist } from "@/types";

const HubDetailsPage = () => {
  const { t, i18n } = useTranslation();
  const { hubId } = useParams<{ hubId: string }>();
  const navigate = useNavigate();
  const { data, isPending, error } = useHub(hubId);

  const hub = data?.hub;
  const displayName = hub ? getHubDisplayName(hub, i18n.language) : "";

  const albumItems = useMemo(
    () =>
      (data?.albums ?? []).map((album: Album) => ({
        ...album,
        songs: album.songs ?? [],
        itemType: "album" as const,
      })),
    [data?.albums],
  );

  const artistItems = useMemo(
    () =>
      (data?.artists ?? []).map((artist: Artist) => ({
        ...artist,
        itemType: "artist" as const,
      })),
    [data?.artists],
  );

  const playlistItems = useMemo(
    () =>
      (data?.playlists ?? []).map((playlist: Playlist) => ({
        ...playlist,
        itemType: "playlist" as const,
      })),
    [data?.playlists],
  );

  const handleShowAllAlbums = useCallback(() => {
    navigate("/list", {
      state: { title: t("hubpage.albums"), items: albumItems },
    });
  }, [navigate, t, albumItems]);

  const handleShowAllArtists = useCallback(() => {
    navigate("/list", {
      state: { title: t("hubpage.artists"), items: artistItems },
    });
  }, [navigate, t, artistItems]);

  const handleShowAllPlaylists = useCallback(() => {
    navigate("/list", {
      state: { title: t("hubpage.playlists"), items: playlistItems },
    });
  }, [navigate, t, playlistItems]);

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
            items={albumItems}
            isLoading={false}
            t={t}
            limit={12}
            onShowAll={handleShowAllAlbums}
          />
          <HorizontalSection
            title={t("hubpage.artists")}
            items={artistItems}
            isLoading={false}
            t={t}
            limit={12}
            onShowAll={handleShowAllArtists}
          />
          <HorizontalSection
            title={t("hubpage.playlists")}
            items={playlistItems}
            isLoading={false}
            t={t}
            limit={12}
            onShowAll={handleShowAllPlaylists}
          />
          </div>
        </div>
      </div>
    </>
  );
};

export default HubDetailsPage;
