import { getGuestHomeData } from "./homeGuest.service.js";
import { getPersonalizedHomeData } from "./homePersonalized.service.js";

export const getHomeBootstrapData = async (userId, options = {}) => {
  if (userId) {
    return getPersonalizedHomeData(userId, options);
  }
  return getGuestHomeData();
};
