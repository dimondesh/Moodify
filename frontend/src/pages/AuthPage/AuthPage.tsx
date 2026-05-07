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
import MoodifyLogo from "../../components/MoodifyLogo";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";

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
      <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center px-4">
        <div className="w-full max-w-sm text-center">
          <MailCheck className="w-16 h-16 text-violet-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-4">
            {t("auth.verifyEmailTitle", "Подтвердите Email")}
          </h1>
          <p className="text-gray-400 mb-2">
            {t("auth.verifyEmailMessage1", "Мы отправили письмо на")}
          </p>
          <p className="text-white font-semibold mb-6">{formData.email}</p>
          <p className="text-gray-400 mb-8">
            {t(
              "auth.verifyEmailMessage2",
              "Проверьте входящую почту и подтвердите адрес",
            )}
          </p>
          <Button
            onClick={() => {
              setVerificationSent(false);
              setIsLoginView(true);
            }}
            className="w-full h-12 bg-violet-500 hover:bg-violet-600 text-black font-semibold rounded-full"
          >
            {t("auth.backToLogin", "Вернуться к входу")}
          </Button>
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
      <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col justify-center items-center px-4">
        <div className="w-full max-w-xs">
          {/* Logo */}
          <Link to="/" className="flex justify-center mb-8">
            <div className="w-10 h-10">
              <MoodifyLogo />
            </div>
          </Link>

          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              {isLoginView
                ? t("auth.loginTitle", "Вход")
                : t("auth.signupTitle", "Регистрация")}
            </h1>
            <p className="text-gray-400 text-sm">
              {isLoginView
                ? t("auth.loginSubtitle", "Войдите в свой аккаунт")
                : t("auth.signupSubtitle", "Создайте новый аккаунт")}
            </p>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-8">
            {!isLoginView && (
              <div>
                <Label
                  htmlFor="fullName"
                  className="text-sm text-gray-300 mb-2 block"
                >
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
                  className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 px-4 py-5 rounded-md focus:outline-none focus:border-violet-500 focus:ring-0! focus:ring-violet-500"
                />
              </div>
            )}

            {/* Email Field */}
            <div>
              <Label
                htmlFor="email"
                className="text-sm text-gray-300 mb-2 block"
              >
                {t("auth.emailLabel", "Email")}
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder={t("auth.emailPlaceholder", "your@email.com")}
                required
                maxLength={42}
                className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 px-4 py-5 rounded-md focus:outline-none focus:border-violet-500 focus:ring-0! focus:ring-violet-500"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-2">{errors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <Label
                htmlFor="password"
                className="text-sm text-gray-300 mb-2 block"
              >
                {t("auth.passwordLabel", "Пароль")}
              </Label>
              <div className="relative">
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
                  className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 px-4 py-5 pr-12 rounded-md focus:outline-none focus:border-violet-500 focus:ring-0! focus:ring-violet-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-2">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password Field (Signup) */}
            {!isLoginView && (
              <div>
                <Label
                  htmlFor="confirmPassword"
                  className="text-sm text-gray-300 mb-2 block"
                >
                  {t("auth.confirmPasswordLabel", "Подтвердите пароль")}
                </Label>
                <div className="relative">
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
                    className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 px-4 py-5 pr-12 rounded-md focus:outline-none focus:border-violet-500 focus:ring-0! focus:ring-violet-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
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
                  <p className="text-red-500 text-xs mt-2">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>
            )}

            {/* Forgot Password Link (Login) */}
            {isLoginView && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-violet-500 hover:text-violet-400 transition-colors"
                >
                  {t("auth.forgotPassword", "Забыли пароль?")}
                </button>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-12 bg-violet-500 hover:bg-violet-600 text-black font-bold rounded-full mt-6 flex items-center justify-center"
              disabled={isLoading}
            >
              {isLoginView
                ? t("auth.loginButton", "Войти")
                : t("auth.signupButton", "Зарегистрироваться")}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 h-px bg-gray-700"></div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">
              {t("auth.or", "или")}
            </span>
            <div className="flex-1 h-px bg-gray-700"></div>
          </div>

          {/* Google Sign In Button */}
          <Button
            onClick={handleGoogleSignIn}
            variant="outline"
            type="button"
            className="w-full h-12 border border-gray-700 text-white hover:bg-gray-900 hover:border-gray-600 rounded-full font-semibold transition-colors"
            disabled={isLoading}
          >
            <img
              src="/google.svg"
              alt={t("common.google", "Google")}
              className="w-5 h-5 mr-3"
            />
            {t("auth.continueWithGoogle", "Продолжить с Google")}
          </Button>

          {/* Toggle Login/Signup */}
          <div className="text-center mt-4 text-sm text-gray-400">
            {isLoginView ? (
              <span>
                {t("auth.promptSignup", "Нет аккаунта?")}{" "}
                <button
                  onClick={() => setIsLoginView(false)}
                  className="text-violet-500 hover:text-violet-400 font-semibold transition-colors"
                >
                  {t("auth.signupLink", "Зарегистрироваться")}
                </button>
              </span>
            ) : (
              <span>
                {t("auth.promptLogin", "Уже есть аккаунт?")}{" "}
                <button
                  onClick={() => setIsLoginView(true)}
                  className="text-violet-500 hover:text-violet-400 font-semibold transition-colors"
                >
                  {t("auth.loginLink", "Войти")}
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AuthPage;
