import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import toast from "react-hot-toast";
import { ArrowLeft, Check, Eye, EyeOff, X } from "lucide-react";
import MoodifyLogo from "@/components/MoodifyLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/useAuthStore";

function isStrongPassword(p: string) {
  if (!p || p.length < 8) return false;
  if (!/[A-ZА-ЯЁІЇЄ]/.test(p)) return false;
  if (!/[0-9]/.test(p)) return false;
  return true;
}

const ChangePasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, changePassword, logout } = useAuthStore();
  const hasPassword = user?.hasPassword ?? true;

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorItem, setErrorItem] = useState("");

  useEffect(() => {
    if (!user || !hasPassword) {
      navigate("/settings", { replace: true });
    }
  }, [user, hasPassword, navigate]);

  const passwordRules = [
    {
      id: "length",
      text: t("auth.ruleLength", "Минимум 8 символов"),
      isValid: newPassword.length >= 8,
    },
    {
      id: "uppercase",
      text: t("auth.ruleUppercase", "Хотя бы одна заглавная буква"),
      isValid: /[A-ZА-ЯЁІЇЄ]/.test(newPassword),
    },
    {
      id: "number",
      text: t("auth.ruleNumber", "Хотя бы одна цифра"),
      isValid: /[0-9]/.test(newPassword),
    },
  ];

  const isPasswordValid = passwordRules.every((rule) => rule.isValid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorItem("");

    if (newPassword !== confirmPassword) {
      toast.error(t("settings.passwordsMismatch"));
      return;
    }

    if (!isStrongPassword(newPassword)) {
      setErrorItem(t("auth.passwordRulesHint"));
      return;
    }

    if (!user) return;

    setIsLoading(true);
    try {
      await changePassword(oldPassword, newPassword);
      toast.success(t("settings.passwordChangedRelogin"));
      await logout();
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { error?: string } };
      };
      const msg = err?.response?.data?.error || "";
      if (
        err?.response?.status === 401 ||
        msg.toLowerCase().includes("incorrect")
      ) {
        setErrorItem(t("settings.wrongCurrentPassword"));
      } else if (msg.toLowerCase().includes("requirements")) {
        setErrorItem(t("auth.passwordRulesHint"));
      } else {
        toast.error(t("settings.passwordChangeFailed"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!user || !hasPassword) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>{t("changePassword.title")} · Moodify Music</title>
      </Helmet>
      <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col justify-center items-center px-4 py-8">
        <div className="w-full max-w-[340px] relative flex flex-col min-h-[550px]">
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="absolute -left-12 top-0 p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors z-10 hidden sm:block"
            aria-label={t("changePassword.backToSettings")}
          >
            <ArrowLeft size={24} />
          </button>

          <Link to="/" className="flex justify-center mb-8 shrink-0">
            <div className="w-10 h-10">
              <MoodifyLogo isWhite />
            </div>
          </Link>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1">
            <div className="text-center mb-8 h-[80px] flex flex-col items-center justify-start shrink-0">
              <h1 className="text-3xl font-bold mb-2">
                {t("changePassword.title")}
              </h1>
              <p className="text-gray-400 text-sm">{user.email}</p>
            </div>

            <p className="text-gray-400 text-sm text-center mb-4 shrink-0">
              {t("changePassword.hint")}
            </p>

            <div>
              <Label
                htmlFor="oldPassword"
                className="text-sm text-gray-300 mb-2 block"
              >
                {t("settings.oldPassword")}
              </Label>
              <div className="relative">
                <Input
                  id="oldPassword"
                  type={showOldPassword ? "text" : "password"}
                  value={oldPassword}
                  onChange={(e) => {
                    setOldPassword(e.target.value);
                    setErrorItem("");
                  }}
                  required
                  autoComplete="current-password"
                  className="bg-gray-900 border-gray-700 py-6 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <Label
                htmlFor="newPassword"
                className="text-sm text-gray-300 mb-2 block"
              >
                {t("settings.newPassword")}
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="bg-gray-900 border-gray-700 py-6 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <Label
                htmlFor="confirmPassword"
                className="text-sm text-gray-300 mb-2 block"
              >
                {t("settings.confirmPassword")}
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="bg-gray-900 border-gray-700 py-6 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
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
                    <X size={16} className="text-gray-600 mr-2 flex-shrink-0" />
                  )}
                  <span
                    className={rule.isValid ? "text-white" : "text-gray-500"}
                  >
                    {rule.text}
                  </span>
                </div>
              ))}
            </div>

            <div className="min-h-[24px] mt-2">
              {errorItem && (
                <div className="text-red-500 text-xs">{errorItem}</div>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading || !isPasswordValid}
              className="w-full h-12 bg-violet-500 hover:bg-violet-600 text-black font-bold rounded-full mt-4 shrink-0 disabled:opacity-50"
            >
              {t("settings.updatePasswordButton")}
            </Button>

            <button
              type="button"
              onClick={() => navigate("/settings")}
              className="mt-6 text-sm text-violet-500 hover:underline text-center sm:hidden"
            >
              {t("changePassword.backToSettings")}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default ChangePasswordPage;
