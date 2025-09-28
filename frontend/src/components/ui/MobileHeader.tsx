// src/components/ui/MobileHeader.tsx

import { useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/useAuthStore";
import { useUIStore } from "../../stores/useUIStore";
import { useOfflineStore } from "../../stores/useOfflineStore";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Button } from "./button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from "./drawer";
import {
  LayoutDashboardIcon,
  LogOut,
  Settings,
  UserIcon,
  Plus,
} from "lucide-react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

interface MobileHeaderProps {
  title: string;
}

const MobileHeader = ({ title }: MobileHeaderProps) => {
  const { t } = useTranslation();
  const { isAdmin, user: authUser } = useAuthStore();
  const { isUserSheetOpen, setUserSheetOpen, openCreatePlaylistDialog } =
    useUIStore();
  const { isOffline } = useOfflineStore();
  const location = useLocation();

  const [user, setUser] = useState<null | {
    displayName: string | null;
    photoURL: string | null;
  }>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        });
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const UserMenuItems = () => (
    <>
      <DrawerClose asChild>
        <Link
          to={`/users/${authUser?.id}`}
          className="flex items-center p-2 cursor-pointer hover:bg-zinc-700 rounded-md"
        >
          <UserIcon className="w-4 h-4 mr-2" />
          {t("topbar.profile")}
        </Link>
      </DrawerClose>
      <DrawerClose asChild>
        <Link
          to="/settings"
          className="flex items-center p-2 cursor-pointer hover:bg-zinc-700 rounded-md"
        >
          <Settings className="w-4 h-4 mr-2" />
          {t("topbar.settings")}
        </Link>
      </DrawerClose>
      {isAdmin && (
        <DrawerClose asChild>
          <Link
            to="/admin"
            className="flex items-center p-2 cursor-pointer hover:bg-zinc-700 rounded-md"
          >
            <LayoutDashboardIcon className="w-4 h-4 mr-2" />
            {t("topbar.adminDashboard")}
          </Link>
        </DrawerClose>
      )}
      <div className="w-full h-px bg-zinc-700 my-1" />
      <DrawerClose asChild>
        <div
          onClick={handleLogout}
          className="flex items-center text-red-400 p-2 cursor-pointer hover:bg-zinc-700 rounded-md"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {t("topbar.logout")}
        </div>
      </DrawerClose>
    </>
  );

  // Определяем, нужно ли показывать хедер на текущей странице
  const shouldShowHeader = () => {
    const path = location.pathname;
    return (
      path === "/" || // домашняя страница
      path === "/search" || // страница поиска
      path === "/library" || // медиатека
      path === "/chat" // страница чата
    );
  };

  if (!shouldShowHeader()) {
    return null;
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 sticky top-0 bg-[#0f0f0f]/80 backdrop-blur-md z-20 md:hidden">
      <h1 className="text-lg font-semibold text-white truncate flex-1">
        {title}
      </h1>

      <div className="flex items-center gap-2">
        {location.pathname === "/library" && authUser && !isOffline && (
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-[#2a2a2a] h-8 w-8"
            onClick={openCreatePlaylistDialog}
            title={t("sidebar.createPlaylist")}
          >
            <Plus className="size-4" />
          </Button>
        )}

        {user ? (
          <Drawer
            direction="right"
            open={isUserSheetOpen}
            onOpenChange={setUserSheetOpen}
          >
            <DrawerTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-8 w-8 rounded-full hover:bg-[#2a2a2a] flex-shrink-0"
              >
                <Avatar className="w-8 h-8 object-cover">
                  <AvatarImage
                    src={user.photoURL || undefined}
                    alt="avatar"
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-[#8b5cf6] text-white font-semibold">
                    {user.displayName?.[0]}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DrawerTrigger>
            <DrawerContent
              className="bg-[#0f0f0f] border-l-[#2a2a2a] text-white w-[250px] p-0 h-full"
              aria-describedby={undefined}
            >
              <DrawerHeader className="p-4 border-b border-[#2a2a2a]">
                <DrawerTitle className="sr-only">User Menu</DrawerTitle>
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 object-cover">
                    <AvatarImage
                      src={user.photoURL || undefined}
                      alt="avatar"
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-[#8b5cf6] text-white font-semibold">
                      {user.displayName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-semibold">{user.displayName}</p>
                </div>
              </DrawerHeader>
              <div className="p-4 flex flex-col gap-1">
                <UserMenuItems />
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-gray-300 hover:text-white hover:bg-[#2a2a2a]"
            >
              <Link to="/login" state={{ mode: "signup" }}>
                Sign Up
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-[#8b5cf6] text-white hover:bg-[#7c3aed]"
            >
              <Link to="/login">Log In</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileHeader;
