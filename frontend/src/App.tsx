// frontend/src/App.tsx

import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "./stores/useAuthStore";
import { useOfflineStore } from "./stores/useOfflineStore";
import { Helmet } from "react-helmet-async";
import { useUIStore } from "./stores/useUIStore";
import { useLibraryStore } from "./stores/useLibraryStore";
import { usePlaylistStore } from "./stores/usePlaylistStore";
import ErrorBoundary from "./components/ErrorBoundary";
import HomePage from "./pages/HomePage/HomePage";
import AlbumPage from "./pages/AlbumPage/AlbumPage";
import NotFoundPage from "./pages/NotFoundPage/NotFoundPage";
import AuthPage from "./pages/AuthPage/AuthPage";
import AllSongsPage from "./pages/AllSongs/AllSongsPage";
import PlaylistDetailsPage from "./pages/PlaylistPage/PlaylistDetailsPage";
import ArtistPage from "./pages/ArtistPage/ArtistPage";
import ProfilePage from "./pages/ProfilePage/ProfilePage";
import DisplayListPage from "./pages/DisplayListPage/DisplayListPage";
import MixDetailsPage from "./pages/MixDetailsPage/MixDetailsPage";
import AllMixesPage from "./pages/AllMixesPage/AllMixesPage";
import GeneratedPlaylistPage from "./pages/GeneratedPlaylistPage/GeneratedPlaylistPage";

import MainLayout from "./layout/MainLayout";
import OfflinePage from "./pages/OfflinePage/OfflinePage";
import LibraryPage from "./pages/LibraryPage/LibraryPage";
import SettingsPage from "./pages/SettingsPage/SettingsPage";
import SearchPage from "./pages/SearchPage/SearchPage";
import LikedSongs from "./pages/LikedSongs/LikedSongs";
import ChatPage from "./pages/ChatPage/ChatPage";


function App() {
  const user = useAuthStore((state) => state.user);
  const isOffline = useOfflineStore((state) => state.isOffline);
  const location = useLocation();
  const navigate = useNavigate();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { fetchInitialData } = useUIStore();
  const { fetchLibrary } = useLibraryStore();
  const { fetchMyPlaylists } = usePlaylistStore(); 
const canonicalUrl = `https://moodify-studio.vercel.app${location.pathname}`;

  useEffect(() => {
    if (user && navigator.onLine) {
      console.log("App.tsx: User detected, fetching initial app data.");
      fetchInitialData();
    }
  }, [user, fetchInitialData]);

  const fetchDataForUser = useCallback(() => {
    if (navigator.onLine) {
      console.log("fetchDataForUser called. Fetching all initial data...");
      fetchInitialData();

      const { syncLibrary } = useOfflineStore.getState().actions;
      console.log("User is online, syncing library.");
      syncLibrary();
    } else {
      console.log(
        "fetchDataForUser called, but user is offline. Skipping network requests."
      );
    }
  }, [fetchInitialData]);

  useEffect(() => {
    if (!useAuthStore.getState().user && navigator.onLine) {
      console.log("No user on initial load. Fetching public data.");
      fetchInitialData();
    }
  }, [fetchInitialData]);

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

  useEffect(() => {
    if (user && !navigator.onLine) {
      console.log(
        "App.tsx: User detected while offline. Triggering offline data load."
      );
      fetchLibrary();
      fetchMyPlaylists();
    }
  }, [user, fetchLibrary, fetchMyPlaylists]);

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
  defaultTitle="Moodify Studio - Your Music Creation Space"
  titleTemplate="%s | Moodify Studio"
>
  <meta
    name="description"
    content="Moodify Studio is an advanced music streaming service for enthusiasts. Create complex mixes, use AI-generated playlists, and connect with friends in a rich audio environment."
  />
  <link rel="canonical" href={canonicalUrl} />
</Helmet>

      <ErrorBoundary>
        <Routes>
          <Route path="sitemap.xml" element={"sitemap.xml"}/>
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
            <Route path="/playlists/:playlistId" element={<PlaylistDetailsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/artists/:id" element={<ArtistPage />} />
            <Route path="/users/:userId" element={<ProfilePage />} />
            <Route path="/list" element={<DisplayListPage />} />
            <Route path="/mixes/:mixId" element={<MixDetailsPage />} />
            <Route path="/all-mixes/:category" element={<AllMixesPage />} />
            <Route path="/offline" element={<OfflinePage />} />
            <Route path="/generated-playlists/:id" element={<GeneratedPlaylistPage />} />
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
