import { needsTasteOnboarding } from "../lib/tasteProfile.service.js";

export const attachRequiresOnboarding = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      req.requiresOnboarding = false;
      return next();
    }
    req.requiresOnboarding = await needsTasteOnboarding(req.user.id);
    next();
  } catch (error) {
    next(error);
  }
};
