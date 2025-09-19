// src/components/ui/Topbar.tsx

import { useNavigate, Link, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import {
  LayoutDashboardIcon,
  Search,
  LogOut,
  Settings,
  UserIcon,
} from "lucide-react";
import { useAuthStore } from "../../stores/useAuthStore";
import { cn } from "../../lib/utils";
import { Button, buttonVariants } from "./button";
import { auth } from "../../lib/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "../ui/drawer";
import { useUIStore } from "../../stores/useUIStore";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import WaveAnalyzer from "./WaveAnalyzer";
import { useTranslation } from "react-i18next";
import MoodifyLogo from "../MoodifyLogo";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { useSearchStore } from "../../stores/useSearchStore";
import RecentSearchesList from "@/pages/SearchPage/RecentSearchesList";

const Topbar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const [query, setQuery] = useState("");
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const { isAdmin, user: authUser } = useAuthStore();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { isUserSheetOpen, setUserSheetOpen } = useUIStore();

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { fetchRecentSearches } = useSearchStore();

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

  useEffect(() => {
    if (!location.pathname.startsWith("/search")) {
      setQuery("");
      if (isSearchVisible) {
        setIsSearchVisible(false);
      }
    }
  }, [location.pathname]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (val.trim() !== "") {
      setIsPopoverOpen(false);
    } else if (authUser) {
      setIsPopoverOpen(true);
      fetchRecentSearches();
    }

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      if (val.trim() !== "") {
        navigate(`/search?q=${encodeURIComponent(val)}`);
      } else if (location.pathname.startsWith("/search")) {
        navigate(`/`);
      }
    }, 300);
  };

  const handleTriggerClick = () => {
    if (authUser && !query) {
      fetchRecentSearches();
      setIsPopoverOpen(true);
    }
  };

  const handleItemClickInPopover = () => {
    setIsPopoverOpen(false);
    setQuery("");
    setIsSearchVisible(false);
  };

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

  return (
    <div className="flex items-center justify-between px-2 py-2 sm:px-4 sm:py-3 sticky top-0 bg-zinc-900/90 backdrop-blur-md z-20 shadow-md">
      <div className="flex-1 flex justify-start">
        <div
          className={`flex gap-3 items-center ${
            isSearchVisible ? "hidden sm:flex" : "flex"
          }`}
        >
          <Link to="/">
            <MoodifyLogo />
          </Link>
          <WaveAnalyzer width={120} height={30} />
        </div>
      </div>
      <div
        className={`relative w-full max-w-lg ${
          isSearchVisible ? "block" : "hidden md:block"
        }`}
      >
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <div onClick={handleTriggerClick}>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5 pointer-events-none" />
              <input
                type="text"
                placeholder={t("topbar.searchPlaceholder")}
                value={query}
                onChange={handleChange}
                className="w-full bg-zinc-800 rounded-full py-2.5 pl-12 pr-4 text-base text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition duration-150 ease-in-out cursor-pointer"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] mt-2 p-0 bg-zinc-900/90 backdrop-blur-md  border-zinc-800"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <RecentSearchesList onItemClick={handleItemClickInPopover} />
          </PopoverContent>
        </Popover>
        {isSearchVisible && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white md:hidden"
            onClick={() => {
              setIsSearchVisible(false);
              setQuery("");
              if (location.pathname.startsWith("/search")) {
                navigate(-1);
              }
            }}
          >
            {t("topbar.cancel")}
          </Button>
        )}
      </div>
      <div className="flex-1 flex justify-end">
        <div
          className={`flex items-center gap-4 ${
            isSearchVisible ? "hidden" : "flex"
          }`}
        >
          {user && (
            <Button
              size="icon"
              variant="ghost"
              className="md:hidden"
              onClick={() => setIsSearchVisible(true)}
            >
              <Search className="w-5 h-5" />
            </Button>
          )}
          {isAdmin && (
            <Link
              to={"/admin"}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "hidden sm:inline-flex"
              )}
            >
              <LayoutDashboardIcon className="w-4 h-4 mr-2" />
              <span className="hidden md:inline">{t("topbar.admin")}</span>
            </Link>
          )}
          {user ? (
            isMobile ? (
              <Drawer
                direction="right"
                open={isUserSheetOpen}
                onOpenChange={setUserSheetOpen}
              >
                <DrawerTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-8 w-8 rounded-full"
                  >
                    <Avatar className="w-8 h-8 object-cover">
                      <AvatarImage
                        src={user.photoURL || undefined}
                        alt="avatar"
                        className="object-cover"
                      />
                      <AvatarFallback>{user.displayName?.[0]}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DrawerTrigger>
                <DrawerContent
                  className="bg-zinc-900 border-l-zinc-800 text-white w-[250px] p-0 h-full"
                  aria-describedby={undefined}
                >
                  <DrawerHeader className="p-4 border-b border-zinc-800">
                    <DrawerTitle className="sr-only">User Menu</DrawerTitle>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10 object-cover">
                        <AvatarImage
                          src={user.photoURL || undefined}
                          alt="avatar"
                          className="object-cover"
                        />
                        <AvatarFallback>{user.displayName?.[0]}</AvatarFallback>
                      </Avatar>
                      <p className="font-semibold">{user.displayName}</p>
                    </div>
                  </DrawerHeader>
                  <div className="p-4 flex flex-col gap-2">
                    <UserMenuItems />
                  </div>
                </DrawerContent>
              </Drawer>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-8 w-8 rounded-full"
                  >
                    <Avatar className="w-8 h-8 object-cover">
                      <AvatarImage
                        src={user.photoURL || undefined}
                        alt="avatar"
                        className="object-cover"
                      />
                      <AvatarFallback>{user.displayName?.[0]}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-48 bg-zinc-800/50 backdrop-blur-md border-zinc-700 text-white p-1"
                  align="end"
                >
                  {user.displayName && (
                    <DropdownMenuItem className="text-sm font-semibold cursor-default text-zinc-200 p-2 opacity-100 hover:bg-zinc-700">
                      {user.displayName}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-zinc-700" />
                  <DropdownMenuItem asChild className="p-0">
                    <Link
                      to={`/users/${authUser?.id}`}
                      className="flex items-center w-full p-2 cursor-pointer hover:bg-zinc-700 rounded-sm"
                    >
                      <UserIcon className="w-4 h-4 mr-2" />
                      {t("topbar.profile")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="p-0">
                    <Link
                      to="/settings"
                      className="flex items-center w-full p-2 cursor-pointer hover:bg-zinc-700 rounded-sm"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      {t("topbar.settings")}
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild className="p-0">
                      <Link
                        to="/admin"
                        className="flex items-center w-full p-2 cursor-pointer hover:bg-zinc-700 rounded-sm"
                      >
                        <LayoutDashboardIcon className="w-4 h-4 mr-2" />
                        {t("topbar.adminDashboard")}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-red-400 p-2 cursor-pointer hover:bg-zinc-700"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {t("topbar.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          ) : (
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="ghost"
                className="text-zinc-300 hover:text-white"
              >
                <Link to="/login" state={{ mode: "signup" }}>
                  Sign Up
                </Link>
              </Button>
              <Button asChild className="bg-white text-black hover:bg-zinc-200">
                <Link to="/login">Log In</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Topbar;
