// src/components/ui/Topbar.tsx

import { useNavigate, Link, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import {
  Search,
  LogOut,
  Settings,
  UserIcon,
  Users,
  UsersIcon,
  HomeIcon,
  Home,
  Compass,
  CompassIcon,
  MessageCircle,
  MessageCircleIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuthStore } from "../../stores/useAuthStore";
import { cn } from "../../lib/utils";
import { Button, buttonVariants } from "./button";
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
import { useChatStore } from "../../stores/useChatStore";
import RecentSearchesList from "@/pages/SearchPage/RecentSearchesList";
import { useAudioSettingsStore } from "../../lib/webAudio";
import { usePlayerStore } from "@/stores/usePlayerStore";

const Topbar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const [query, setQuery] = useState("");
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const { user: authUser, logout } = useAuthStore();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { waveAnalyzerEnabled } = useAudioSettingsStore();
  const { isPlaying } = usePlayerStore();

  const {
    isUserSheetOpen,
    setUserSheetOpen,
    isFriendsActivityOpen,
    setIsFriendsActivityOpen,
  } = useUIStore();

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { fetchRecentSearches } = useSearchStore();
  const { unreadMessages } = useChatStore();
  const totalUnread = Array.from(unreadMessages.values()).reduce(
    (acc, count) => acc + count,
    0,
  );

  // Состояния для кнопок навигации
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    // Используем Navigation API (если доступно) для точного отслеживания истории Вперед/Назад
    const updateNavState = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = (window as any).navigation;
      if (nav) {
        setCanGoBack(nav.canGoBack);
        setCanGoForward(nav.canGoForward);
      } else {
        // Fallback для старых браузеров
        setCanGoBack((window.history.state?.idx ?? 0) > 0);
      }
    };

    updateNavState();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = (window as any).navigation;
    if (nav) {
      nav.addEventListener("currententrychange", updateNavState);
      return () => {
        nav.removeEventListener("currententrychange", updateNavState);
      };
    }
  }, [location]);

  useEffect(() => {
    if (!location.pathname.startsWith("/search")) {
      setQuery("");
      if (isSearchVisible) {
        setIsSearchVisible(false);
      }
    }
  }, [location.pathname, isSearchVisible]);

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
    await logout();
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
    <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-[#0f0f0f] z-20 border-b border-[#2a2a2a]">
      <div className="flex-1 flex justify-start">
        <div
          className={`flex gap-4 items-center ${
            isSearchVisible ? "hidden sm:flex" : "flex"
          }`}
        >
          <Link to="/" className="hover-brightness">
            <MoodifyLogo />
          </Link>

          {/* Navigation & WaveAnalyzer */}
          <div className="hidden lg:flex items-center h-8 ml-2">
            <div className="relative w-[100px] h-full group flex items-center justify-center">
              {/* Контейнер Анализатора (скрывается при наведении или если не играет) */}
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center transition-all duration-300 pointer-events-none",
                  waveAnalyzerEnabled && isPlaying
                    ? "opacity-100 group-hover:opacity-0"
                    : "opacity-0",
                )}
              >
                {waveAnalyzerEnabled && (
                  <WaveAnalyzer width={100} height={24} />
                )}
              </div>

              {/* Контейнер Кнопок (появляется при наведении или если анализатор выключен/музыка на паузе) */}
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center gap-2 transition-all duration-300",
                  waveAnalyzerEnabled && isPlaying
                    ? "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
                    : "opacity-100 pointer-events-auto",
                )}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!canGoBack}
                  className="h-8 w-8 rounded-full text-zinc-400 hover:text-white hover:bg-transparent! disabled:opacity-30 disabled:hover:bg-transparent! disabled:cursor-not-allowed"
                  onClick={() => navigate(-1)}
                >
                  <ChevronLeft className="size-7" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!canGoForward}
                  className="h-8 w-8 rounded-full text-zinc-400 hover:text-white hover:bg-transparent! disabled:opacity-30 disabled:hover:bg-transparent! disabled:cursor-not-allowed"
                  onClick={() => navigate(1)}
                >
                  <ChevronRight className="size-7" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="hidden md:block mr-2">
        <Link
          to="/"
          className={cn(
            buttonVariants({
              variant: "ghost",
              size: "sm",
              className: cn(
                "h-8 rounded-full transition-colors hover:bg-transparent! ",
                location.pathname === "/"
                  ? "text-white"
                  : "text-gray-300 hover:text-white",
              ),
            }),
          )}
        >
          {location.pathname === "/" ? (
            <Home className="w-4 h-4 text-[#8b5cf6]" />
          ) : (
            <HomeIcon className="w-4 h-4" />
          )}
        </Link>
      </div>
      <div
        className={`relative w-full max-w-lg ${
          isSearchVisible ? "block" : "hidden md:block"
        }`}
      >
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <div onClick={handleTriggerClick} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
              <input
                type="text"
                placeholder={t("topbar.searchPlaceholder")}
                value={query}
                onChange={handleChange}
                className="w-full bg-zinc-800/50 rounded-full py-2 pl-10 pr-12 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#8b5cf6] transition cursor-pointer"
                spellCheck={false}
                autoComplete="off"
              />
              <Link
                to="/search"
                className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 hover:text-white transition-colors",
                  location.pathname === "/search"
                    ? "text-[#8b5cf6]"
                    : "text-gray-400",
                )}
                title={t("sidebar.search")}
              >
                {location.pathname === "/search" ? (
                  <CompassIcon className="w-4 h-4" />
                ) : (
                  <Compass className="w-4 h-4" />
                )}
              </Link>
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] mt-2 p-0 bg-[#1a1a1a] border-[#2a2a2a]"
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
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white md:hidden"
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
          {authUser && (
            <Button
              size="icon"
              variant="ghost"
              className="md:hidden hover:bg-transparent!"
              onClick={() => setIsSearchVisible(true)}
            >
              <Search className="w-4 h-4" />
            </Button>
          )}

          {!isMobile && (
            <Button
              size="icon"
              variant="ghost"
              className={`hover:bg-transparent! h-8 w-8 ${
                isFriendsActivityOpen ? "text-[#8b5cf6]" : "text-gray-400"
              }`}
              onClick={() => setIsFriendsActivityOpen(!isFriendsActivityOpen)}
              title={t("topbar.friendsActivity")}
            >
              {isFriendsActivityOpen ? (
                <UsersIcon className="w-4 h-4" />
              ) : (
                <Users className="w-4 h-4" />
              )}
            </Button>
          )}
          {authUser && (
            <Link
              to="/chat"
              className={cn(
                buttonVariants({
                  variant: "ghost",
                  size: "icon",
                  className: cn(
                    "hover:bg-transparent! h-8 w-8 relative",
                    location.pathname === "/chat"
                      ? "text-[#8b5cf6]"
                      : "text-gray-400",
                  ),
                }),
              )}
              title={t("sidebar.messages")}
            >
              {location.pathname === "/chat" ? (
                <MessageCircleIcon className="w-4 h-4" />
              ) : (
                <MessageCircle className="w-4 h-4" />
              )}
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#8b5cf6] text-white text-xs rounded-full h-4 px-1.5 flex items-center justify-center font-semibold min-w-[16px]">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </Link>
          )}
          {authUser ? (
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
                    className="relative h-8 w-8 rounded-full hover:bg-transparent!"
                  >
                    <Avatar className="w-8 h-8 object-cover">
                      <AvatarImage
                        src={authUser.imageUrl || undefined}
                        alt="avatar"
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-[#8b5cf6] text-white font-semibold">
                        {authUser.fullName?.[0]}
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
                          src={authUser.imageUrl || undefined}
                          alt="avatar"
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-[#8b5cf6] text-white font-semibold">
                          {authUser.fullName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <p className="font-semibold">{authUser.fullName}</p>
                    </div>
                  </DrawerHeader>
                  <div className="p-4 flex flex-col gap-1">
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
                    className="relative h-8 w-8 rounded-full hover:bg-transparent! hover:cursor-pointer"
                  >
                    <Avatar className="w-8 h-8 object-cover">
                      <AvatarImage
                        src={authUser.imageUrl || undefined}
                        alt="avatar"
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-[#8b5cf6] text-white font-semibold">
                        {authUser.fullName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-48 bg-[#1a1a1a] border-[#2a2a2a] text-white p-1"
                  align="end"
                >
                  {authUser.fullName && (
                    <DropdownMenuItem className="text-sm font-semibold cursor-default text-white p-2 opacity-100 hover:bg-zinc-800/50">
                      {authUser.fullName}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-zinc-800/50" />
                  <DropdownMenuItem asChild className="p-0">
                    <Link
                      to={`/users/${authUser?.id}`}
                      className="flex items-center w-full p-2 cursor-pointer hover:bg-zinc-800/50 rounded-sm"
                    >
                      <UserIcon className="w-4 h-4 mr-2" />
                      {t("topbar.profile")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="p-0">
                    <Link
                      to="/settings"
                      className="flex items-center w-full p-2 cursor-pointer hover:bg-zinc-800/50 rounded-sm"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      {t("topbar.settings")}
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-red-400 p-2 cursor-pointer hover:bg-zinc-800/50"
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
                className="text-gray-300 hover:text-white hover:bg-zinc-800/50"
              >
                <Link to="/register" state={{ mode: "signup" }}>
                  Sign Up
                </Link>
              </Button>
              <Button
                asChild
                className="bg-[#8b5cf6] text-white hover:bg-[#7c3aed]"
              >
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
