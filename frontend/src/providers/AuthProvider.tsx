import React, { useEffect, useState, useRef } from "react";
import type { ReactNode } from "react";
import { useAuthStore } from "../stores/useAuthStore";
import { useChatStore } from "../stores/useChatStore";
import { useTranslation } from "react-i18next";
import InitOnlyLoader from "../components/ui/InitOnlyLoader";

interface AuthProviderProps {
  children: ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authReady, setAuthReady] = useState(false);
  const { i18n } = useTranslation();

  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const accessToken = useAuthStore((state) => state.accessToken);
  const bootstrapAuth = useAuthStore((state) => state.bootstrapAuth);

  const initSocket = useChatStore((state) => state.initSocket);
  const disconnectSocket = useChatStore((state) => state.disconnectSocket);
  const isConnected = useChatStore((state) => state.isConnected);
  const chatError = useChatStore((state) => state.error);

  const socketInitializedRef = useRef(false);

  useEffect(() => {
    if (user?.language && user.language !== i18n.language) {
      i18n.changeLanguage(user.language);
    }
  }, [user?.language, i18n]);

  useEffect(() => {
    const finish = () => setAuthReady(true);
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      void useAuthStore.getState().bootstrapAuth().finally(finish);
    });
    if (useAuthStore.persist.hasHydrated()) {
      void useAuthStore.getState().bootstrapAuth().finally(finish);
    }
    return unsub;
  }, [bootstrapAuth]);

  useEffect(() => {
    if (!authReady) return;

    if (user && user.id && !socketInitializedRef.current && !isConnected) {
      const timeoutId = setTimeout(() => {
        void initSocket(user.id);
        socketInitializedRef.current = true;
      }, 2000);

      return () => clearTimeout(timeoutId);
    } else if (user === null && isConnected) {
      disconnectSocket();
      socketInitializedRef.current = false;
    }
  }, [user, initSocket, disconnectSocket, isConnected, authReady]);

  useEffect(() => {
    if (chatError) {
      if (
        chatError.includes("io client disconnect") ||
        chatError.includes("transport close")
      ) {
        console.info(
          "AuthProvider: Socket intentionally disconnected or closed",
        );
      } else {
        console.error("AuthProvider Chat Socket Error:", chatError);
      }
    }
  }, [chatError]);

  if (!authReady || (isLoading && accessToken && !user)) {
    return <InitOnlyLoader />;
  }

  return <>{children}</>;
};

export default AuthProvider;
