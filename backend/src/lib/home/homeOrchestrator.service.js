import { getGuestHomeData } from "./homeGuest.service.js";
import { getPersonalizedHomeData } from "./homePersonalized.service.js";

export const getHomeBootstrapData = async (userId) => {
  if (userId) {
    return getPersonalizedHomeData(userId);
  }
  return getGuestHomeData();
};
