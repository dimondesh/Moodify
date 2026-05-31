import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "./stores/useAuthStore";
import { useOfflineStore } from "./stores/useOfflineStore";
import { Helmet } from "react-helmet-async";
import { useUIStore } from "./stores/useUIStore";
import { isIosDevice } from "./lib/platform";
import ErrorBoundary from "./components/ErrorBoundary";
import { SITE_NAME, SITE_SLOGAN, SITE_URL } from "./lib/site-meta";
import { prefetchHomeData } from "./lib/prefetchHome";
import { isHomeFeedGenerating } from "./lib/homeFeedGeneration";
import { isDesktopLibraryContext } from "./lib/libraryPlatform";

import HomePage from "./pages/HomePage/HomePage";
import MainLayout from "./layout/MainLayout";
import AuthPage from "./pages/AuthPage/AuthPage";
import TrackRedirect from "./pages/TrackRedirect/TrackRedirect";
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
import LibraryRoute from "./pages/LibraryPage/LibraryRoute";
import SettingsPage from "./pages/SettingsPage/SettingsPage";
import ChangePasswordPage from "./pages/ChangePasswordPage/ChangePasswordPage";
import SearchPage from "./pages/SearchPage/SearchPage";
import HubDetailsPage from "./pages/HubDetailsPage/HubDetailsPage";
import ChatPage from "./pages/ChatPage/ChatPage";
import OnboardingPage from "./pages/OnboardingPage/OnboardingPage";
import OnboardingRedirect from "./components/OnboardingRedirect";

function App() {
  const user = useAuthStore((state) => state.user);
  const userId = user?.id;
  const requiresOnboarding = user?.requiresOnboarding ?? false;
  const isOffline = useOfflineStore((state) => state.isOffline);
  const location = useLocation();
  const navigate = useNavigate();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  /** Bootstrap/home data is auth-specific; refetch when guest ↔ logged-in (or user id) changes. */
  const lastBootstrapAuthKeyRef = useRef<string | null>(null);

  const { setIsIosDevice } = useUIStore();
  const canonicalUrl =
    location.pathname === "/"
      ? SITE_URL
      : `https://moodify-music.com${location.pathname}`;

  useEffect(() => {
    setIsIosDevice(isIosDevice());
  }, [setIsIosDevice]);

  useEffect(() => {
    if (!navigator.onLine) return;
    if (requiresOnboarding) return;
    if (isHomeFeedGenerating()) return;

    const authKey = userId ?? "__guest__";
    if (lastBootstrapAuthKeyRef.current === authKey) return;

    lastBootstrapAuthKeyRef.current = authKey;
    console.log("App.tsx: Fetching initial data for session", authKey);

    const timeoutId = setTimeout(() => {
      void prefetchHomeData(authKey);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [userId, requiresOnboarding]);

  const fetchDataForUser = useCallback(() => {
    if (!navigator.onLine) return;
    if (useAuthStore.getState().user?.requiresOnboarding) return;
    if (isHomeFeedGenerating()) return;

    console.log("fetchDataForUser: Fetching initial data");
    const authKey = useAuthStore.getState().user?.id ?? "__guest__";
    void prefetchHomeData(authKey);

    const { syncLibrary } = useOfflineStore.getState().actions;
    console.log("User is online, syncing library.");
    syncLibrary();
  }, []);

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
    const exactSafePaths = ["/library", "/settings", "/settings/change-password", "/offline"];
    const prefixSafePaths = ["/albums/", "/playlists/"];

    const isExactSafe =
      exactSafePaths.includes(location.pathname) &&
      !(isDesktopLibraryContext() && location.pathname === "/library");
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
      <Helmet defaultTitle="Moodify Music" titleTemplate="%s · Moodify Music">
        <meta name="description" content={SITE_SLOGAN} />
        <meta property="og:site_name" content={SITE_NAME} />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>
      <ErrorBoundary>
        <OnboardingRedirect />
        <Routes>
          <Route path="sitemap.xml" element={"sitemap.xml"} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />{" "}
          <Route
            path="/settings/change-password"
            element={<ChangePasswordPage />}
          />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/all-songs/:category?" element={<AllSongsPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/albums/:albumId" element={<AlbumPage />} />
            <Route path="*" element={<NotFoundPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/hubs/:hubId" element={<HubDetailsPage />} />
            <Route path="/library" element={<LibraryRoute />} />
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
