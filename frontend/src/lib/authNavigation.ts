import type { AuthUser } from "@/stores/useAuthStore";

export function getPostAuthPath(
  user: Pick<AuthUser, "requiresOnboarding"> | null,
): string {
  if (user?.requiresOnboarding) return "/onboarding";
  return "/";
}
