// frontend/src/App.tsx

import { Route, Routes, useLocation, useNavigate } from "react-router-dom"; // <-- ИЗМЕНЕНИЕ
import HomePage from "./pages/HomePage/HomePage";
import MainLayout from "./layout/MainLayout";
import ChatPage from "./pages/ChatPage/ChatPage";
import AlbumPage from "./pages/AlbumPage/AlbumPage";
import AdminPage from "./pages/AdminPage/AdminPage";
import { Toaster } from "react-hot-toast";
import NotFoundPage from "./pages/NotFoundPage/NotFoundPage";
import SearchPage from "./pages/SearchPage/SearchPage";
import LikedSongs from "./pages/LikedSongs/LikedSongs";
import LoginPage from "./pages/LoginPage/LoginPage";
import LibraryPage from "./pages/LibraryPage/LibraryPage";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./lib/firebase";
import { useAuthStore } from "./stores/useAuthStore";
import { useOfflineStore } from "./stores/useOfflineStore";
import AllSongsPage from "./pages/AllSongs/AllSongsPage";
import PlaylistDetailsPage from "./pages/PlaylistPage/PlaylistDetailsPage";
import ArtistPage from "./pages/ArtistPage/ArtistPage";
import SettingsPage from "./pages/SettingsPage/SettingsPage";
import ProfilePage from "./pages/ProfilePage/ProfilePage";
import DisplayListPage from "./pages/DisplayListPage/DisplayListPage";
import MixDetailsPage from "./pages/MixDetailsPage/MixDetailsPage";
import AllMixesPage from "./pages/AllMixesPage/AllMixesPage";
import OfflinePage from "./pages/OfflinePage/OfflinePage";
import { Helmet } from "react-helmet-async";

function App() {
  const { fetchUser, logout, user } = useAuthStore();
  const { isOffline } = useOfflineStore();
  const location = useLocation();
  const navigate = useNavigate(); // <-- ДОБАВЛЕНО

  // Инициализация стора
  useEffect(() => {
    const { init, checkOnlineStatus } = useOfflineStore.getState().actions;
    init();
    window.addEventListener("online", checkOnlineStatus);
    window.addEventListener("offline", checkOnlineStatus);
    return () => {
      window.removeEventListener("online", checkOnlineStatus);
      window.removeEventListener("offline", checkOnlineStatus);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (!user || user.firebaseUid !== firebaseUser.uid) {
          await fetchUser(firebaseUser.uid);
        }
      } else {
        if (user) {
          logout();
        }
      }
    });

    return () => unsubscribe();
  }, [fetchUser, logout, user]);

  // --- ИЗМЕНЕНИЕ: Глобальная логика редиректа в офлайн-режиме ---
  useEffect(() => {
    // Список "безопасных" путей, которые могут работать оффлайн
    const safeOfflinePaths = [
      "/library",
      "/settings",
      "/albums/",
      "/playlists/",
      "/mixes/",
      "/offline",
    ];

    const isSafe = safeOfflinePaths.some((path) =>
      location.pathname.startsWith(path)
    );

    if (isOffline && !isSafe) {
      // Если мы оффлайн и на "небезопасной" странице, перенаправляем
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
          content="Moodify is a music streaming service where you can find new artists, create playlists, and enjoy music tailored to your mood."
        />
      </Helmet>
      <Routes>
        {/* "Небезопасные" роуты, которые будут перехвачены */}
        <Route path="admin" element={<AdminPage />} />
        <Route path="login" element={<LoginPage />} />

        {/* Роуты внутри MainLayout, которые мы сделали "безопасными" */}
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
          <Route path="/all-mixes/:category" element={<AllMixesPage />} />
          {/* Роут /offline нужен для MainLayout, если мы перейдем на него вручную */}
          <Route path="/offline" element={<OfflinePage />} />
        </Route>
      </Routes>
      <Toaster
        toastOptions={{
          iconTheme: {
            primary: "#805ad5",
            secondary: "black",
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
        }}
      />
    </>
  );
}

export default App;
