import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  updateProfile,
  AuthError,
  signOut,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useAuthStore } from "../../stores/useAuthStore";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Loader2, MailCheck } from "lucide-react";
import MoodifyLogo from "../../components/MoodifyLogo";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import "./AuthPage.css";
import { motion } from "framer-motion";

const AuthPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  const [isLoginView, setIsLoginView] = useState(
    location.state?.mode !== "signup"
  );
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const validateEmail = (email: string) => {
    if (!email) return t("auth.emailRequired");
    if (email.length > 42) return t("auth.emailMaxLength");
    if (!/\S+@\S+\.\S+/.test(email)) return t("auth.emailInvalid");
    return "";
  };

  const validatePassword = (password: string) => {
    if (!password) return t("auth.passwordRequired");
    if (password.length < 6) return t("auth.passwordMinLength");
    if (password.length > 20) return t("auth.passwordMaxLength");
    return "";
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      navigate("/");
    } catch (error) {
      toast.error(t("auth.googleSignInFailed"));
      console.error("Google sign-in error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);

    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError });
      return;
    }

    setIsLoading(true);

    try {
      if (isLoginView) {
        await signInWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );
        toast.success(t("auth.loginSuccess"));
        navigate("/");
      } else {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );
        await updateProfile(userCredential.user, {
          displayName: formData.fullName,
        });
        await sendEmailVerification(userCredential.user);
        await signOut(auth);

        toast.success(t("auth.signupSuccess"));
        setVerificationSent(true);
      }
    } catch (error) {
      const authError = error as AuthError;
      let errorMessage = "An unknown error occurred.";
      switch (authError.code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          errorMessage = t("auth.errorInvalidCredentials");
          break;
        case "auth/email-already-in-use":
          errorMessage = t("auth.errorEmailInUse");
          break;
        case "auth/invalid-email":
          errorMessage = t("auth.errorInvalidEmail");
          break;
        default:
          errorMessage = t("auth.errorAuthFailed");
      }
      toast.error(errorMessage);
      console.error("Firebase auth error:", authError);
    } finally {
      setIsLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md text-center">
          <main className="bg-zinc-900 rounded-lg p-8 shadow-lg">
            <MailCheck className="w-16 h-16 text-violet-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4">
              {t("auth.verifyEmailTitle")}
            </h1>
            <p className="text-zinc-400 mb-6">
              {t("auth.verifyEmailMessage1")}{" "}
              <span className="font-bold text-white">{formData.email}</span>.{" "}
              {t("auth.verifyEmailMessage2")}
            </p>
            <Button
              onClick={() => {
                setVerificationSent(false);
                setIsLoginView(true);
              }}
              className="w-full h-12 bg-violet-600 hover:bg-violet-700"
            >
              {t("auth.backToLogin")}
            </Button>
          </main>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>
          {isLoginView ? t("auth.loginTitle") : t("auth.signupTitle")}
        </title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-violet-900/10 to-zinc-950 text-white flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md">
          <header className="text-center mb-8"></header>
          <motion.main
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-lg"
          >
            <main className="rounded-lg p-8 shadow-lg glass-card">
              <Link to="/" className="flex justify-center mb-6">
                <div className="auth-logo-container">
                  <MoodifyLogo />
                </div>
              </Link>
              <h1 className="text-2xl font-bold text-center mb-6">
                {isLoginView ? t("auth.loginTitle") : t("auth.signupTitle")}
              </h1>

              <Button
                onClick={handleGoogleSignIn}
                variant="outline"
                className="w-full h-12 border-zinc-700 hover:bg-zinc-800"
                disabled={isLoading}
              >
                <img
                  src="/google.svg"
                  alt={t("common.google")}
                  className="w-5 h-5 mr-3"
                />
                {t("auth.continueWithGoogle")}
              </Button>

              <div className="flex items-center my-6">
                <div className="flex-grow border-t border-zinc-700"></div>
                <span className="mx-4 text-zinc-500 text-sm">
                  {t("auth.or")}
                </span>
                <div className="flex-grow border-t border-zinc-700"></div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLoginView && (
                  <div>
                    <Label htmlFor="fullName">{t("auth.fullNameLabel")}</Label>
                    <Input
                      id="fullName"
                      name="fullName"
                      type="text"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder={t("auth.fullNamePlaceholder")}
                      required
                      className="mt-1"
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="email">{t("auth.emailLabel")}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder={t("auth.emailPlaceholder")}
                    required
                    maxLength={42}
                    className="mt-1"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="password">{t("auth.passwordLabel")}</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder={t("auth.passwordPlaceholder")}
                    required
                    minLength={6}
                    maxLength={42}
                    className="mt-1"
                  />
                  {errors.password && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.password}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 bg-violet-600 hover:bg-violet-700"
                  disabled={isLoading}
                >
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isLoginView ? t("auth.loginButton") : t("auth.signupButton")}
                </Button>
              </form>

              <div className="text-center mt-6 text-sm text-gray-400">
                {isLoginView ? (
                  <span>
                    {t("auth.promptSignup")}{" "}
                    <button
                      onClick={() => setIsLoginView(false)}
                      className="text-[#8b5cf6] hover:underline"
                    >
                      {t("auth.signupLink")}
                    </button>
                  </span>
                ) : (
                  <span>
                    {t("auth.promptLogin")}{" "}
                    <button
                      onClick={() => setIsLoginView(true)}
                      className="text-[#8b5cf6] hover:underline"
                    >
                      {t("auth.loginLink")}
                    </button>
                  </span>
                )}
              </div>
            </main>
          </motion.main>
        </div>
      </div>
    </>
  );
};

export default AuthPage;
