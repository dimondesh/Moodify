/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { useAuthStore } from "../../stores/useAuthStore";
import { axiosInstance } from "../../lib/axios";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Eye, EyeOff, ArrowLeft, Check, X } from "lucide-react";
import MoodifyLogo from "../../components/MoodifyLogo";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";

type AuthStep =
  | "email"
  | "login_password"
  | "signup_password"
  | "signup_name"
  | "verify_code"
  | "reset_password";

interface AuthPageProps {
  mode: "login" | "register";
}

/** Renders only when `VITE_GOOGLE_CLIENT_ID` is set and `GoogleOAuthProvider` wraps the app. */
function AuthGoogleOAuthButton({
  setIsLoading,
}: {
  setIsLoading: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const completeGoogleAccessToken = useAuthStore(
    (s) => s.completeGoogleAccessToken,
  );
  const setTempEmail = useAuthStore((s) => s.setTempEmail);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      try {
        await completeGoogleAccessToken(tokenResponse.access_token);
        setTempEmail("");
        toast.success(t("auth.loginSuccess"));
        navigate("/");
      } catch (error: unknown) {
        const err = error as { response?: { data?: { code?: string } } };
        const code = err?.response?.data?.code;
        if (code === "ACCOUNT_EXISTS_PASSWORD") {
          toast.error(t("auth.googleAccountExistsUsePassword"));
        } else {
          toast.error(t("auth.googleSignInFailed"));
        }
      } finally {
        setIsLoading(false);
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
      variant="outline"
      type="button"
      className="w-full h-12 border-gray-700 hover:bg-gray-900 rounded-full shrink-0"
    >
      <img src="/google.svg" alt="G" className="w-5 h-5 mr-3" />
      {t("auth.continueWithGoogle", "Google")}
    </Button>
  );
}

const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, tempEmail, setTempEmail } = useAuthStore();
  const registerAccount = useAuthStore((s) => s.registerAccount);
  const verifyEmailCode = useAuthStore((s) => s.verifyEmailCode);
  const resendVerificationEmail = useAuthStore((s) => s.resendVerificationEmail);
  const loginWithPassword = useAuthStore((s) => s.loginWithPassword);

  const rawStep = (searchParams.get("step") as AuthStep) || "email";
  let step = rawStep;

  if (mode === "login") {
    if (
      step === "signup_password" ||
      step === "signup_name" ||
      step === "verify_code"
    ) {
      step = "email";
    }
  } else if (mode === "register") {
    if (step === "login_password" || step === "reset_password") {
      step = "email";
    }
  }

  const [formData, setFormData] = useState({
    email: tempEmail || "",
    password: "",
    fullName: "",
    verifyCode: "",
    resetCode: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [errorItem, setErrorItem] = useState<React.ReactNode>("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  useEffect(() => {
    setErrorItem("");
    setFormData((prev) => ({
      ...prev,
      password: "",
      fullName: "",
      verifyCode: "",
      resetCode: "",
      newPassword: "",
      confirmPassword: "",
    }));
    if (searchParams.has("step")) {
      setSearchParams({});
    }
  }, [mode]);

  useEffect(() => {
    setErrorItem("");
  }, [step]);

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
      isValid: /[A-ZА-ЯЁІЇЄ]/.test(formData.password),
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

    if (name === "email") {
      setTempEmail(value);
    }

    setErrorItem("");
  };

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
          setSearchParams({ step: "login_password" });
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
          setSearchParams({ step: "signup_password" });
        }
      }
    } catch {
      toast.error(t("auth.checkEmailError", "Ошибка при проверке email"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await loginWithPassword(formData.email, formData.password);
      toast.success(t("auth.loginSuccess", "Успешный вход"));
      setTempEmail("");
      navigate("/");
    } catch (error: any) {
      const status = error?.response?.status;
      const code = error?.response?.data?.code;
      if (status === 403 && code === "EMAIL_NOT_VERIFIED") {
        toast.error(t("auth.verifyEmailPrompt"));
        setSearchParams({ step: "verify_code" });
      } else {
        setErrorItem(
          t("auth.errorInvalidCredentials", "Неверный логин или пароль"),
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setIsLoading(true);
    try {
      await axiosInstance.post("/auth/forgot-password", {
        email: formData.email.trim().toLowerCase(),
      });
      toast.success(t("auth.resetCodeSent"));
      setSearchParams({ step: "reset_password" });
    } catch {
      toast.error(t("auth.errorResetFailed", "Ошибка при отправке письма"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPasswordValid) setSearchParams({ step: "signup_name" });
  };

  const handleSignupComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim())
      return setErrorItem(t("auth.nameRequired", "Введите имя"));

    setIsLoading(true);
    try {
      await registerAccount(
        formData.email,
        formData.password,
        formData.fullName,
      );
      setTempEmail("");
      setSearchParams({ step: "verify_code" });
      toast.success(t("auth.verificationCodeSent"));
    } catch {
      toast.error(t("auth.errorAuthFailed", "Ошибка регистрации"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.verifyCode.trim()) {
      setErrorItem(t("auth.codeRequired"));
      return;
    }
    setIsLoading(true);
    try {
      await verifyEmailCode(formData.email, formData.verifyCode);
      toast.success(t("auth.loginSuccess"));
      setTempEmail("");
      navigate("/");
    } catch {
      setErrorItem(t("auth.codeInvalid"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    try {
      await resendVerificationEmail(formData.email);
      toast.success(t("auth.verificationCodeSent"));
    } catch {
      toast.error(t("auth.resendCodeFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error(t("auth.passwordsDoNotMatch"));
      return;
    }
    if (!isStrongPassword(formData.newPassword)) {
      setErrorItem(t("auth.passwordRulesHint"));
      return;
    }
    setIsLoading(true);
    try {
      await axiosInstance.post("/auth/reset-password", {
        email: formData.email.trim().toLowerCase(),
        code: formData.resetCode.trim(),
        newPassword: formData.newPassword,
      });
      toast.success(t("auth.passwordUpdated"));
      setSearchParams({ step: "login_password" });
      setFormData((prev) => ({
        ...prev,
        resetCode: "",
        newPassword: "",
        confirmPassword: "",
      }));
    } catch {
      toast.error(t("auth.resetPasswordFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  function isStrongPassword(p: string) {
    if (!p || p.length < 8) return false;
    if (!/[A-ZА-ЯЁІЇЄ]/.test(p)) return false;
    if (!/[0-9]/.test(p)) return false;
    return true;
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
      <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col justify-center items-center px-4 py-8">
        <div className="w-full max-w-[340px] relative flex flex-col min-h-[550px]">
          {step !== "email" && (
            <button
              onClick={() => {
                if (step === "signup_name")
                  setSearchParams({ step: "signup_password" });
                else if (step === "verify_code") {
                  if (mode === "register") setSearchParams({});
                  else setSearchParams({ step: "login_password" });
                } else if (step === "reset_password")
                  setSearchParams({ step: "login_password" });
                else setSearchParams({});
              }}
              className="absolute -left-12 top-0 p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors z-10 hidden sm:block"
            >
              <ArrowLeft size={24} />
            </button>
          )}

          <Link to="/" className="flex justify-center mb-8 shrink-0">
            <div className="w-10 h-10">
              <MoodifyLogo isWhite />
            </div>
          </Link>

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

              {googleClientId ? (
                <AuthGoogleOAuthButton setIsLoading={setIsLoading} />
              ) : (
                <Button
                  onClick={() =>
                    toast.error(t("auth.googleNotConfigured"))
                  }
                  variant="outline"
                  type="button"
                  className="w-full h-12 border-gray-700 hover:bg-gray-900 rounded-full shrink-0"
                >
                  <img src="/google.svg" alt="G" className="w-5 h-5 mr-3" />
                  {t("auth.continueWithGoogle", "Google")}
                </Button>
              )}

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

          {step === "verify_code" && (
            <form onSubmit={handleVerifySubmit} className="flex flex-col flex-1">
              <div className="text-center mb-8 h-[80px] flex flex-col items-center justify-start shrink-0">
                <h1 className="text-3xl font-bold mb-2">
                  {t("auth.verifyCodeTitle")}
                </h1>
                <p className="text-gray-400 text-sm">{formData.email}</p>
              </div>
              <p className="text-gray-400 text-sm mb-4 text-center">
                {t("auth.verifyCodeHint")}
              </p>
              <div>
                <Label
                  htmlFor="verifyCode"
                  className="text-sm text-gray-300 mb-2 block"
                >
                  {t("auth.verifyCodeLabel")}
                </Label>
                <Input
                  id="verifyCode"
                  name="verifyCode"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={formData.verifyCode}
                  onChange={handleChange}
                  className="bg-gray-900 border-gray-700 py-6 text-center text-2xl tracking-[0.4em]"
                />
                <div className="min-h-[24px] mt-2">
                  {errorItem && (
                    <div className="text-red-500 text-xs">{errorItem}</div>
                  )}
                </div>
              </div>
              <Button
                type="submit"
                disabled={isLoading || formData.verifyCode.trim().length < 6}
                className="w-full h-12 bg-violet-500 hover:bg-violet-600 text-black font-bold rounded-full mt-4 shrink-0"
              >
                {t("auth.verifyCodeSubmit")}
              </Button>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isLoading}
                className="mt-4 text-sm text-violet-500 hover:underline text-center"
              >
                {t("auth.resendCode")}
              </button>
            </form>
          )}

          {step === "reset_password" && (
            <form
              onSubmit={handleResetPasswordSubmit}
              className="flex flex-col flex-1 gap-4"
            >
              <div className="text-center mb-4 shrink-0">
                <h1 className="text-3xl font-bold mb-2">
                  {t("auth.resetPasswordTitle")}
                </h1>
                <p className="text-gray-400 text-sm">{formData.email}</p>
              </div>
              <p className="text-gray-400 text-sm text-center">
                {t("auth.resetPasswordHint")}
              </p>
              <div>
                <Label className="text-sm text-gray-300 mb-2 block">
                  {t("auth.verifyCodeLabel")}
                </Label>
                <Input
                  name="resetCode"
                  inputMode="numeric"
                  maxLength={6}
                  value={formData.resetCode}
                  onChange={handleChange}
                  className="bg-gray-900 border-gray-700 py-6 text-center text-xl tracking-widest"
                />
              </div>
              <div>
                <Label className="text-sm text-gray-300 mb-2 block">
                  {t("auth.newPasswordLabel")}
                </Label>
                <Input
                  name="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={handleChange}
                  className="bg-gray-900 border-gray-700 py-6"
                />
              </div>
              <div>
                <Label className="text-sm text-gray-300 mb-2 block">
                  {t("auth.confirmPasswordLabel")}
                </Label>
                <Input
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="bg-gray-900 border-gray-700 py-6"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-violet-500 hover:bg-violet-600 text-black font-bold rounded-full shrink-0"
              >
                {t("auth.saveNewPassword")}
              </Button>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default AuthPage;
