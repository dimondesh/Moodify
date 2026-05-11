// frontend/src/layout/BottomNavigationBar.tsx

import { Link, useLocation } from "react-router-dom";
import { HomeIcon, Search, Library, Plus } from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { cn } from "../lib/utils";
import { buttonVariants } from "../components/ui/button";
import { useTranslation } from "react-i18next";
import { useQuickCreatePlaylist } from "@/hooks/useQuickCreatePlaylist";

const BottomNavigationBar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuthStore();
  const quickCreatePlaylist = useQuickCreatePlaylist();

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
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/97 to-[#0f0f0f]/95 h-22 flex items-center justify-around z-50 pb-4">
      {navItems.map((item) => {
        const isActive = location.pathname === item.to;
        const isDisabled = item.authRequired && !user;
        const className = cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "flex flex-col items-center justify-center p-0 h-full w-auto transition-colors duration-200 relative",
          isDisabled
            ? "text-zinc-600 cursor-not-allowed opacity-50 pointer-events-none"
            : cn(
                "text-zinc-400 hover:text-white",
                isActive ? "text-white" : "text-zinc-400"
              )
        );

        if (isDisabled) {
          return (
            <div
              key={item.to}
              className={className}
              aria-disabled="true"
            >
              <item.icon className="size-5" />
              <span className="text-xs mt-1">{item.label}</span>
            </div>
          );
        }

        return (
          <Link key={item.to} to={item.to} className={className}>
            <item.icon className="size-5" />
            <span className="text-xs mt-1">{item.label}</span>
          </Link>
        );
      })}

      <button
        type="button"
        disabled={!user}
        onClick={() => {
          if (user) void quickCreatePlaylist();
        }}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "flex flex-col items-center justify-center p-0 h-full w-auto transition-colors duration-200 relative",
          user
            ? "text-zinc-400 hover:text-white"
            : "text-zinc-600 cursor-not-allowed opacity-50"
        )}
        title={t("sidebar.create")}
      >
        <Plus className="size-5" />
        <span className="text-xs mt-1">{t("sidebar.create")}</span>
      </button>
    </div>
  );
};

export default BottomNavigationBar;
