import bcrypt from "bcrypt";
import { Resend } from "resend";
import { User } from "../models/user.model.js";
import {
  signAccessToken,
  signPasswordResetToken,
  verifyPasswordResetToken,
} from "../lib/jwt.js";
import {
  extractCoverAccentHexFromUrl,
  isSkippableCoverImageUrl,
} from "../lib/coverAccent.service.js";

const BCRYPT_ROUNDS = 12;
const CODE_EXPIRY_MS = 15 * 60 * 1000;
const RESET_CODE_EXPIRY_MS = 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function resendCooldownSecondsRemaining(lastSentAt) {
  if (!lastSentAt) return null;
  const elapsed = Date.now() - new Date(lastSentAt).getTime();
  if (elapsed < RESEND_COOLDOWN_MS) {
    return Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
  }
  return null;
}

const resendClient = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function isStrongPassword(password) {
  if (!password || password.length < 8) return false;
  if (!/[A-ZА-ЯЁІЇЄ]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

function generateSixDigitCode() {
  const n = Math.floor(Math.random() * 1_000_000);
  return String(n).padStart(6, "0");
}

async function sendTransactionalEmail({ to, subject, html }) {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    console.warn("EMAIL_FROM is not set; skipping email send.");
    return;
  }
  if (!resendClient) {
    console.warn("RESEND_API_KEY is not set; email not sent (dev?).");
    return;
  }
  await resendClient.emails.send({ from, to, subject, html });
}

function adminFromEmail(email) {
  const list = process.env.ADMIN_EMAILS?.split(",").map((s) => s.trim().toLowerCase()) || [];
  return list.includes((email || "").toLowerCase());
}

function buildAuthPayload(user) {
  const isAdmin = adminFromEmail(user.email);
  const token = signAccessToken(user._id, user.email);
  return {
    token,
    user: {
      _id: user._id,
      email: user.email,
      fullName: user.fullName,
      imageUrl: user.imageUrl,
      coverAccentHex: user.coverAccentHex ?? null,
      language: user.language,
      isAnonymous: user.isAnonymous,
      showRecentlyListenedArtists: user.showRecentlyListenedArtists,
      isAdmin,
    },
  };
}

async function applyCoverAccentHexFromProfilePhoto(userDoc) {
  const url = userDoc.imageUrl;
  if (!url || isSkippableCoverImageUrl(url)) {
    userDoc.coverAccentHex = null;
    return;
  }
  try {
    userDoc.coverAccentHex = await extractCoverAccentHexFromUrl(url);
  } catch {
    userDoc.coverAccentHex = null;
  }
}

async function sendVerificationEmailToUser(user, normalizedEmail, code) {
  const html = `
      <p>Your Moodify verification code:</p>
      <p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>
      <p>This code expires in 15 minutes.</p>
    `;
  await sendTransactionalEmail({
    to: normalizedEmail,
    subject: "Your Moodify verification code",
    html,
  });
  user.emailVerificationLastSentAt = new Date();
  await user.save();

  if (!resendClient || !process.env.EMAIL_FROM) {
    console.log(`[dev] Verification code for ${normalizedEmail}: ${code}`);
  }
}

export const register = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized || !password || !fullName?.trim()) {
      return res.status(400).json({ error: "Email, password, and name are required" });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: "Password does not meet requirements" });
    }

    const existing = await User.findOne({ email: normalized });
    if (existing) {
      if (existing.emailVerified) {
        return res.status(409).json({ error: "Email already registered" });
      }
      if (!existing.passwordHash) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const waitSec = resendCooldownSecondsRemaining(existing.emailVerificationLastSentAt);
      if (waitSec !== null) {
        return res.status(429).json({
          code: "RATE_LIMIT",
          retryAfterSeconds: waitSec,
          error: "Please wait before requesting another email",
        });
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const code = generateSixDigitCode();
      existing.passwordHash = passwordHash;
      existing.fullName = fullName.trim();
      existing.emailVerificationCodeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
      existing.emailVerificationCodeExpires = new Date(Date.now() + CODE_EXPIRY_MS);

      try {
        await sendVerificationEmailToUser(existing, normalized, code);
      } catch (mailErr) {
        console.error("Resend error:", mailErr);
        return res.status(502).json({ error: "Could not send verification email" });
      }

      return res.status(201).json({ message: "Verification email sent" });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const code = generateSixDigitCode();
    const emailVerificationCodeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    const emailVerificationCodeExpires = new Date(Date.now() + CODE_EXPIRY_MS);

    const user = await User.create({
      email: normalized,
      passwordHash,
      fullName: fullName.trim(),
      emailVerified: false,
      emailVerificationCodeHash,
      emailVerificationCodeExpires,
      language: "en",
      isAnonymous: false,
    });

    try {
      await sendVerificationEmailToUser(user, normalized, code);
    } catch (mailErr) {
      console.error("Resend error:", mailErr);
      await User.deleteOne({ _id: user._id });
      return res.status(502).json({ error: "Could not send verification email" });
    }

    res.status(201).json({ message: "Verification email sent" });
  } catch (error) {
    console.error("register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized || !code) {
      return res.status(400).json({ error: "Email and code are required" });
    }

    const user = await User.findOne({ email: normalized });
    if (!user || !user.emailVerificationCodeHash) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }
    if (!user.emailVerificationCodeExpires || user.emailVerificationCodeExpires < new Date()) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    const match = await bcrypt.compare(String(code).trim(), user.emailVerificationCodeHash);
    if (!match) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    user.emailVerified = true;
    user.emailVerificationCodeHash = null;
    user.emailVerificationCodeExpires = null;
    await user.save();

    res.status(200).json(buildAuthPayload(user));
  } catch (error) {
    console.error("verifyEmail error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email: normalized });
    if (!user) {
      return res.status(200).json({ message: "If the account exists, a code was sent" });
    }
    if (user.emailVerified || !user.passwordHash) {
      return res.status(200).json({ message: "If the account exists, a code was sent" });
    }

    const waitSec = resendCooldownSecondsRemaining(user.emailVerificationLastSentAt);
    if (waitSec !== null) {
      return res.status(429).json({
        code: "RATE_LIMIT",
        retryAfterSeconds: waitSec,
        error: "Please wait before requesting another email",
      });
    }

    const code = generateSixDigitCode();
    user.emailVerificationCodeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    user.emailVerificationCodeExpires = new Date(Date.now() + CODE_EXPIRY_MS);

    try {
      await sendVerificationEmailToUser(user, normalized, code);
    } catch (mailErr) {
      console.error("Resend error:", mailErr);
      return res.status(502).json({ error: "Could not send email" });
    }

    res.status(200).json({ message: "Verification code sent" });
  } catch (error) {
    console.error("resendVerification error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: normalized });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        error: "Please verify your email before logging in",
      });
    }

    res.status(200).json(buildAuthPayload(user));
  } catch (error) {
    console.error("login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const googleAuth = async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken || typeof accessToken !== "string") {
      return res.status(400).json({ error: "Google access token is required" });
    }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) {
      return res.status(401).json({ error: "Invalid Google token" });
    }

    const payload = await profileRes.json();
    const googleId = payload.sub;
    const email = (payload.email || "").toLowerCase();
    if (!googleId || !email) {
      return res.status(400).json({ error: "Invalid Google profile" });
    }
    if (payload.email_verified !== true) {
      return res.status(400).json({ error: "Google email is not verified" });
    }

    let user = await User.findOne({ googleId });
    if (!user) {
      const byEmail = await User.findOne({ email });
      if (byEmail) {
        if (byEmail.passwordHash && !byEmail.googleId) {
          return res.status(409).json({
            code: "ACCOUNT_EXISTS_PASSWORD",
            error: "An account with this email already exists. Sign in with email and password.",
          });
        }
        if (byEmail.googleId && byEmail.googleId !== googleId) {
          return res.status(409).json({ error: "Account conflict" });
        }
        byEmail.googleId = googleId;
        byEmail.emailVerified = true;
        if (payload.picture && !byEmail.imageUrl) {
          byEmail.imageUrl = payload.picture;
          await applyCoverAccentHexFromProfilePhoto(byEmail);
        }
        if (payload.name && !byEmail.fullName) {
          byEmail.fullName = payload.name;
        }
        await byEmail.save();
        user = byEmail;
      } else {
        user = await User.create({
          email,
          googleId,
          fullName: payload.name || email.split("@")[0],
          imageUrl: payload.picture || null,
          emailVerified: true,
          language: "en",
          isAnonymous: false,
        });
        if (user.imageUrl) {
          await applyCoverAccentHexFromProfilePhoto(user);
          await user.save();
        }
      }
    }

    res.status(200).json(buildAuthPayload(user));
  } catch (error) {
    console.error("googleAuth error:", error);
    const code = error?.code;
    if (code === 11000) {
      return res.status(500).json({
        error: "Database index conflict. Restart the server after Mongo migration.",
      });
    }
    res.status(500).json({ error: "Google authentication failed" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email: normalized });
    if (!user || !user.passwordHash) {
      return res.status(200).json({ ok: true });
    }

    const waitSec = resendCooldownSecondsRemaining(user.passwordResetLastSentAt);
    if (waitSec !== null) {
      return res.status(429).json({
        code: "RATE_LIMIT",
        retryAfterSeconds: waitSec,
        error: "Please wait before requesting another reset email",
      });
    }

    const code = generateSixDigitCode();
    user.passwordResetCodeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    user.passwordResetCodeExpires = new Date(Date.now() + RESET_CODE_EXPIRY_MS);
    user.passwordResetLastSentAt = new Date();
    await user.save();

    const html = `
      <p>Your Moodify password reset code:</p>
      <p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>
      <p>This code expires in 1 hour.</p>
    `;
    try {
      await sendTransactionalEmail({
        to: normalized,
        subject: "Your Moodify password reset code",
        html,
      });
    } catch (mailErr) {
      console.error("Resend error:", mailErr);
      return res.status(502).json({ error: "Could not send email" });
    }

    if (!resendClient || !process.env.EMAIL_FROM) {
      console.log(`[dev] Password reset code for ${normalized}: ${code}`);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("forgotPassword error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized || !code) {
      return res.status(400).json({ error: "Email and code are required" });
    }

    const user = await User.findOne({ email: normalized });
    if (!user?.passwordResetCodeHash || !user.passwordResetCodeExpires) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }
    if (user.passwordResetCodeExpires < new Date()) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    const match = await bcrypt.compare(String(code).trim(), user.passwordResetCodeHash);
    if (!match) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    user.passwordResetCodeHash = null;
    user.passwordResetCodeExpires = null;
    await user.save();

    const resetToken = signPasswordResetToken(user._id);
    res.status(200).json({ resetToken });
  } catch (error) {
    console.error("verifyResetCode error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: "Reset token and new password are required" });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ error: "Password does not meet requirements" });
    }

    let userId;
    try {
      userId = verifyPasswordResetToken(resetToken);
    } catch {
      return res.status(400).json({ error: "Invalid or expired reset session" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset session" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await user.save();

    res.status(200).json({ message: "Password updated" });
  } catch (error) {
    console.error("resetPassword error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMe = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json(buildAuthPayload(user));
  } catch (error) {
    console.error("getMe error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const checkEmailExists = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(200).json({
        exists: false,
        emailVerified: null,
        needsVerification: false,
      });
    }
    const needsVerification =
      !user.emailVerified && !!user.passwordHash;
    res.status(200).json({
      exists: true,
      emailVerified: user.emailVerified,
      needsVerification,
    });
  } catch (error) {
    console.error("checkEmailExists error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new passwords are required" });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ error: "Password does not meet requirements" });
    }

    const user = await User.findById(userId);
    if (!user?.passwordHash) {
      return res.status(400).json({ error: "Password login is not enabled for this account" });
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await user.save();
    res.status(200).json({ message: "Password updated" });
  } catch (error) {
    console.error("changePassword error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
