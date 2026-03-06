// src/controller/og.controller.js
import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Mix } from "../models/mix.model.js";

export const generateOGMeta = async (req, res, next) => {
  const userAgent = req.headers["user-agent"] || "";
  // Проверяем, кто делает запрос: реальный браузер или бот-парсер
  const isBot =
    /bot|facebook|telegram|twitter|discord|whatsapp|viber|skype|vkShare/i.test(
      userAgent,
    );

  if (!isBot) {
    // Если это человек, просто пропускаем запрос дальше
    return next();
  }

  try {
    const { id } = req.params;
    const path = req.path;

    // Дефолтные значения (fallback)
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
    } else if (path.startsWith("/mixes/")) {
      type = "music.playlist";
      const mix = await Mix.findById(id);
      if (mix) {
        title = `${mix.title} | Moodify Mix`;
        description = `Listen to ${mix.title} on Moodify.`;
        image = mix.imageUrl || image;
      }
    }

    // Собираем HTML только с метатегами для бота
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
    next(); // Если произошла ошибка, не ломаем приложение, а просто идем дальше
  }
};
