// src/pages/HomePage/FeaturedSection.tsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMusicStore } from "../../stores/useMusicStore";
import PlayButton from "./PlayButton";
import { JSX } from "react";
import { Song } from "@/types";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { usePlayerStore } from "../../stores/usePlayerStore";
import { useTranslation } from "react-i18next";
import { cn, getOptimizedImageUrl } from "@/lib/utils";

interface Artist {
  _id: string;
  name: string;
}

interface FeaturedSectionProps {
  onSongHover: (song: Song) => void;
  onSongLeave: () => void;
}

const FeaturedSectionComponent = ({
  onSongHover,
  onSongLeave,
}: FeaturedSectionProps) => {
  const { t } = useTranslation();
  const { featuredSongs, error, artists, fetchArtists } = useMusicStore();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { playAlbum, togglePlay, currentSong, isPlaying } = usePlayerStore();

  useEffect(() => {
    fetchArtists();
  }, [fetchArtists]);

  const getArtistNamesDisplay = (
    artistsInput: (string | Artist)[] | undefined,
    isMobileView: boolean
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
        if (isMobileView) {
          artistElements.push(
            <span
              key={artistId}
              onClick={(e) => {
                e.stopPropagation();
                handleNavigateToArtist(artistId);
              }}
              className="hover:underline focus:outline-none focus:underline"
            >
              {artistName}
            </span>
          );
        } else {
          artistElements.push(
            <button
              key={artistId}
              onClick={(e) => {
                e.stopPropagation();
                handleNavigateToArtist(artistId);
              }}
              className="hover:underline focus:outline-none focus:underline"
            >
              {artistName}
            </button>
          );
        }
        if (index < artistsInput.length - 1) {
          artistElements.push(<span key={`sep-${artistId}`}>, </span>);
        }
      }
    });

    return <>{artistElements}</>;
  };

  if (error) return <p className="text-red-500 mb-4 text-lg">{error}</p>;

  const songsArray = Array.isArray(featuredSongs) ? featuredSongs : [];
  const songsToShow = songsArray.slice(0, 6);

  const handleNavigateToAlbum = (albumId: string | null | undefined) => {
    if (albumId) {
      navigate(`/albums/${albumId}`);
    } else {
      console.warn("albumId отсутствует");
    }
  };

  const handleNavigateToArtist = (artistId: string) => {
    navigate(`/artists/${artistId}`);
  };

  if (songsArray.length === 0) {
    return <p className="text-zinc-400">{t("common.noSongs")}</p>;
  }

  const handleItemClick = (song: Song, index: number) => {
    if (isMobile) {
      const isThisSongPlaying = isPlaying && currentSong?._id === song._id;
      if (isThisSongPlaying) {
        togglePlay();
      } else {
        playAlbum(songsArray, index);
      }
    } else {
      handleNavigateToAlbum(song.albumId);
    }
  };
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-8"
      onMouseLeave={onSongLeave}
    >
      {songsToShow.map((song, index) => {
        const Component = isMobile ? "button" : "div";
        const isThisSongPlaying = isPlaying && currentSong?._id === song._id;

        return (
          <Component
            key={song._id}
            className={cn(
              "flex items-center bg-zinc-800/50 rounded-md overflow-hidden hover:bg-zinc-700/50 transition-colors group cursor-pointer relative text-left",
              isThisSongPlaying && "bg-violet-500/20 hover:bg-violet-500/30"
            )}
            onClick={() => handleItemClick(song, index)}
            onMouseEnter={() => !isMobile && onSongHover(song)}
          >
            <div className="flex-shrink-0">
              <img
                src={getOptimizedImageUrl(
                  song.imageUrl || "/default-song-cover.png",
                  160
                )}
                alt={song.title}
                className="w-14 h-14 sm:w-20 sm:h-20 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "/default-song-cover.png";
                }}
              />
            </div>
            <div className="flex-1 p-2 sm:p-3 min-w-0">
              <p
                className={cn(
                  "font-medium truncate text-sm sm:text-base transition-all duration-400",
                  isThisSongPlaying ? "text-violet-400" : "text-white"
                )}
              >
                {song.title || t("common.noTitle")}
              </p>
              <p className="hidden sm:inline text-sm text-zinc-400 truncate">
                {getArtistNamesDisplay(song.artist, isMobile)}
              </p>
            </div>
            {!isMobile && (
              <PlayButton song={song} songs={songsArray} songIndex={index} />
            )}
          </Component>
        );
      })}
    </div>
  );
};

const FeaturedSection = React.memo(FeaturedSectionComponent);
export default FeaturedSection;
