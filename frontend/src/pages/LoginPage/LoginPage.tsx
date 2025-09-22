import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";

const LoginPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      navigate("/auth-callback");
    } catch (error) {
      console.error("Login error", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0f0f0f] text-white">
      <h1 className="mb-6 text-3xl font-bold">{t("auth.loginTitle")}</h1>
      <Button
        onClick={handleGoogleLogin}
        className="px-6 py-3 bg-blue-600 rounded hover:bg-blue-700"
      >
        {t("auth.continueWithGoogle")}
      </Button>
    </div>
  );
};

export default LoginPage;
