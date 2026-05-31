import { getHomeBootstrapData } from "../lib/home/homeOrchestrator.service.js";

export const getBootstrapData = async (req, res, next) => {
  try {
    const data = await getHomeBootstrapData(req.user?.id);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};
