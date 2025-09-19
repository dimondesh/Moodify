// frontend/src/layout/BottomNavigationBar.tsx

import { Link, useLocation } from "react-router-dom";
import { HomeIcon, Search, Library, MessageCircle } from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { cn } from "../lib/utils";
import { buttonVariants } from "../components/ui/button";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../stores/useChatStore";

const BottomNavigationBar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuthStore();
  const { unreadMessages } = useChatStore();
  const totalUnread = Array.from(unreadMessages.values()).reduce(
    (acc, count) => acc + count,
    0
  );

  const navItems = [
    {
      to: "/",
      icon: HomeIcon,
      label: t("bottomNav.home"),
      authRequired: false,
    },
    {
      to: "/search",
      icon: Search,
      label: t("bottomNav.search"),
      authRequired: false,
    },
    {
      to: "/library",
      icon: Library,
      label: t("bottomNav.library"),
      authRequired: true,
    },
    {
      to: "/chat",
      icon: MessageCircle,
      label: t("bottomNav.chat"),
      authRequired: true,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 h-20 flex items-center justify-around z-50 pb-4">
      {navItems.map((item) => {
        if (item.authRequired && !user) {
          return null;
        }

        const isActive = location.pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "flex flex-col items-center justify-center p-0 h-full w-auto text-zinc-400 hover:text-white transition-colors duration-200 relative",
              isActive ? "text-white" : "text-zinc-400"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs mt-1">{item.label}</span>
            {item.to === "/chat" && totalUnread > 0 && (
              <span className="absolute top-1 right-2 bg-violet-600 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-bold">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
};

export default BottomNavigationBar;
