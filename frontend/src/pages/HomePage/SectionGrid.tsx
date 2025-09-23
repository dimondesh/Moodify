import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import type { Song } from "../../types";
import PlayButton from "./PlayButton";
import SectionGridSkeleton from "./SectionGridSkeleton";
import { useMusicStore } from "../../stores/useMusicStore";
import { JSX, useEffect } from "react";
import { useTranslation } from "react-i18next";
import AlbumCoverImage from "../../components/AlbumCoverImage";

interface Artist {
  _id: string;
  name: string;
}

type SectionGridProps = {
  title: string;
  songs: Song[] | null | undefined;
  isLoading: boolean;
  apiEndpoint?: string;
  showAllPath?: string;
};

const SectionGrid = ({
  title,
  songs,
  isLoading,
  apiEndpoint,
}: SectionGridProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { artists, fetchArtists } = useMusicStore();

  useEffect(() => {
    fetchArtists();
  }, [fetchArtists]);

  const getArtistNamesDisplay = (
    artistsInput: (string | Artist)[] | undefined
  ) => {
    if (!artistsInput || artistsInput.length === 0) {
      return <span>{t("common.unknownArtist")}</span>;
    }

    const artistElements: JSX.Element[] = [];
    artistsInput.forEach((artistOrId, index) => {
      let artistName: string | null = null;
      let artistId: string | null = null;

      if (typeof artistOrId === "string") {
        const foundArtist = artists.find((a: Artist) => a._id === artistOrId);
        if (foundArtist) {
          artistName = foundArtist.name;
          artistId = foundArtist._id;
        }
      } else {
        artistName = artistOrId.name;
        artistId = artistOrId._id;
      }

      if (artistName && artistId) {
        artistElements.push(
          <span key={artistId}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNavigateToArtist(artistId);
              }}
              className="hover:underline focus:outline-none focus:underline"
            >
              {artistName}
            </button>
            {index < artistsInput.length - 1 && ", "}
          </span>
        );
      }
    });

    return <>{artistElements}</>;
  };

  const handleNavigateToAlbum = (
    e: React.MouseEvent,
    albumId: string | null | undefined
  ) => {
    e.stopPropagation();
    if (albumId) {
      const albumIdStr = String(albumId);
      if (albumIdStr.length > 0) {
        navigate(`/albums/${albumIdStr}`);
      }
    } else {
      console.warn("albumId is missing or not a string:", albumId);
    }
  };

  const handleNavigateToArtist = (artistId: string) => {
    navigate(`/artists/${artistId}`);
  };

  if (isLoading) return <SectionGridSkeleton />;

  const safeSongs = Array.isArray(songs) ? songs : [];
  const songsToShow = safeSongs.slice(0, 4);

  if (safeSongs.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-4">{title}</h2>
        <p className="text-zinc-400">{t("common.songsNotFound")}</p>
      </div>
    );
  }

  const handleShowAll = () => {
    navigate(`/all-songs/${encodeURIComponent(title)}`, {
      state: {
        songs: safeSongs,
        title: title,
        apiEndpoint: apiEndpoint,
      },
    });
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4 ">
        <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
        {safeSongs.length > 4 && (
          <Button
            variant="link"
            className="text-sm text-zinc-400 hover:text-white"
            onClick={handleShowAll}
          >
            {t("searchpage.showAll")}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {songsToShow.map((song) => {
          const originalIndex = safeSongs.findIndex((s) => s._id === song._id);
          return (
            <div
              key={song._id}
              className="bg-[#1a1a1a] p-3 rounded-md hover:bg-[#2a2a2a] transition-all group cursor-pointer hover-scale"
              onClick={() => {
                if (song.albumId) {
                  const albumIdStr = String(song.albumId);
                  if (albumIdStr.length > 0) {
                    navigate(`/albums/${albumIdStr}`);
                  }
                } else {
                  console.warn(
                    "albumId is missing or not a string:",
                    song.albumId
                  );
                }
              }}
            >
              <div className="relative mb-3">
                <div className="aspect-square rounded-md shadow-lg overflow-hidden">
                  <button
                    onClick={(e) => handleNavigateToAlbum(e, song.albumId)}
                    className="w-full h-full block"
                  >
                    <AlbumCoverImage
                      src={song.imageUrl || "/default-song-cover.png"}
                      alt={song.title || t("common.noTitle")}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      albumId={song.albumId || undefined}
                      fallbackSrc="/default-song-cover.png"
                    />
                  </button>
                </div>
                <PlayButton
                  song={song}
                  songs={safeSongs}
                  songIndex={originalIndex}
                />
              </div>
              <h3 className="font-medium mb-1 truncate text-white text-sm">
                <button
                  onClick={(e) => handleNavigateToAlbum(e, song.albumId)}
                  className="hover:underline focus:outline-none focus:underline text-left w-full"
                >
                  {song.title || t("common.noTitle")}
                </button>
              </h3>
              <p className="text-xs text-gray-400 truncate">
                {getArtistNamesDisplay(song.artist)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SectionGrid;
