import {
  getTrendingSongs,
  getTrendingArtists,
  getTrendingAlbums,
} from "./trending.service.js";

const HOME_SECTION_LIMIT = 12;

export const buildGuestHomeSections = async () => {
  const [trendingSongs, trendingArtists, trendingAlbums] = await Promise.all([
    getTrendingSongs(HOME_SECTION_LIMIT),
    getTrendingArtists(HOME_SECTION_LIMIT),
    getTrendingAlbums(HOME_SECTION_LIMIT),
  ]);

  return [
    { id: "trendingSongs", items: trendingSongs ?? [] },
    {
      id: "trendingArtists",
      items: (trendingArtists ?? []).map((artist) => ({
        ...artist,
        itemType: "artist",
      })),
    },
    {
      id: "trendingAlbums",
      items: (trendingAlbums ?? []).map((album) => ({
        ...album,
        itemType: "album",
      })),
    },
  ];
};

export const getGuestHomeData = async () => ({
  mode: "guest",
  sections: await buildGuestHomeSections(),
});
