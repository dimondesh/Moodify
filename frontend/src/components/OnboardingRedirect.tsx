import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/useAuthStore";

const OnboardingRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (isLoading && accessToken && !user) return;

    const pathname = location.pathname;

    if (!user && pathname === "/onboarding") {
      navigate("/login", { replace: true });
      return;
    }

    if (user?.requiresOnboarding && pathname !== "/onboarding") {
      navigate("/onboarding", { replace: true });
      return;
    }

    if (user && !user.requiresOnboarding && pathname === "/onboarding") {
      navigate("/", { replace: true });
    }
  }, [user, accessToken, isLoading, location.pathname, navigate]);

  return null;
};

export default OnboardingRedirect;
