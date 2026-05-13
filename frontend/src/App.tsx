import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "./stores/useAuthStore";
import { useOfflineStore } from "./stores/useOfflineStore";
import { Helmet } from "react-helmet-async";
import { useUIStore } from "./stores/useUIStore";
import ErrorBoundary from "./components/ErrorBoundary";

import HomePage from "./pages/HomePage/HomePage";
import MainLayout from "./layout/MainLayout";
import AuthPage from "./pages/AuthPage/AuthPage";
import TrackRedirect from "./pages/TrackRedirect";
import AlbumPage from "./pages/AlbumPage/AlbumPage";
import NotFoundPage from "./pages/NotFoundPage/NotFoundPage";
import AllSongsPage from "./pages/AllSongs/AllSongsPage";
import PlaylistDetailsPage from "./pages/PlaylistDetailsPage/PlaylistDetailsPage";
import ArtistPage from "./pages/ArtistPage/ArtistPage";
import ProfilePage from "./pages/ProfilePage/ProfilePage";
import DisplayListPage from "./pages/DisplayListPage/DisplayListPage";
import PlaylistBrowsePage from "./pages/PlaylistBrowsePage/PlaylistBrowsePage";
import TopTracksPage from "./pages/TopTracksPage/TopTracksPage";
import OfflinePage from "./pages/OfflinePage/OfflinePage";
import LibraryPage from "./pages/LibraryPage/LibraryPage";
import SettingsPage from "./pages/SettingsPage/SettingsPage";
import SearchPage from "./pages/SearchPage/SearchPage";
import LikedSongs from "./pages/LikedSongs/LikedSongs";
import ChatPage from "./pages/ChatPage/ChatPage";

function App() {
  const user = useAuthStore((state) => state.user);
  const userId = user?.id;
  const isOffline = useOfflineStore((state) => state.isOffline);
  const location = useLocation();
  const navigate = useNavigate();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  /** Bootstrap/home data is auth-specific; refetch when guest ↔ logged-in (or user id) changes. */
  const lastBootstrapAuthKeyRef = useRef<string | null>(null);

  const { fetchInitialData, setIsIosDevice } = useUIStore();
  const canonicalUrl = `https://moodify-music.com${location.pathname}`;

  // Определяем iOS один раз при загрузке
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIosDevice(isIOS);
  }, [setIsIosDevice]);

  useEffect(() => {
    if (!navigator.onLine) return;

    const authKey = userId ?? "__guest__";
    if (lastBootstrapAuthKeyRef.current === authKey) return;

    lastBootstrapAuthKeyRef.current = authKey;
    console.log("App.tsx: Fetching initial data for session", authKey);

    const timeoutId = setTimeout(() => {
      void fetchInitialData();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [userId, fetchInitialData]);

  const fetchDataForUser = useCallback(() => {
    if (!navigator.onLine) return;

    console.log("fetchDataForUser: Fetching initial data");
    void fetchInitialData();

    const { syncLibrary } = useOfflineStore.getState().actions;
    console.log("User is online, syncing library.");
    syncLibrary();
  }, [fetchInitialData]);

  // Инициализация offline store
  useEffect(() => {
    const { init: initOffline, checkOnlineStatus } =
      useOfflineStore.getState().actions;

    const handleNetworkChange = () => {
      const isNowOnline = navigator.onLine;
      checkOnlineStatus();

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (isNowOnline && useAuthStore.getState().user) {
        console.log("App is back online. Scheduling data sync in 3 seconds...");
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("Executing delayed data sync after reconnecting.");
          fetchDataForUser();
        }, 3000);
      }
    };

    // Инициализируем offline store асинхронно
    initOffline();

    window.addEventListener("online", handleNetworkChange);
    window.addEventListener("offline", handleNetworkChange);

    return () => {
      window.removeEventListener("online", handleNetworkChange);
      window.removeEventListener("offline", handleNetworkChange);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [fetchDataForUser]);

  // Редирект на offline страницу
  useEffect(() => {
    const exactSafePaths = [
      "/library",
      "/settings",
      "/liked-songs",
      "/offline",
    ];
    const prefixSafePaths = ["/albums/", "/playlists/"];

    const isExactSafe = exactSafePaths.includes(location.pathname);
    const isPrefixSafe = prefixSafePaths.some((path) =>
      location.pathname.startsWith(path),
    );
    const isSafe = isExactSafe || isPrefixSafe;

    if (isOffline && !isSafe) {
      navigate("/offline", { replace: true });
    }
  }, [isOffline, location.pathname, navigate]);

  return (
    <>
      <Helmet
        defaultTitle="Moodify - Discover Your Music"
        titleTemplate="%s | Moodify"
      >
        <meta
          name="description"
          content="Moodify is an advanced music streaming service for enthusiasts. Build playlists, discover music with smart playlists, and connect with friends in a rich audio environment."
        />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>
      <ErrorBoundary>
        <Routes>
          <Route path="sitemap.xml" element={"sitemap.xml"} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />{" "}
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/all-songs/:category?" element={<AllSongsPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/albums/:albumId" element={<AlbumPage />} />
            <Route path="*" element={<NotFoundPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/liked-songs" element={<LikedSongs />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route
              path="/playlists/browse/:category"
              element={<PlaylistBrowsePage />}
            />
            <Route
              path="/playlists/:playlistId"
              element={<PlaylistDetailsPage />}
            />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/artists/:id" element={<ArtistPage />} />
            <Route path="/users/:userId" element={<ProfilePage />} />
            <Route path="/list" element={<DisplayListPage />} />
            <Route path="/offline" element={<OfflinePage />} />
            <Route path="/track/:id" element={<TrackRedirect />} />
            <Route
              path="/users/:userId/top-tracks"
              element={<TopTracksPage />}
            />
          </Route>
        </Routes>
      </ErrorBoundary>
      <Toaster
        toastOptions={{
          iconTheme: {
            primary: "#805ad5",
            secondary: "black",
          },
          blank: {
            style: {
              background: "#27272a",
              borderRadius: "20px",
              color: "#BAC4C8",
            },
          },
          success: {
            style: {
              background: "#27272a",
              borderRadius: "20px",
              color: "#BAC4C8",
            },
          },
          error: {
            style: {
              background: "#27272a",
              borderRadius: "20px",
              color: "#BAC4C8",
            },
          },
          loading: {
            style: {
              background: "#27272a",
              borderRadius: "20px",
              color: "#BAC4C8",
            },
          },
        }}
      />
    </>
  );
}

export default App;
