import { Artist } from "../models/artist.model.js";
import { Album } from "../models/album.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Mix } from "../models/mix.model.js";
import { User } from "../models/user.model.js";

export const getSitemap = async (req, res) => {
  try {
    // 1. Параллельно забираем ВСЕ данные из базы
    // Берем только ID и дату обновления, чтобы не грузить базу
    const [artists, albums, playlists, mixes, users] = await Promise.all([
      Artist.find({}, "_id updatedAt"),
      Album.find({}, "_id updatedAt"),
      // Важно: Выводим только публичные плейлисты (если у тебя есть флаг isPublic)
      // Если флага нет, используй просто Playlist.find({}, "_id updatedAt")
      Playlist.find({ isPublic: true }, "_id updatedAt"),
      Mix.find({}, "_id updatedAt"),
      User.find({}, "_id updatedAt"),
    ]);

    const baseUrl = "https://moodify-music.vercel.app";

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      
      <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
      <url><loc>${baseUrl}/search</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
      <url><loc>${baseUrl}/login</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`;

    // 2. Генерация URL для Артистов (path: /artists/:id)
    artists.forEach((item) => {
      xml += `
      <url>
        <loc>${baseUrl}/artists/${item._id}</loc>
        <lastmod>${new Date(item.updatedAt || Date.now()).toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
      </url>`;
    });

    // 3. Генерация URL для Альбомов (path: /albums/:id)
    albums.forEach((item) => {
      xml += `
      <url>
        <loc>${baseUrl}/albums/${item._id}</loc>
        <lastmod>${new Date(item.updatedAt || Date.now()).toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
      </url>`;
    });

    // 4. Генерация URL для Плейлистов (path: /playlists/:id)
    playlists.forEach((item) => {
      xml += `
      <url>
        <loc>${baseUrl}/playlists/${item._id}</loc>
        <lastmod>${new Date(item.updatedAt || Date.now()).toISOString()}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
      </url>`;
    });

    // 5. Генерация URL для Миксов (path: /mixes/:id)
    mixes.forEach((item) => {
      xml += `
      <url>
        <loc>${baseUrl}/mixes/${item._id}</loc>
        <lastmod>${new Date(item.updatedAt || Date.now()).toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.6</priority>
      </url>`;
    });

    // 6. Генерация URL для Юзеров (path: /users/:id)
    users.forEach((item) => {
      xml += `
      <url>
        <loc>${baseUrl}/users/${item._id}</loc>
        <lastmod>${new Date(item.updatedAt || Date.now()).toISOString()}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.5</priority>
      </url>`;
    });

    xml += `</urlset>`;

    // Отдаем XML
    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (error) {
    console.error("Sitemap error:", error);
    res.status(500).send("Error generating sitemap");
  }
};
