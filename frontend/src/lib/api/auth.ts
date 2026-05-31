import { axiosInstance } from "@/lib/axios";

export async function fetchAuthMe(token: string) {
  const response = await axiosInstance.get("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function loginWithPassword(email: string, password: string) {
  const response = await axiosInstance.post("/auth/login", {
    email: email.trim().toLowerCase(),
    password,
  });
  return response.data;
}

export async function registerAccount(
  email: string,
  password: string,
  fullName: string,
) {
  await axiosInstance.post("/auth/register", {
    email: email.trim().toLowerCase(),
    password,
    fullName: fullName.trim(),
  });
}

export async function verifyEmailCode(email: string, code: string) {
  const response = await axiosInstance.post("/auth/verify-email", {
    email: email.trim().toLowerCase(),
    code: String(code).trim(),
  });
  return response.data;
}

export async function resendVerificationEmail(email: string) {
  await axiosInstance.post("/auth/resend-verification", {
    email: email.trim().toLowerCase(),
  });
}

export async function completeGoogleAccessToken(accessToken: string) {
  const response = await axiosInstance.post("/auth/google", { accessToken });
  return response.data;
}

export async function checkAuthEmail(email: string) {
  const response = await axiosInstance.post("/auth/check-email", {
    email: email.trim().toLowerCase(),
  });
  return response.data;
}

export async function forgotPassword(email: string) {
  await axiosInstance.post("/auth/forgot-password", {
    email: email.trim().toLowerCase(),
  });
}

export async function verifyResetCode(email: string, code: string) {
  const response = await axiosInstance.post("/auth/verify-reset-code", {
    email: email.trim().toLowerCase(),
    code: String(code).trim(),
  });
  return response.data;
}

export async function resetPasswordWithToken(
  resetToken: string,
  newPassword: string,
) {
  await axiosInstance.post("/auth/reset-password", {
    resetToken,
    newPassword,
  });
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  token: string,
) {
  await axiosInstance.post(
    "/auth/change-password",
    { currentPassword, newPassword },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function deleteAccount(
  payload: { password?: string; confirmEmail?: string },
  token: string,
) {
  await axiosInstance.delete("/auth/account", {
    data: payload,
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateUserLanguage(language: string) {
  await axiosInstance.put("/users/language", { language });
}

export async function updateUserProfile(formData: FormData, token: string) {
  const response = await axiosInstance.put("/users/me", formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
}

export async function updateUserPrivacy(isAnonymous: boolean) {
  await axiosInstance.put("/users/privacy", { isAnonymous });
}

export async function updateRecentlyListenedArtistsPrivacy(
  showRecentlyListenedArtists: boolean,
) {
  await axiosInstance.put("/users/recently-listened-artists-privacy", {
    showRecentlyListenedArtists,
  });
}
