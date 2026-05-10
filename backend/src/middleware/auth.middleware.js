import { User } from "../models/user.model.js";
import { verifyAccessToken } from "../lib/jwt.js";
import dotenv from "dotenv";
dotenv.config();

const buildReqUser = (user) => {
  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map((s) => s.trim().toLowerCase()) || [];
  return {
    id: user._id,
    email: user.email,
    isAdmin: adminEmails.includes((user.email || "").toLowerCase()),
  };
};

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      console.error("No token provided");
      return res.status(401).json({ error: "Token required" });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const user = await User.findById(decoded.sub);
    if (!user) {
      console.error("User not found in DB for token sub:", decoded.sub);
      return res.status(404).json({ error: "User not found" });
    }

    req.user = buildReqUser(user);
    next();
  } catch (error) {
    console.error("Auth error:", error.message);
    res.status(401).json({ error: "Authentication failed", details: error.message });
  }
};

/** Sets req.user when a valid Bearer token is sent; otherwise continues as guest (no 401). */
export const attachUserIfPresent = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return next();
    }

    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.sub);
      if (user) {
        req.user = buildReqUser(user);
      }
    } catch {
      // invalid token — continue as guest
    }

    next();
  } catch {
    next();
  }
};
