import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
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
import { MailCheck, Eye, EyeOff } from "lucide-react";
import StandardLoader from "../../components/ui/StandardLoader";
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
    location.state?.mode !== "signup",
  );

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const validateEmail = (email: string) => {
    if (!email) return t("auth.emailRequired", "Email обязателен");
    if (email.length > 42)
      return t("auth.emailMaxLength", "Слишком длинный email");
    if (!/\S+@\S+\.\S+/.test(email))
      return t("auth.emailInvalid", "Неверный формат email");
    return "";
  };

  const validatePassword = (password: string) => {
    if (!password) return t("auth.passwordRequired", "Пароль обязателен");
    if (password.length < 6)
      return t("auth.passwordMinLength", "Минимум 6 символов");
    if (password.length > 20)
      return t("auth.passwordMaxLength", "Максимум 20 символов");
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
    } catch (error: unknown) {
      const authError = error as AuthError;
      if (authError.code !== "auth/popup-closed-by-user") {
        toast.error(
          t("auth.googleSignInFailed", "Ошибка авторизации через Google"),
        );
        console.error("Google sign-in error:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const emailError = validateEmail(formData.email);
    if (emailError) {
      setErrors((prev) => ({
        ...prev,
        email: t("auth.enterEmailToReset", "Введите email для сброса пароля"),
      }));
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, formData.email);
      toast.success(
        t(
          "auth.resetEmailSent",
          "Письмо со ссылкой для сброса пароля отправлено!",
        ),
      );
    } catch (error: unknown) {
      const authError = error as AuthError;
      if (authError.code === "auth/user-not-found") {
        toast.error(
          t("auth.errorUserNotFound", "Пользователь с таким email не найден"),
        );
      } else {
        toast.error(t("auth.errorResetFailed", "Ошибка при отправке письма"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);

    let confirmError = "";
    if (!isLoginView && formData.password !== formData.confirmPassword) {
      confirmError = t("auth.passwordsDoNotMatch", "Пароли не совпадают");
    }

    if (emailError || passwordError || confirmError) {
      setErrors({
        email: emailError,
        password: passwordError,
        confirmPassword: confirmError,
      });
      return;
    }

    setIsLoading(true);

    try {
      if (isLoginView) {
        await signInWithEmailAndPassword(
          auth,
          formData.email,
          formData.password,
        );
        toast.success(t("auth.loginSuccess", "Успешный вход"));
        navigate("/");
      } else {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password,
        );
        await updateProfile(userCredential.user, {
          displayName: formData.fullName,
        });
        await sendEmailVerification(userCredential.user);
        await signOut(auth);

        toast.success(t("auth.signupSuccess", "Успешная регистрация"));
        setVerificationSent(true);
      }
    } catch (error) {
      const authError = error as AuthError;
      let errorMessage = "An unknown error occurred.";
      switch (authError.code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          errorMessage = t(
            "auth.errorInvalidCredentials",
            "Неверный логин или пароль",
          );
          break;
        case "auth/email-already-in-use":
          errorMessage = t("auth.errorEmailInUse", "Email уже используется");
          break;
        case "auth/invalid-email":
          errorMessage = t("auth.errorInvalidEmail", "Неверный формат Email");
          break;
        default:
          errorMessage = t("auth.errorAuthFailed", "Ошибка авторизации");
      }
      toast.error(errorMessage);
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
          {isLoginView
            ? t("auth.loginTitle", "Вход")
            : t("auth.signupTitle", "Регистрация")}
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
                {isLoginView
                  ? t("auth.loginTitle", "Вход")
                  : t("auth.signupTitle", "Регистрация")}
              </h1>

              <Button
                onClick={handleGoogleSignIn}
                variant="outline"
                type="button"
                className="w-full h-12 border-zinc-700 hover:bg-zinc-800"
                disabled={isLoading}
              >
                <img
                  src="/google.svg"
                  alt={t("common.google")}
                  className="w-5 h-5 mr-3"
                />
                {t("auth.continueWithGoogle", "Продолжить с Google")}
              </Button>

              <div className="flex items-center my-6">
                <div className="flex-grow border-t border-zinc-700"></div>
                <span className="mx-4 text-zinc-500 text-sm">
                  {t("auth.or", "или")}
                </span>
                <div className="flex-grow border-t border-zinc-700"></div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLoginView && (
                  <div>
                    <Label htmlFor="fullName">
                      {t("auth.fullNameLabel", "Полное имя")}
                    </Label>
                    <Input
                      id="fullName"
                      name="fullName"
                      type="text"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder={t("auth.fullNamePlaceholder", "Иван Иванов")}
                      required
                      className="mt-1"
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="email">{t("auth.emailLabel", "Email")}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder={t("auth.emailPlaceholder", "your@email.com")}
                    required
                    maxLength={42}
                    className="mt-1"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="password">
                    {t("auth.passwordLabel", "Пароль")}
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder={t("auth.passwordPlaceholder", "••••••••")}
                      required
                      minLength={6}
                      maxLength={42}
                      className="pr-10" // Отступ справа, чтобы текст не залезал на иконку
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.password}
                    </p>
                  )}
                </div>

                {!isLoginView && (
                  <div>
                    <Label htmlFor="confirmPassword">
                      {t("auth.confirmPasswordLabel", "Подтвердите пароль")}
                    </Label>
                    <div className="relative mt-1">
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder={t(
                          "auth.confirmPasswordPlaceholder",
                          "••••••••",
                        )}
                        required={!isLoginView}
                        minLength={6}
                        maxLength={42}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>
                )}

                {isLoginView && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-sm text-[#8b5cf6] hover:underline"
                    >
                      {t("auth.forgotPassword", "Забыли пароль?")}
                    </button>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 bg-violet-600 hover:bg-violet-700"
                  disabled={isLoading}
                >
                  {isLoading && <StandardLoader size="sm" className="mr-2" />}
                  {isLoginView
                    ? t("auth.loginButton", "Войти")
                    : t("auth.signupButton", "Зарегистрироваться")}
                </Button>
              </form>

              <div className="text-center mt-6 text-sm text-gray-400">
                {isLoginView ? (
                  <span>
                    {t("auth.promptSignup", "Нет аккаунта?")}{" "}
                    <button
                      onClick={() => setIsLoginView(false)}
                      className="text-[#8b5cf6] hover:underline"
                    >
                      {t("auth.signupLink", "Зарегистрироваться")}
                    </button>
                  </span>
                ) : (
                  <span>
                    {t("auth.promptLogin", "Уже есть аккаунт?")}{" "}
                    <button
                      onClick={() => setIsLoginView(true)}
                      className="text-[#8b5cf6] hover:underline"
                    >
                      {t("auth.loginLink", "Войти")}
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
