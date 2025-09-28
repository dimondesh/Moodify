import { useChatStore } from "../stores/useChatStore";
import { useAuthStore } from "../stores/useAuthStore";

export const useHasFriends = () => {
  const { users } = useChatStore();
  const { user: mongoUser } = useAuthStore();

  // Фильтруем пользователей, исключая текущего пользователя
  const friends = users.filter((u) => u._id !== mongoUser?.id);

  return {
    hasFriends: friends.length > 0,
    friendsCount: friends.length,
  };
};
