import { Artist } from "../models/artist.model.js";
import { Album } from "../models/album.model.js";

export const getSitemap = async (req, res) => {
  try {
    const artists = await Artist.find({}, "_id updatedAt"); // Берем ID и дату обновления
    const albums = await Album.find({}, "_id updatedAt");

    const baseUrl = "https://moodify-music.vercel.app"; // Твой домен

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url>
        <loc>${baseUrl}/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
      </url>`;

    // Добавляем артистов
    artists.forEach((artist) => {
      xml += `
      <url>
        <loc>${baseUrl}/artist/${artist._id}</loc>
        <lastmod>${new Date(artist.updatedAt).toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
      </url>`;
    });

    // Добавляем альбомы
    albums.forEach((album) => {
      xml += `
      <url>
        <loc>${baseUrl}/album/${album._id}</loc>
        <lastmod>${new Date(album.updatedAt).toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
      </url>`;
    });

    xml += `</urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (error) {
    console.error("Sitemap error:", error);
    res.status(500).end();
  }
};
