// src/App.tsx - Оптимизированная версия

import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useAuthStore } from "./stores/useAuthStore";
import { useOfflineStore } from "./stores/useOfflineStore";
import { Helmet } from "react-helmet-async";
import { useUIStore } from "./stores/useUIStore";
import ErrorBoundary from "./components/ErrorBoundary";
import StandardLoader from "./components/ui/StandardLoader";

// Eager load критичные компоненты
import HomePage from "./pages/HomePage/HomePage";
import MainLayout from "./layout/MainLayout";
import AuthPage from "./pages/AuthPage/AuthPage";

// Lazy load остальные страницы
const AlbumPage = lazy(() => import("./pages/AlbumPage/AlbumPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage/NotFoundPage"));
const AllSongsPage = lazy(() => import("./pages/AllSongs/AllSongsPage"));
const PlaylistDetailsPage = lazy(
  () => import("./pages/PlaylistPage/PlaylistDetailsPage")
);
const ArtistPage = lazy(() => import("./pages/ArtistPage/ArtistPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage/ProfilePage"));
const DisplayListPage = lazy(
  () => import("./pages/DisplayListPage/DisplayListPage")
);
const MixDetailsPage = lazy(
  () => import("./pages/MixDetailsPage/MixDetailsPage")
);
const PersonalMixPage = lazy(
  () => import("./pages/PersonalMixPage/PersonalMixPage")
);
const AllMixesPage = lazy(() => import("./pages/AllMixesPage/AllMixesPage"));
const GeneratedPlaylistPage = lazy(
  () => import("./pages/GeneratedPlaylistPage/GeneratedPlaylistPage")
);
const TopTracksPage = lazy(() => import("./pages/TopTracksPage/TopTracksPage"));
const OfflinePage = lazy(() => import("./pages/OfflinePage/OfflinePage"));
const LibraryPage = lazy(() => import("./pages/LibraryPage/LibraryPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage/SettingsPage"));
const SearchPage = lazy(() => import("./pages/SearchPage/SearchPage"));
const LikedSongs = lazy(() => import("./pages/LikedSongs/LikedSongs"));
const ChatPage = lazy(() => import("./pages/ChatPage/ChatPage"));

const LoadingFallback = () => (
  <div className="h-screen w-full bg-[#0f0f0f] flex items-center justify-center">
    <StandardLoader size="lg" showText={false} />
  </div>
);

function App() {
  const user = useAuthStore((state) => state.user);
  const isOffline = useOfflineStore((state) => state.isOffline);
  const location = useLocation();
  const navigate = useNavigate();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialDataFetchedRef = useRef(false);

  const { fetchInitialData, setIsIosDevice } = useUIStore();
  const canonicalUrl = `https://moodify-music.vercel.app${location.pathname}`;

  // Определяем iOS один раз при загрузке
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIosDevice(isIOS);
  }, [setIsIosDevice]);

  // Единственный вызов fetchInitialData с debounce
  useEffect(() => {
    if (initialDataFetchedRef.current || !navigator.onLine) return;

    const shouldFetch = user || !useAuthStore.getState().user;

    if (shouldFetch) {
      console.log("App.tsx: Fetching initial data (once)");
      initialDataFetchedRef.current = true;

      // Небольшая задержка для предотвращения race conditions
      const timeoutId = setTimeout(() => {
        fetchInitialData();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [user, fetchInitialData]);

  const fetchDataForUser = useCallback(() => {
    if (navigator.onLine && !initialDataFetchedRef.current) {
      console.log("fetchDataForUser: Fetching initial data");
      fetchInitialData();
      initialDataFetchedRef.current = true;

      const { syncLibrary } = useOfflineStore.getState().actions;
      console.log("User is online, syncing library.");
      syncLibrary();
    }
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
    const prefixSafePaths = [
      "/albums/",
      "/playlists/",
      "/mixes/",
      "/personal-mixes/",
      "/generated-playlists/",
    ];

    const isExactSafe = exactSafePaths.includes(location.pathname);
    const isPrefixSafe = prefixSafePaths.some((path) =>
      location.pathname.startsWith(path)
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
          content="Moodify is an advanced music streaming service for enthusiasts. Create complex mixes, use AI-generated playlists, and connect with friends in a rich audio environment."
        />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="sitemap.xml" element={"sitemap.xml"} />
            <Route path="login" element={<AuthPage />} />
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
                path="/playlists/:playlistId"
                element={<PlaylistDetailsPage />}
              />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/artists/:id" element={<ArtistPage />} />
              <Route path="/users/:userId" element={<ProfilePage />} />
              <Route path="/list" element={<DisplayListPage />} />
              <Route path="/mixes/:mixId" element={<MixDetailsPage />} />
              <Route path="/personal-mixes/:id" element={<PersonalMixPage />} />
              <Route path="/all-mixes/:category" element={<AllMixesPage />} />
              <Route path="/offline" element={<OfflinePage />} />
              <Route
                path="/generated-playlists/:id"
                element={<GeneratedPlaylistPage />}
              />
              <Route
                path="/users/:userId/top-tracks"
                element={<TopTracksPage />}
              />

              
            </Route>
          </Routes>
        </Suspense>
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
