import { Artist } from "../models/artist.model.js";
import { Album } from "../models/album.model.js";
import { Playlist } from "../models/playlist.model.js";
import { User } from "../models/user.model.js";

export const getSitemap = async (req, res) => {
  try {
    const [artists, albums, playlists, users] = await Promise.all([
      Artist.find({}, "_id updatedAt"),
      Album.find({}, "_id updatedAt"),
      Playlist.find({ isPublic: true }, "_id updatedAt"),
      User.find({}, "_id updatedAt"),
    ]);

    // Берем URL из .env или используем твой новый домен напрямую
    const baseUrl =
      process.env.CLIENT_ORIGIN_URL || "https://moodify-music.com";

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      
      <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
      <url><loc>${baseUrl}/search</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
      <url><loc>${baseUrl}/login</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`;

    artists.forEach((item) => {
      xml += `
      <url>
        <loc>${baseUrl}/artists/${item._id}</loc>
        <lastmod>${new Date(item.updatedAt || Date.now()).toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
      </url>`;
    });

    albums.forEach((item) => {
      xml += `
      <url>
        <loc>${baseUrl}/albums/${item._id}</loc>
        <lastmod>${new Date(item.updatedAt || Date.now()).toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
      </url>`;
    });

    playlists.forEach((item) => {
      xml += `
      <url>
        <loc>${baseUrl}/playlists/${item._id}</loc>
        <lastmod>${new Date(item.updatedAt || Date.now()).toISOString()}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
      </url>`;
    });

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

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (error) {
    console.error("Sitemap error:", error);
    res.status(500).send("Error generating sitemap");
  }
};
