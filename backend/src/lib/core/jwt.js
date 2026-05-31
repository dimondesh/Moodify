import jwt from "jsonwebtoken";

/** Read at use time so .env is loaded even if this module imported before dotenv.config(). */
function getJwtSecret() {
  const s = process.env.JWT_SECRET?.trim();
  if (!s) throw new Error("JWT_SECRET is not configured");
  return s;
}

export function signAccessToken(userId, email) {
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(
    { sub: userId.toString(), email },
    secret,
    { expiresIn }
  );
}

export function verifyAccessToken(token) {
  const secret = getJwtSecret();
  const decoded = jwt.verify(token, secret);
  if (decoded.typ === "pwdreset") {
    const err = new Error("Invalid token type");
    err.name = "JsonWebTokenError";
    throw err;
  }
  return decoded;
}

const PWD_RESET_EXPIRES_IN = "15m";

export function signPasswordResetToken(userId) {
  const secret = getJwtSecret();
  return jwt.sign(
    { sub: userId.toString(), typ: "pwdreset" },
    secret,
    { expiresIn: PWD_RESET_EXPIRES_IN }
  );
}

export function verifyPasswordResetToken(token) {
  const secret = getJwtSecret();
  const decoded = jwt.verify(token, secret);
  if (decoded.typ !== "pwdreset" || !decoded.sub) {
    const err = new Error("Invalid reset token");
    err.name = "JsonWebTokenError";
    throw err;
  }
  return decoded.sub;
}
