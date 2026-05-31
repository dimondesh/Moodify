import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { connectDB } from "./lib/db.js";
import userRoutes from "./routes/user.route.js";
import adminRoutes from "./routes/admin.route.js";
import authRoutes from "./routes/auth.route.js";
import songRoutes from "./routes/song.route.js";
import albumRoutes from "./routes/album.route.js";
import statsRoutes from "./routes/stat.route.js";
import searchRoutes from "./routes/search.route.js";
import playlistRoutes from "./routes/playlist.route.js";
import fileUpload from "express-fileupload";
import path from "path";
import cors from "cors";
import { initializeSocket, io } from "./lib/socket.js";
import libraryRoutes from "./routes/library.route.js";
import artistRoutes from "./routes/artist.route.js";
import cronRoutes from "./routes/cron.route.js";
import shareRoutes from "./routes/share.route.js";
import homeRoutes from "./routes/home.route.js";
import hubRoutes from "./routes/hub.route.js";
import { getSitemap } from "./controller/sitemap.controller.js";
import ogRoutes from "./routes/og.route.js";
import redisClient, { connectRedis } from "./lib/redis.js";
import { flushAllActivities } from "./lib/activityPersistence.service.js";

const PORT = process.env.PORT || 5000;

const app = express();

const __dirname = path.resolve();

const httpServer = createServer(app);
const { userSockets, userActivities } = initializeSocket(httpServer);

const allowedOrigins = [
  process.env.CLIENT_ORIGIN_URL,
  process.env.ADMIN_ORIGIN_URL,
];

console.log(
  `CORS middleware configured for origins: ${allowedOrigins.join(", ")}`,
);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn(`CORS: Blocked origin -> ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: path.join(__dirname, "temp"),
    createParentPath: true,
    limits: { fileSize: 800 * 1024 * 1024 },
  }),
);

app.use((req, res, next) => {
  req.io = io;
  req.userSockets = userSockets;
  req.userActivities = userActivities;
  next();
});

const jsonParser = express.json();
app.get("/sitemap.xml", getSitemap);
app.use(jsonParser);

app.use("/api/users", userRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/songs", songRoutes);
app.use("/api/albums", albumRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/artists", artistRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/hubs", hubRoutes);

app.use("/api/cron", cronRoutes);
app.use("/api/share", shareRoutes);
app.use("/", ogRoutes);

app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR HANDLER CAUGHT AN ERROR:");
  console.error(err);
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err.message,
  });
});

let isShuttingDown = false;

const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`${signal} received — flushing listening activities...`);

  try {
    await flushAllActivities(userActivities);
  } catch (err) {
    console.error("Failed to flush activities on shutdown:", err);
  }

  httpServer.close(async () => {
    if (redisClient.isOpen) {
      try {
        await redisClient.quit();
      } catch (err) {
        console.error("Redis quit error:", err);
      }
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

httpServer.listen(PORT, async () => {
  connectDB();
  await connectRedis();
  console.log(
    `Server on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`,
  );
});
