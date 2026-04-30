// frontend/src/layout/BottomNavigationBar.tsx

import { Link, useLocation } from "react-router-dom";
import { HomeIcon, Search, Library, Plus } from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { cn } from "../lib/utils";
import { buttonVariants } from "../components/ui/button";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../stores/useUIStore";

const BottomNavigationBar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuthStore();
  const { openCreatePlaylistDialog } = useUIStore();

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
            <item.icon className="size-5" />
            <span className="text-xs mt-1">{item.label}</span>
          </Link>
        );
      })}

      {user && (
        <button
          type="button"
          onClick={openCreatePlaylistDialog}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "flex flex-col items-center justify-center p-0 h-full w-auto text-zinc-400 hover:text-white transition-colors duration-200 relative"
          )}
          title={t("sidebar.create")}
        >
          <Plus className="size-5" />
          <span className="text-xs mt-1">{t("sidebar.create")}</span>
        </button>
      )}
    </div>
  );
};

export default BottomNavigationBar;
