import { User } from "../models/user.model.js";
import { verifyAccessToken } from "../lib/jwt.js";

export const identifyUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return next();
    }

    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.sub).lean();

      if (user) {
        req.user = {
          id: user._id,
          email: user.email,
        };
      }
    } catch (error) {
      console.log(
        "IdentifyUser Middleware: Could not verify token, proceeding as guest.",
        error.message
      );
    }
  } catch (error) {
    console.log("IdentifyUser Middleware error:", error.message);
  }

  next();
};
