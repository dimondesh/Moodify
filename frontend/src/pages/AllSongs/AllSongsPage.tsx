/* eslint-disable @typescript-eslint/no-unused-vars */
// frontend/src/pages/AllSongs/AllSongsPage.tsx
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PlayButton from "../../pages/HomePage/PlayButton";
import SectionGridSkeleton from "../../components/ui/skeletons/PlaylistSkeleton";
import type { Song } from "../../types/index";
import axios from "axios";
import { ScrollArea, ScrollBar } from "../../components/ui/scroll-area";
import { useMusicStore } from "../../stores/useMusicStore";
import { useTranslation } from "react-i18next";
import { getArtistNames, getOptimizedImageUrl } from "@/lib/utils";

const AllSongsPage = () => {
  const { t } = useTranslation();
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const initialSongs = location.state?.songs;
  const pageTitle = location.state?.title || t("searchpage.songs");
  const apiEndpoint = location.state?.apiEndpoint;
  const { artists, fetchArtists } = useMusicStore();

  useEffect(() => {
    if (initialSongs && initialSongs.length > 0) {
      setSongs(initialSongs);
      setIsLoading(false);
    } else if (apiEndpoint) {
      const fetchSongs = async () => {
        try {
          const response = await axios.get(apiEndpoint, {
            withCredentials: true,
          });
          const fetchedData = response.data.songs || response.data.albums;
          if (Array.isArray(fetchedData)) {
            setSongs(fetchedData);
          } else {
            setError(t("common.error"));
          }
        } catch (err) {
          setError(t("common.error"));
        } finally {
          setIsLoading(false);
        }
      };
      fetchSongs();
    } else {
      setIsLoading(false);
      setError(t("common.noData"));
    }
    fetchArtists();
  }, [initialSongs, apiEndpoint, fetchArtists, t]);

  const handleNavigateToAlbum = (albumId: string | null | undefined) => {
    if (albumId) {
      const albumIdStr = String(albumId);
      if (albumIdStr.length > 0) navigate(`/albums/${albumIdStr}`);
    }
  };

  if (isLoading) return <SectionGridSkeleton />;
  if (error)
    return (
      <div className="p-4 text-red-500">
        {t("common.error")}: {error}
      </div>
    );
  if (!songs || songs.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4">{pageTitle}</h2>
        <p className="text-zinc-400">{t("common.songsNotFound")}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-120px)] w-full rounded-md pr-4 bg-zinc-950">
      <div className="p-4 pt-4 pb-14 md:pb-16">
        <h2 className="text-2xl font-bold mb-6">{pageTitle}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {songs.map((song, index) => (
            <div
              key={song._id}
              className=" p-3 rounded-md hover:bg-zinc-700/40 transition-all group cursor-pointer flex flex-col"
              onClick={() => handleNavigateToAlbum(song.albumId)}
            >
              <div className="relative mb-3">
                <div className="aspect-square rounded-md shadow-lg overflow-hidden">
                  <img
                    src={getOptimizedImageUrl(
                      song.imageUrl || "/default-song-cover.png",
                      300
                    )}
                    alt={song.title || t("common.noTitle")}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "/default-song-cover.png";
                    }}
                  />
                </div>
                <PlayButton song={song} songs={songs} songIndex={index} />
              </div>
              <div className="px-1 flex flex-col">
                <h3 className="font-semibold text-sm truncate text-white">
                  {song.title || t("common.noTitle")}
                </h3>
                <p className="text-xs text-zinc-400 truncate">
                  {getArtistNames(song.artist, artists)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
};

export default AllSongsPage;
