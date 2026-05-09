/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useAuthStore } from "../../stores/useAuthStore";
import { axiosInstance } from "../../lib/axios";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { MailCheck, Eye, EyeOff, ArrowLeft, Check, X } from "lucide-react";
import MoodifyLogo from "../../components/MoodifyLogo";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";

type AuthStep = "email" | "login_password" | "signup_password" | "signup_name";

interface AuthPageProps {
  mode: "login" | "register";
}

const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [step, setStep] = useState<AuthStep>("email");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
  });

  const [errorItem, setErrorItem] = useState<React.ReactNode>("");
  const [isLoading, setIsLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Сброс состояния при смене роута (логин/регистрация)
  useEffect(() => {
    setStep("email");
    setErrorItem("");
    setFormData({ email: "", password: "", fullName: "" });
  }, [mode]);

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const passwordRules = [
    {
      id: "length",
      text: t("auth.ruleLength", "Минимум 8 символов"),
      isValid: formData.password.length >= 8,
    },
    {
      id: "uppercase",
      text: t("auth.ruleUppercase", "Хотя бы одна заглавная буква"),
      isValid: /[A-ZА-Я]/.test(formData.password),
    },
    {
      id: "number",
      text: t("auth.ruleNumber", "Хотя бы одна цифра"),
      isValid: /[0-9]/.test(formData.password),
    },
  ];

  const isPasswordValid = passwordRules.every((rule) => rule.isValid);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrorItem("");
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      navigate("/");
    } catch (error: any) {
      if (error.code !== "auth/popup-closed-by-user") {
        toast.error(
          t("auth.googleSignInFailed", "Ошибка авторизации через Google"),
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ШАГ 1: Проверка Email
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email)
      return setErrorItem(t("auth.emailRequired", "Email обязателен"));
    if (!/\S+@\S+\.\S+/.test(formData.email))
      return setErrorItem(t("auth.emailInvalid", "Неверный формат"));

    setIsLoading(true);
    try {
      const response = await axiosInstance.post("/auth/check-email", {
        email: formData.email,
      });
      const exists = response.data.exists;

      if (mode === "login") {
        if (exists) {
          setStep("login_password");
        } else {
          setErrorItem(
            <div className="flex flex-col gap-1">
              <span>{t("auth.errorUserNotFound", "Аккаунт не найден.")}</span>
              <Link
                to="/register"
                className="text-violet-500 hover:underline font-medium"
              >
                {t("auth.linkCreateAccount", "Создать новый?")}
              </Link>
            </div>,
          );
        }
      } else {
        if (exists) {
          setErrorItem(
            <div className="flex flex-col gap-1">
              <span>{t("auth.errorEmailInUse", "Этот email уже занят.")}</span>
              <Link
                to="/login"
                className="text-violet-500 hover:underline font-medium"
              >
                {t("auth.linkLoginInstead", "Войти в аккаунт?")}
              </Link>
            </div>,
          );
        } else {
          setStep("signup_password");
        }
      }
    } catch (error) {
      toast.error(t("auth.checkEmailError", "Ошибка при проверке email"));
    } finally {
      setIsLoading(false);
    }
  };

  // ШАГ 2 (Вход): Пароль
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, formData.email, formData.password);
      toast.success(t("auth.loginSuccess", "Успешный вход"));
      navigate("/");
    } catch (error: any) {
      setErrorItem(t("auth.errorInvalidCredentials", "Неверный пароль"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
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
      toast.error(t("auth.errorResetFailed", "Ошибка при отправке письма"));
    } finally {
      setIsLoading(false);
    }
  };

  // ШАГ 2 (Рега): Создание пароля
  const handleSignupPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPasswordValid) setStep("signup_name");
  };

  // ШАГ 3 (Рега): Имя и финиш
  const handleSignupComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim())
      return setErrorItem(t("auth.nameRequired", "Введите имя"));

    setIsLoading(true);
    try {
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
      setVerificationSent(true);
    } catch (error: any) {
      toast.error(t("auth.errorAuthFailed", "Ошибка регистрации"));
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
            {t("auth.verifyEmailTitle", "Подтвердите почту")}
          </h1>
          <p className="text-gray-400 mb-6">
            {t("auth.verifyEmailMessage", "Мы отправили письмо на")}{" "}
            <span className="text-white font-semibold">{formData.email}</span>
          </p>
          <Button
            onClick={() => navigate("/login")}
            className="w-full h-12 bg-violet-500 hover:bg-violet-600 text-black font-bold rounded-full"
          >
            {t("auth.backToLogin", "К авторизации")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>
          {mode === "login"
            ? t("auth.loginTitle", "Вход")
            : t("auth.registerTitle", "Регистрация")}{" "}
          - Moodify
        </title>
      </Helmet>
      {/* Главный контейнер выравнивает контент по центру экрана */}
      <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col justify-center items-center px-4 py-8">
        {/* Фиксируем высоту и ширину формы, чтобы предотвратить "прыжки" */}
        <div className="w-full max-w-[340px] relative flex flex-col min-h-[550px]">
          {step !== "email" && (
            <button
              onClick={() => {
                if (step === "signup_name") setStep("signup_password");
                else setStep("email");
                setErrorItem("");
              }}
              className="absolute left-0 top-0 p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors z-10"
            >
              <ArrowLeft size={24} />
            </button>
          )}

          <Link to="/" className="flex justify-center mb-8 shrink-0">
            <div className="w-10 h-10">
              <MoodifyLogo />
            </div>
          </Link>

          {/* ШАГ: EMAIL */}
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="flex flex-col flex-1">
              <div className="text-center mb-8 h-[80px] flex flex-col items-center justify-start shrink-0">
                <h1 className="text-3xl font-bold mb-2">
                  {mode === "login"
                    ? t("auth.loginWelcome", "С возвращением")
                    : t("auth.registerWelcome", "Создать аккаунт")}
                </h1>
              </div>

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
                  required
                  className="bg-gray-900 border-gray-700 py-6"
                />
                <div className="min-h-[24px] mt-2">
                  {errorItem && (
                    <div className="text-red-500 text-xs">{errorItem}</div>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-violet-500 hover:bg-violet-600 text-black font-bold rounded-full mt-2 shrink-0"
              >
                {t("common.continue", "Продолжить")}
              </Button>

              <div className="flex items-center gap-2 my-4 shrink-0">
                <div className="flex-1 h-px bg-gray-700"></div>
                <span className="text-xs text-gray-500 uppercase">
                  {t("auth.or", "или")}
                </span>
                <div className="flex-1 h-px bg-gray-700"></div>
              </div>

              <Button
                onClick={handleGoogleSignIn}
                variant="outline"
                type="button"
                className="w-full h-12 border-gray-700 hover:bg-gray-900 rounded-full shrink-0"
              >
                <img src="/google.svg" alt="G" className="w-5 h-5 mr-3" />
                {t("auth.continueWithGoogle", "Google")}
              </Button>

              <p className="text-center text-sm text-gray-400 mt-6 shrink-0">
                {mode === "login" ? (
                  <>
                    {t("auth.noAccount", "Нет аккаунта?")}{" "}
                    <Link
                      to="/register"
                      className="text-violet-500 hover:underline"
                    >
                      {t("auth.signUp", "Зарегистрироваться")}
                    </Link>
                  </>
                ) : (
                  <>
                    {t("auth.haveAccount", "Есть аккаунт?")}{" "}
                    <Link
                      to="/login"
                      className="text-violet-500 hover:underline"
                    >
                      {t("auth.signIn", "Войти")}
                    </Link>
                  </>
                )}
              </p>
            </form>
          )}

          {/* ШАГ: ПАРОЛЬ (ЛОГИН) */}
          {step === "login_password" && (
            <form onSubmit={handleLoginSubmit} className="flex flex-col flex-1">
              <div className="text-center mb-8 h-[80px] flex flex-col items-center justify-start shrink-0">
                <h1 className="text-3xl font-bold mb-2">
                  {t("auth.loginTitle", "Вход")}
                </h1>
                <p className="text-gray-400 text-sm">{formData.email}</p>
              </div>

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
                    required
                    className="bg-gray-900 border-gray-700 py-6 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div className="flex justify-between items-start min-h-[24px] mt-2">
                  <div className="text-red-500 text-xs flex-1 pr-2">
                    {errorItem}
                  </div>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-violet-500 hover:text-violet-400 shrink-0 mt-0.5"
                  >
                    {t("auth.forgotPassword", "Забыли пароль?")}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-violet-500 hover:bg-violet-600 text-black font-bold rounded-full mt-4 shrink-0"
              >
                {t("auth.loginButton", "Войти")}
              </Button>
            </form>
          )}

          {/* ШАГ: ПАРОЛЬ (РЕГА) */}
          {step === "signup_password" && (
            <form
              onSubmit={handleSignupPasswordSubmit}
              className="flex flex-col flex-1"
            >
              <div className="text-center mb-8 h-[80px] flex flex-col items-center justify-start shrink-0">
                <h1 className="text-3xl font-bold mb-2">
                  {t("auth.createPasswordTitle", "Придумайте пароль")}
                </h1>
                <p className="text-gray-400 text-sm">{formData.email}</p>
              </div>

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
                    required
                    className="bg-gray-900 border-gray-700 py-6 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800 space-y-2 mt-6 shrink-0">
                {passwordRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center text-sm transition-colors duration-300"
                  >
                    {rule.isValid ? (
                      <Check
                        size={16}
                        className="text-green-500 mr-2 flex-shrink-0"
                      />
                    ) : (
                      <X
                        size={16}
                        className="text-gray-600 mr-2 flex-shrink-0"
                      />
                    )}
                    <span
                      className={rule.isValid ? "text-white" : "text-gray-500"}
                    >
                      {rule.text}
                    </span>
                  </div>
                ))}
              </div>

              <Button
                type="submit"
                disabled={!isPasswordValid || isLoading}
                className="w-full h-12 bg-violet-500 hover:bg-violet-600 text-black font-bold rounded-full mt-6 shrink-0 disabled:opacity-50"
              >
                {t("common.next", "Далее")}
              </Button>
            </form>
          )}

          {/* ШАГ: ИМЯ (РЕГА) */}
          {step === "signup_name" && (
            <form
              onSubmit={handleSignupComplete}
              className="flex flex-col flex-1"
            >
              <div className="text-center mb-8 h-[80px] flex flex-col items-center justify-start shrink-0">
                <h1 className="text-3xl font-bold mb-2">
                  {t("auth.whatsYourName", "Как вас зовут?")}
                </h1>
                <p className="text-gray-400 text-sm">
                  {t("auth.nameSubtitle", "Это имя будет в профиле")}
                </p>
              </div>

              <div>
                <Label
                  htmlFor="fullName"
                  className="text-sm text-gray-300 mb-2 block"
                >
                  {t("auth.fullNameLabel", "Имя")}
                </Label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  placeholder={t("auth.namePlaceholder", "John Doe")}
                  className="bg-gray-900 border-gray-700 py-6"
                />
                <div className="min-h-[24px] mt-2">
                  {errorItem && (
                    <div className="text-red-500 text-xs">{errorItem}</div>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading || !formData.fullName.trim()}
                className="w-full h-12 bg-violet-500 hover:bg-violet-600 text-black font-bold rounded-full mt-2 shrink-0"
              >
                {t("auth.createAccount", "Создать аккаунт")}
              </Button>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default AuthPage;
