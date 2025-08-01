// frontend/src/pages/AdminPage/Header.tsx

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth, signOut } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import SignInOAuthButton from "../../components/ui/SignInOAuthButton";
import { LayoutDashboardIcon, LogOut, HomeIcon } from "lucide-react";
import { useAuthStore } from "../../stores/useAuthStore";
import { useTranslation } from "react-i18next";

const Header = () => {
  const { t } = useTranslation();
  const [user, setUser] = useState<null | {
    displayName: string | null;
    photoURL: string | null;
  }>(null);
  const { isAdmin } = useAuthStore();

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

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/" className="rounded-lg hidden sm:block">
          <img
            src="/Moodify.png"
            alt="Moodify Logo - Go to Home"
            className="size-10 text-black cursor-pointer"
          />
        </Link>
        <Link to="/" className="sm:hidden">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <HomeIcon className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{t("admin.title")}</h1>
          <p className="text-zinc-400 mt-1">{t("admin.description")}</p>
        </div>
      </div>

      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8 rounded-full"
            >
              <img
                src={user.photoURL || "/Moodify.png"}
                alt="User Avatar"
                className="w-8 h-8 rounded-full object-cover"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-48 bg-zinc-800 border-zinc-700 text-white p-1"
            align="end"
          >
            {user.displayName && (
              <DropdownMenuItem className="text-sm font-semibold cursor-default text-zinc-200 p-2 opacity-100 hover:bg-zinc-700">
                {user.displayName}
              </DropdownMenuItem>
            )}
            {isAdmin && (
              <DropdownMenuItem
                asChild
                className="p-2 cursor-pointer hover:bg-zinc-700"
              >
                <Link to="/admin">
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
      ) : (
        <SignInOAuthButton />
      )}
    </div>
  );
};

export default Header;
