import redisClient from "../lib/redis.js";

export const cacheRoute = (
  durationInSeconds = 3600,
  isUserSpecific = false,
) => {
  return async (req, res, next) => {
    if (req.method !== "GET") {
      return next();
    }

    let cacheKey = `cache:${req.originalUrl}`;

    if (isUserSpecific && req.user && req.user.id) {
      cacheKey = `cache:${req.user.id}:${req.originalUrl}`;
    }

    try {
      if (!redisClient.isOpen) {
        return next();
      }

      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        return res.status(200).json(JSON.parse(cachedData));
      }

      const originalJson = res.json.bind(res);
      res.json = (data) => {
        redisClient.setEx(cacheKey, durationInSeconds, JSON.stringify(data));
        originalJson(data);
      };

      next();
    } catch (error) {
      console.error("Redis Cache Error:", error);
      next();
    }
  };
};
