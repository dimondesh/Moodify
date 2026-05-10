import { useGoogleLogin } from "@react-oauth/google";
import { Button } from "./button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useAuthStore } from "../../stores/useAuthStore";

function SignInOAuthInner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const completeGoogleAccessToken = useAuthStore(
    (s) => s.completeGoogleAccessToken,
  );

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        await completeGoogleAccessToken(tokenResponse.access_token);
        toast.success(t("auth.loginSuccess"));
        navigate("/");
      } catch (error: unknown) {
        const err = error as { response?: { data?: { code?: string } } };
        if (err?.response?.data?.code === "ACCOUNT_EXISTS_PASSWORD") {
          toast.error(t("auth.googleAccountExistsUsePassword"));
        } else {
          toast.error(t("auth.googleSignInFailed"));
        }
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
      variant="secondary"
      className="w-30 md:w-40 text-white border-zinc-200 h-10"
    >
      <p className="text-xs">{t("auth.continueWithGoogle")}</p>
    </Button>
  );
}

const SignInOAuthButton = () => {
  const { t } = useTranslation();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  if (!googleClientId) {
    return (
      <Button
        onClick={() => toast.error(t("auth.googleNotConfigured"))}
        variant="secondary"
        className="w-30 md:w-40 text-white border-zinc-200 h-10"
      >
        <p className="text-xs">{t("auth.continueWithGoogle")}</p>
      </Button>
    );
  }

  return <SignInOAuthInner />;
};

export default SignInOAuthButton;
