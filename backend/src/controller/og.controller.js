import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { Playlist } from "../models/playlist.model.js";

export const generateOGMeta = async (req, res, next) => {
  try {
    const { id } = req.params;
    const path = req.path;

    let title = "Moodify - Discover Your Music";
    let description =
      "Listen on Moodify, the ultimate music streaming experience.";
    let image = "https://moodify-music.com/Moodify.png";
    let type = "music.song";

    if (path.startsWith("/track/")) {
      const song = await Song.findById(id).populate("artist", "name");
      if (song) {
        const artistNames = song.artist.map((a) => a.name).join(", ");
        title = `${song.title} - ${artistNames} | Moodify`;
        description = `Listen to ${song.title} by ${artistNames} on Moodify.`;
        image = song.imageUrl || image;
      }
    } else if (path.startsWith("/albums/")) {
      type = "music.album";
      const album = await Album.findById(id).populate("artist", "name");
      if (album) {
        const artistNames = album.artist.map((a) => a.name).join(", ");
        title = `${album.title} - ${artistNames} | Moodify`;
        description = `Listen to the album ${album.title} on Moodify.`;
        image = album.imageUrl || image;
      }
    } else if (path.startsWith("/playlists/")) {
      type = "music.playlist";
      const playlist = await Playlist.findById(id).populate(
        "owner",
        "fullName",
      );
      if (playlist) {
        title = `${playlist.title} | Moodify`;
        description = `Playlist by ${playlist.owner?.fullName || "Moodify User"}`;
        image = playlist.imageUrl || image;
      }
    }

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <meta name="description" content="${description}" />
        
        <meta property="og:type" content="${type}" />
        <meta property="og:url" content="https://moodify-music.com${path}" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:image" content="${image}" />
        <meta property="og:site_name" content="Moodify" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}" />
        <meta name="twitter:image" content="${image}" />
      </head>
      <body>
        <h1>${title}</h1>
        <p>${description}</p>
        <img src="${image}" alt="Cover image" />
      </body>
      </html>
    `;

    return res.send(html);
  } catch (error) {
    console.error("OG Tag Generation Error:", error);
    res
      .status(500)
      .send("<html><head><title>Moodify</title></head><body></body></html>");
  }
};
