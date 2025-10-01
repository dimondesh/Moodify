// frontend/src/layout/MainLayout.tsx

import { Outlet, useLocation } from "react-router-dom";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../components/ui/resizable";
import LeftSidebar from "./LeftSidebar";
import FriendsActivity from "./FriendsActivity";
import AudioPlayer from "./AudioPlayer";
import PlaybackControls from "./PlaybackControls";
import Topbar from "../components/ui/Topbar";
import MobileHeader from "../components/ui/MobileHeader";
import BottomNavigationBar from "./BottomNavigationBar";
import { useEffect, useState, useRef } from "react";
import { usePlayerStore } from "../stores/usePlayerStore";
import LyricsPage from "@/pages/LyricsPage/LyricsPage";
import DynamicTitleUpdater from "@/components/DynamicTitleUpdater";
import { useUIStore } from "../stores/useUIStore";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { cn } from "../lib/utils";
import { useTranslation } from "react-i18next";

const MainLayout = () => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const location = useLocation();
  const prevLocationPathname = useRef(location.pathname);
  const { t } = useTranslation();

  const getMobileHeaderTitle = (pathname: string) => {
    const hour = new Date().getHours();
    const getGreeting = () => {
      if (hour < 12) return t("greetings.morning");
      if (hour < 18) return t("greetings.afternoon");
      return t("greetings.evening");
    };

    switch (pathname) {
      case "/":
        return getGreeting();
      case "/search":
        return t("sidebar.search");
      case "/library":
        return t("sidebar.library");
      case "/chat":
        return t("pages.chat.title");
      default:
        return "";
    }
  };

  const [isCompactView, setIsCompactView] = useState(false);
  const {
    currentSong,
    isFullScreenPlayerOpen,
    isDesktopLyricsOpen,
    isMobileLyricsFullScreen,
    setIsDesktopLyricsOpen,
    setIsMobileLyricsFullScreen,
  } = usePlayerStore();

  const {
    isCreatePlaylistDialogOpen,
    editingPlaylist,
    isSearchAndAddDialogOpen,
    shareEntity,
    isEditProfileDialogOpen,
    playlistToDelete,
    songToRemoveFromPlaylist,
    isUserSheetOpen,
    isFriendsActivityOpen,
  } = useUIStore();

  const isAnyDialogOpen =
    isCreatePlaylistDialogOpen ||
    !!editingPlaylist ||
    isSearchAndAddDialogOpen ||
    !!shareEntity ||
    isEditProfileDialogOpen ||
    !!playlistToDelete ||
    !!songToRemoveFromPlaylist;

  useEffect(() => {
    if (prevLocationPathname.current !== location.pathname) {
      if (isDesktopLyricsOpen) {
        setIsDesktopLyricsOpen(false);
      }
      if (isMobileLyricsFullScreen) {
        setIsMobileLyricsFullScreen(false);
      }
    }
    prevLocationPathname.current = location.pathname;
  }, [
    location.pathname,
    isDesktopLyricsOpen,
    isMobileLyricsFullScreen,
    setIsDesktopLyricsOpen,
    setIsMobileLyricsFullScreen,
  ]);

  useEffect(() => {
    const rootElement = document.getElementById("root");
    if (rootElement) {
      if (isAnyDialogOpen && !isFullScreenPlayerOpen && !isUserSheetOpen) {
        rootElement.classList.add("dialog-open-blur");
      } else {
        rootElement.classList.remove("dialog-open-blur");
      }
    }
    return () => {
      if (rootElement) {
        rootElement.classList.remove("dialog-open-blur");
      }
      document.body.style.pointerEvents = "";
    };
  }, [isAnyDialogOpen, isFullScreenPlayerOpen, isUserSheetOpen]);

  useEffect(() => {
    const checkScreenSize = () => {
      const isCompact = window.innerWidth < 1024;
      setIsCompactView(isCompact);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  let contentPaddingBottom = "pb-0";
  if (isMobile) {
    if (isFullScreenPlayerOpen || isMobileLyricsFullScreen) {
      contentPaddingBottom = "pb-0";
    } else if (currentSong) {
      contentPaddingBottom = "pb-[7.5rem]";
    } else {
      contentPaddingBottom = "pb-16";
    }
  } else {
    if (currentSong) {
      contentPaddingBottom = "pb-24";
    } else {
      contentPaddingBottom = "pb-0";
    }
  }
  useEffect(() => {
    if (isUserSheetOpen && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isUserSheetOpen, isMobile]);

  return (
    <div
      className={cn(
        "h-screen bg-[#0f0f0f] text-white flex flex-col transition-transform ease-in-out",
        isUserSheetOpen && isMobile
          ? "duration-300 -translate-x-[290px] rounded-none overflow-hidden"
          : "duration-300 translate-x-0 rounded-none"
      )}
    >
      <DynamicTitleUpdater />
      <AudioPlayer />
      <MobileHeader title={getMobileHeaderTitle(location.pathname)} />
      <div className="hidden md:block">
        <Topbar />
      </div>
      <ResizablePanelGroup
        direction="horizontal"
        className={`flex-1 flex overflow-hidden ${contentPaddingBottom} ${
          isMobile ? "p-0" : "p-1"
        }`}
        id="main-layout-group"
      >
        {!isMobile && (
          <>
            <ResizablePanel
              id="left-sidebar-panel"
              order={1}
              defaultSize={15}
              minSize={10}
              maxSize={25}
              className="hidden lg:block"
            >
              <LeftSidebar />
            </ResizablePanel>
            <ResizableHandle
              id="left-handle"
              className="w-1 bg-[#2a2a2a] transition-colors hidden lg:block hover:bg-[#8b5cf6]"
            />
          </>
        )}

        <ResizablePanel
          id="main-content-panel"
          order={2}
          className="overflow-y-auto flex-1 bg-[#0f0f0f]"
        >
          {isMobileLyricsFullScreen ? (
            <div className="fixed inset-0 z-[80] bg-[#0f0f0f]">
              <LyricsPage isMobileFullScreen={true} />
            </div>
          ) : !isCompactView && isDesktopLyricsOpen ? (
            <LyricsPage isMobileFullScreen={false} />
          ) : (
            <Outlet />
          )}
        </ResizablePanel>

        {!isMobile && isFriendsActivityOpen && (
          <>
            <ResizableHandle
              id="right-handle"
              className="w-1 bg-[#2a2a2a] transition-colors hover:bg-[#8b5cf6]"
            />
            <ResizablePanel
              id="friends-activity-panel"
              order={3}
              defaultSize={15}
              minSize={15}
              maxSize={20}
              collapsible={false}
              collapsedSize={0}
              className="hidden lg:block"
            >
              <FriendsActivity />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
      <PlaybackControls />
      {isCompactView &&
        !isFullScreenPlayerOpen &&
        !isMobileLyricsFullScreen && <BottomNavigationBar />}
    </div>
  );
};

export default MainLayout;
