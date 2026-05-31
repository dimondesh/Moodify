import { getHomeBootstrapData } from "../lib/home/homeOrchestrator.service.js";
import { getHomeFeedStatus } from "../lib/home/homeFeedQueue.service.js";

export const getBootstrapData = async (req, res, next) => {
  try {
    const data = await getHomeBootstrapData(req.user?.id, { res });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getFeedStatus = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const data = await getHomeFeedStatus(userId);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};
