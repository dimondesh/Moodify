// frontend/src/Providers/AuthProvider.tsx

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
  const { t } = useTranslation();

  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const setUser = useAuthStore((state) => state.setUser);
  const fetchUser = useAuthStore((state) => state.fetchUser);
  const logout = useAuthStore((state) => state.logout);

  const initSocket = useChatStore((state) => state.initSocket);
  const disconnectSocket = useChatStore((state) => state.disconnectSocket);
  const isConnected = useChatStore((state) => state.isConnected);
  const chatError = useChatStore((state) => state.error);

  const { i18n } = useTranslation();
  const socketInitializedRef = useRef(false);

  useEffect(() => {
    if (user?.language && user.language !== i18n.language) {
      i18n.changeLanguage(user.language);
    }
  }, [user, i18n]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log("AuthProvider: Firebase user detected:", firebaseUser.uid);

        const isEmailPasswordProvider = firebaseUser.providerData.some(
          (p) => p.providerId === "password"
        );
        if (isEmailPasswordProvider && !firebaseUser.emailVerified) {
          toast.error(t("auth.verifyEmailPrompt"), { duration: 5000 });
          logout();
          setFirebaseChecked(true);
          return;
        }

        const authState = useAuthStore.getState();
        const needsSync =
          !authState.user ||
          authState.user.firebaseUid !== firebaseUser.uid ||
          authState.user.isAdmin === undefined;

        if (needsSync && !authState.isLoading) {
          console.log("AuthProvider: Online, syncing user with backend...");
          try {
            await fetchUser(firebaseUser.uid);
          } catch (error) {
            console.error(
              "AuthProvider: Sync error. The user remains logged in with Firebase, but backend data might be stale. Error:",
              error
            );
          }
        } else {
          console.log("AuthProvider: User data is already fresh.");
        }
      } else {
        if (navigator.onLine && useAuthStore.getState().user) {
          console.log(
            "AuthProvider: Online and no Firebase user. Clearing state."
          );
          setUser(null);
          socketInitializedRef.current = false;
          disconnectSocket();
        } else {
          console.log(
            "AuthProvider: Offline or no user in state. No action needed to preserve offline session."
          );
        }
      }
      setFirebaseChecked(true);
    });

    return () => unsubscribe();
  }, [setUser, fetchUser, logout, disconnectSocket, t]); // --- fetchInitialData удален из зависимостей

  useEffect(() => {
    if (
      firebaseChecked &&
      user &&
      user.id &&
      !socketInitializedRef.current &&
      !isConnected
    ) {
      console.log(
        "AuthProvider: Initializing Socket.IO with MongoDB User ID:",
        user.id
      );
      initSocket(user.id);
      socketInitializedRef.current = true;
    } else if (firebaseChecked && !user && isConnected) {
      console.log(
        "AuthProvider: User logged out after Firebase check, disconnecting socket."
      );
      disconnectSocket();
      socketInitializedRef.current = false;
    }
  }, [user, initSocket, disconnectSocket, isConnected, firebaseChecked]);

  useEffect(() => {
    if (chatError) {
      if (
        chatError.includes("io client disconnect") ||
        chatError.includes("transport close")
      ) {
        console.info(
          "AuthProvider Chat Socket Info: Socket intentionally disconnected or closed."
        );
      } else {
        console.error("AuthProvider Chat Socket Error:", chatError);
      }
    }
  }, [chatError]);

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
