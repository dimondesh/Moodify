import { Router } from "express";
import {
  checkEmailExists,
  register,
  verifyEmail,
  resendVerification,
  login,
  googleAuth,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  getMe,
  changePassword,
} from "../controller/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/check-email", checkEmailExists);
router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/login", login);
router.post("/google", googleAuth);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-code", verifyResetCode);
router.post("/reset-password", resetPassword);
router.get("/me", protectRoute, getMe);
router.post("/change-password", protectRoute, changePassword);

export default router;
