import type { UserActivity } from "../stores/useChatStore";
import type { User } from "../types";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function hasRecentOfflineActivity(user: User): boolean {
  if (!user.lastActivity || !user.lastActivityAt) return false;
  const age = Date.now() - new Date(user.lastActivityAt).getTime();
  return age <= SEVEN_DAYS_MS;
}

export function getEffectiveActivity(
  userId: string,
  user: User,
  onlineUsers: Set<string>,
  userActivities: Map<string, UserActivity | "Idle">,
): UserActivity | "Idle" | null {
  if (onlineUsers.has(userId)) {
    return userActivities.get(userId) ?? "Idle";
  }

  if (hasRecentOfflineActivity(user)) {
    return user.lastActivity ?? null;
  }

  return null;
}

export function shouldShowInFriendsActivity(
  user: User,
  authUserId: string,
  onlineUsers: Set<string>,
): boolean {
  if (user._id === authUserId) return false;
  if (onlineUsers.has(user._id)) return true;
  return hasRecentOfflineActivity(user);
}

export function getFriendsActivitySortTime(
  user: User,
  onlineUsers: Set<string>,
): number {
  if (onlineUsers.has(user._id)) return Date.now();
  if (user.lastActivityAt) return new Date(user.lastActivityAt).getTime();
  return 0;
}
