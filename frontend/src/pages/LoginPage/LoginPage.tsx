import { useGoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import toast from "react-hot-toast";
import { useAuthStore } from "../../stores/useAuthStore";

function LoginGoogleInner() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const completeGoogleAccessToken = useAuthStore(
    (s) => s.completeGoogleAccessToken,
  );

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        await completeGoogleAccessToken(tokenResponse.access_token);
        toast.success(t("auth.loginSuccess"));
        navigate("/");
      } catch {
        toast.error(t("auth.googleSignInFailed"));
      }
    },
    onError: () => {
      toast.error(t("auth.googleSignInFailed"));
    },
    scope: "openid email profile",
  });

  return (
    <Button
      onClick={() => googleLogin()}
      className="px-6 py-3 bg-blue-600 rounded hover:bg-blue-700"
    >
      {t("auth.continueWithGoogle")}
    </Button>
  );
}

const LoginPage = () => {
  const { t } = useTranslation();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0f0f0f] text-white">
      <h1 className="mb-6 text-3xl font-bold">{t("auth.loginTitle")}</h1>
      {googleClientId ? (
        <LoginGoogleInner />
      ) : (
        <Button
          onClick={() => toast.error(t("auth.googleNotConfigured"))}
          className="px-6 py-3 bg-blue-600 rounded hover:bg-blue-700"
        >
          {t("auth.continueWithGoogle")}
        </Button>
      )}
    </div>
  );
};

export default LoginPage;
