import { axiosInstance } from "@/lib/axios";
import { ONBOARDING_ARTISTS_PAGE_SIZE } from "@/constants/onboarding";

export type OnboardingArtist = {
  _id: string;
  name: string;
  images?: { size: number; url: string }[];
};

export type OnboardingArtistsPage = {
  artists: OnboardingArtist[];
  hasMore: boolean;
};

export async function fetchOnboardingArtistsPage(
  skip: number,
): Promise<OnboardingArtistsPage> {
  const res = await axiosInstance.get("/users/me/onboarding-artists", {
    params: { skip, limit: ONBOARDING_ARTISTS_PAGE_SIZE },
  });
  return res.data;
}

export async function submitTasteOnboarding(
  artistIds: string[],
): Promise<{ token: string; user: Record<string, unknown> }> {
  const res = await axiosInstance.post("/users/me/taste-onboarding", {
    artistIds,
  });
  return res.data;
}
