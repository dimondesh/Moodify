// frontend/src/Providers/AuthProvider.tsx - Оптимизированная версия

import React, { useEffect, useState, useRef } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuthStore } from "../stores/useAuthStore";
import { useChatStore } from "../stores/useChatStore";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import StandardLoader from "../components/ui/StandardLoader";

interface AuthProviderProps {
  children: ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [firebaseChecked, setFirebaseChecked] = useState(false);
  const { t, i18n } = useTranslation();

  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const setUser = useAuthStore((state) => state.setUser);
  const fetchUser = useAuthStore((state) => state.fetchUser);
  const logout = useAuthStore((state) => state.logout);

  const initSocket = useChatStore((state) => state.initSocket);
  const disconnectSocket = useChatStore((state) => state.disconnectSocket);
  const isConnected = useChatStore((state) => state.isConnected);
  const chatError = useChatStore((state) => state.error);

  const socketInitializedRef = useRef(false);
  const authCheckInProgressRef = useRef(false);

  // Обновление языка пользователя
  useEffect(() => {
    if (user?.language && user.language !== i18n.language) {
      i18n.changeLanguage(user.language);
    }
  }, [user?.language, i18n]);

  // Firebase auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Предотвращаем множественные одновременные проверки
      if (authCheckInProgressRef.current) {
        console.log("AuthProvider: Auth check already in progress, skipping");
        return;
      }

      authCheckInProgressRef.current = true;

      try {
        if (firebaseUser) {
          const isEmailPasswordProvider = firebaseUser.providerData.some(
            (p) => p.providerId === "password"
          );

          if (isEmailPasswordProvider && !firebaseUser.emailVerified) {
            toast.error(t("auth.verifyEmailPrompt"), { duration: 5000 });
            logout();
            setFirebaseChecked(true);
            authCheckInProgressRef.current = false;
            return;
          }

          const authState = useAuthStore.getState();
          const needsSync =
            !authState.user ||
            authState.user.firebaseUid !== firebaseUser.uid ||
            authState.user.isAdmin === undefined;

          if (needsSync && !authState.isLoading) {
            try {
              console.log("AuthProvider: Syncing user data from backend");
              await fetchUser(firebaseUser.uid);
            } catch (error) {
              console.error(
                "AuthProvider: Sync error. User remains logged in with Firebase, but backend data might be stale.",
                error
              );
            }
          } else {
            console.log(
              "AuthProvider: User data is already fresh, skipping sync"
            );
          }
        } else {
          // User logged out
          if (navigator.onLine && useAuthStore.getState().user) {
            console.log(
              "AuthProvider: Online and no Firebase user. Clearing state."
            );
            setUser(null);
            socketInitializedRef.current = false;
            disconnectSocket();
          } else {
            console.log(
              "AuthProvider: Offline or no user in state. Preserving offline session."
            );
          }
        }
      } finally {
        setFirebaseChecked(true);
        authCheckInProgressRef.current = false;
      }
    });

    return () => unsubscribe();
  }, [setUser, fetchUser, logout, disconnectSocket, t]);

  // Socket initialization
  useEffect(() => {
    if (!firebaseChecked) return;

    if (user && user.id && !socketInitializedRef.current && !isConnected) {
      console.log(
        "AuthProvider: Initializing Socket.IO with User ID:",
        user.id
      );

      // Задержка инициализации сокета для оптимизации начальной загрузки
      const timeoutId = setTimeout(() => {
        initSocket(user.id);
        socketInitializedRef.current = true;
      }, 2000); // 2 секунды задержки

      return () => clearTimeout(timeoutId);
    } else if (user === null && isConnected) {
      console.log("AuthProvider: User logged out, disconnecting socket");
      disconnectSocket();
      socketInitializedRef.current = false;
    }
  }, [user, initSocket, disconnectSocket, isConnected, firebaseChecked]);

  // Chat error handling
  useEffect(() => {
    if (chatError) {
      if (
        chatError.includes("io client disconnect") ||
        chatError.includes("transport close")
      ) {
        console.info(
          "AuthProvider: Socket intentionally disconnected or closed"
        );
      } else {
        console.error("AuthProvider Chat Socket Error:", chatError);
      }
    }
  }, [chatError]);

  // Показываем loader только при первой загрузке
  if (!firebaseChecked || (isLoading && !user)) {
    return (
      <div className="h-screen w-full bg-[#0f0f0f] flex items-center justify-center">
        <StandardLoader size="lg" text={t("auth.loggingIn")} showText={true} />
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthProvider;
