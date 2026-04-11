// frontend/src/pages/SettingsPage/SettingsPage.tsx

import React, { useEffect, useState } from "react";
import {
  defaultFrequencies,
  equalizerPresets,
  NormalizationMode,
  webAudioService,
  ReverbRoomSize,
  reverbIRPaths,
  useAudioSettingsStore,
  AnalyzerSmoothness,
} from "../../lib/webAudio";
import { RefreshCw } from "lucide-react";
import { Label } from "../../components/ui/label";
import { Slider } from "../../components/ui/slider";
import { Switch } from "../../components/ui/switch";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../stores/useAuthStore";
import { Helmet } from "react-helmet-async";
import { useOfflineStore } from "../../stores/useOfflineStore";
import toast from "react-hot-toast";
import { useUIStore } from "@/stores/useUIStore";
import {
  reauthenticateWithCredential,
  updatePassword,
  EmailAuthProvider,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import { Input } from "@/components/ui/input";

const SettingsPage: React.FC = () => {
  const {
    equalizerEnabled,
    equalizerGains,
    normalizationMode,
    waveAnalyzerEnabled,
    analyzerSmoothness,
    activePresetName,
    reverbEnabled,
    reverbMix,
    reverbRoomSize,
    playbackRateEnabled,
    playbackRate,
    isReduceMotionEnabled,
    setEqualizerEnabled,
    setEqualizerGain,
    setNormalizationMode,
    setWaveAnalyzerEnabled,
    setAnalyzerSmoothness,
    applyPreset,
    resetAudioSettings,
    setReverbEnabled,
    setReverbMix,
    setReverbRoomSize,
    setPlaybackRateEnabled,
    setPlaybackRate,
    setIsReduceMotionEnabled,
  } = useAudioSettingsStore();

  const { isIosDevice } = useUIStore();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // Добавлено состояние подтверждения

  const { t, i18n } = useTranslation();
  const {
    user,
    updateUserLanguage,
    updateUserPrivacy,
    updateRecentlyListenedArtistsPrivacy,
  } = useAuthStore();
  const isAnonymous = user?.isAnonymous ?? false;
  const showRecentlyListenedArtists = user?.showRecentlyListenedArtists ?? true;

  const frequencies = defaultFrequencies;

  useEffect(() => {
    if (
      webAudioService.getAudioContext() &&
      webAudioService.getAudioContext()?.state !== "closed"
    ) {
      webAudioService.applySettingsToGraph();
      console.log("SettingsPage mounted: Applied settings to audio graph.");
    }
  }, []);

  const handleSliderChange = (freq: string) => (value: number[]) => {
    setEqualizerGain(freq, value[0]);
  };
  const handleAnonymousToggle = async (checked: boolean) => {
    try {
      await updateUserPrivacy(checked);
      toast.success(
        checked ? t("toasts.anonymousEnabled") : t("toasts.anonymousDisabled"),
      );
    } catch {
      toast.error(t("toasts.privacyUpdateFailed"));
    }
  };

  const handleRecentlyListenedArtistsToggle = async (checked: boolean) => {
    try {
      await updateRecentlyListenedArtistsPrivacy(checked);
      toast.success(
        checked
          ? t("toasts.recentlyListenedArtistsEnabled")
          : t("toasts.recentlyListenedArtistsDisabled"),
      );
    } catch {
      toast.error(t("toasts.privacyUpdateFailed"));
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Проверка на совпадение паролей
    if (newPassword !== confirmPassword) {
      toast.error(t("settings.passwordsMismatch", "Новые пароли не совпадают"));
      return;
    }

    const user = auth.currentUser;

    if (!user || !user.email) return;

    try {
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, newPassword);

      toast.success(
        t(
          "settings.passwordChanged",
          "Пароль успешно изменен! Другие сессии будут закрыты.",
        ),
      );
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential"
      ) {
        toast.error(
          t("settings.wrongCurrentPassword", "Неверный текущий пароль"),
        );
      } else {
        toast.error("Ошибка при смене пароля: " + error.message);
      }
    }
  };

  const handlePresetChange = (presetName: string) => {
    const selectedPreset = equalizerPresets.find((p) => p.name === presetName);
    if (selectedPreset) {
      applyPreset(selectedPreset);
      if (!equalizerEnabled) {
        setEqualizerEnabled(true);
      }
    }
  };

  const handleReverbRoomSizeChange = (value: string) => {
    setReverbRoomSize(value as ReverbRoomSize);
    if (!reverbEnabled) {
      setReverbEnabled(true);
    }
  };
  const handleLanguageChange = async (lang: string) => {
    if (lang !== i18n.language) {
      await i18n.changeLanguage(lang);
      try {
        await updateUserLanguage(lang);
      } catch (error) {
        console.error("Failed to save language preference:", error);
      }
    }
  };
  const { getDownloadedContentSize, clearAllDownloads } = useOfflineStore(
    (s) => s.actions,
  );
  const downloadedItemIds = useOfflineStore((s) => s.downloadedItemIds);
  const downloadingItemIds = useOfflineStore((s) => s.downloadingItemIds);
  const [storageUsage, setStorageUsage] = useState({ usage: 0, quota: 0 });
  const [isCalculatingStorage, setIsCalculatingStorage] = useState(false);

  useEffect(() => {
    const calculateStorage = async () => {
      setIsCalculatingStorage(true);
      try {
        const usage = await getDownloadedContentSize();
        setStorageUsage(usage);
      } catch (error) {
        console.error("Failed to calculate storage usage:", error);
      } finally {
        setIsCalculatingStorage(false);
      }
    };

    const timeoutId = setTimeout(calculateStorage, 500);
    return () => clearTimeout(timeoutId);
  }, [getDownloadedContentSize, downloadedItemIds, downloadingItemIds]);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const handleRefreshStorage = async () => {
    setIsCalculatingStorage(true);
    try {
      const usage = await getDownloadedContentSize();
      setStorageUsage(usage);
    } catch (error) {
      console.error("Failed to refresh storage usage:", error);
      toast.error(t("settings.storageRefreshFailed"));
    } finally {
      setIsCalculatingStorage(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Settings</title>
        <meta
          name="description"
          content="Manage your language preferences and audio settings, including equalizer, reverb, and normalization, on Moodify."
        />
      </Helmet>
      <div className="min-h-screen relative pb-40 lg:pb-0">
        <div className="container mx-auto p-4 sm:p-6 md:p-8 max-w-2xl">
          <h1 className="text-3xl font-bold text-white mb-6">
            {t("settings.title")}
          </h1>

          <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white shadow-lg p-6 space-y-8 mb-8">
            <div>
              <Label className="text-xl font-semibold mb-4 block">
                {t("settings.language")}
              </Label>
              <Select
                value={i18n.language}
                onValueChange={handleLanguageChange}
              >
                <SelectTrigger className="w-full bg-[#2a2a2a] border-[#2a2a2a] text-white">
                  <SelectValue placeholder={t("settings.language")} />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
                  <SelectItem value="ru">Русский</SelectItem>
                  <SelectItem value="uk">Українська</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border-t border-[#2a2a2a] pt-8">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="anonymous-mode-toggle"
                  className="text-xl font-semibold"
                >
                  {t("settings.privacy.anonymousMode")}
                </Label>
                <Switch
                  id="anonymous-mode-toggle"
                  checked={isAnonymous}
                  onCheckedChange={handleAnonymousToggle}
                  className="data-[state=checked]:bg-violet-600"
                />
              </div>
              <p className="text-gray-400 text-sm mt-2">
                {t("settings.privacy.anonymousModeDesc")}
              </p>
            </div>
            <div className="border-t border-[#2a2a2a] pt-8">
              <div className="flex items-center justify-between mb-4">
                <Label className="text-xl font-semibold">
                  {t("settings.reduceMotion")}
                </Label>
                <Switch
                  id="reduceMotion-enabled"
                  checked={isReduceMotionEnabled}
                  onCheckedChange={setIsReduceMotionEnabled}
                  className="data-[state=checked]:bg-violet-600"
                />
              </div>
            </div>
            <div className="border-t border-[#2a2a2a] pt-8">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="recently-listened-artists-toggle"
                  className="text-xl font-semibold"
                >
                  {t("settings.privacy.showRecentlyListenedArtists")}
                </Label>
                <Switch
                  id="recently-listened-artists-toggle"
                  checked={showRecentlyListenedArtists}
                  onCheckedChange={handleRecentlyListenedArtistsToggle}
                  className="data-[state=checked]:bg-violet-600"
                />
              </div>
              <p className="text-gray-400 text-sm mt-2">
                {t("settings.privacy.showRecentlyListenedArtistsDesc")}
              </p>
            </div>
          </Card>

          <h1 className="text-3xl font-bold text-white mb-6 mt-8">
            {t("settings.securityTitle", "Безопасность")}
          </h1>
          <Card className="bg-[#1a1a1a] gap-0 py-4 border-[#2a2a2a] text-white shadow-lg mb-8 overflow-hidden">
            <div className="p-6 py-2 border-[#2a2a2a]">
              <h2 className="text-xl font-semibold">
                {t("settings.changePassword", "Смена пароля")}
              </h2>
            </div>

            <form onSubmit={handleChangePassword}>
              <div className="p-6 space-y-4">
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="oldPassword" className="text-gray-300">
                    {t("settings.oldPassword", "Текущий пароль")}
                  </Label>
                  <Input
                    id="oldPassword"
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="bg-[#2a2a2a] focus:ring-0! border-[#3a3a3a] text-white focus-visible:ring-violet-500"
                  />
                </div>

                <div className="space-y-2 max-w-md">
                  <Label htmlFor="newPassword" className="text-gray-300">
                    {t("settings.newPassword", "Новый пароль")}
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="bg-[#2a2a2a] border-[#3a3a3a] focus:ring-0! text-white focus-visible:ring-violet-500"
                  />
                </div>

                <div className="space-y-2 max-w-md">
                  <Label htmlFor="confirmPassword" className="text-gray-300">
                    {t("settings.confirmPassword", "Подтверждение пароля")}
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="bg-[#2a2a2a] border-[#3a3a3a] focus:ring-0! text-white focus-visible:ring-violet-500"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!oldPassword || !newPassword || !confirmPassword}
                  className="bg-violet-600 w-full hover:bg-violet-700 text-white min-w-[150px]"
                >
                  {t("settings.updatePasswordButton", "Сохранить пароль")}
                </Button>
              </div>
            </form>
          </Card>

          <h1 className="text-3xl font-bold text-white mb-6">
            {t("settings.audioTitle")}
          </h1>
          <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white shadow-lg p-6 space-y-8">
            {!isIosDevice && (
              <>
                {/* Equalizer Section */}
                <div className="border-b border-[#2a2a2a] pb-8">
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-xl font-semibold">
                      {t("settings.equalizer")}
                    </Label>
                    <Switch
                      id="equalizer-mode"
                      checked={equalizerEnabled}
                      onCheckedChange={setEqualizerEnabled}
                      className="data-[state=checked]:bg-violet-600"
                    />
                  </div>

                  {equalizerEnabled && (
                    <>
                      <div className="mb-4">
                        <Select
                          onValueChange={handlePresetChange}
                          value={activePresetName}
                        >
                          <SelectTrigger className="w-full bg-[#2a2a2a] border-[#3a3a3a] text-white">
                            <SelectValue
                              placeholder={t("settings.selectPreset")}
                            />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white max-h-60 overflow-y-auto">
                            {equalizerPresets.map((preset) => (
                              <SelectItem key={preset.name} value={preset.name}>
                                {t(`equalizerPresets.${preset.name}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-6 gap-2 sm:gap-3 md:gap-4 mt-4 justify-items-center">
                        {frequencies.map((freq) => (
                          <div
                            key={freq}
                            className="flex flex-col items-center gap-1 sm:gap-2 w-full"
                          >
                            <Label
                              htmlFor={`slider-${freq}`}
                              className="text-gray-400 text-[0.65rem] sm:text-xs whitespace-nowrap"
                            >
                              {freq} Hz
                            </Label>
                            <Slider
                              id={`slider-${freq}`}
                              min={-12}
                              max={12}
                              step={0.5}
                              value={[equalizerGains[freq] || 0]}
                              onValueChange={handleSliderChange(freq)}
                              className="h-24 w-2 vertical-slider relative"
                              orientation="vertical"
                            />
                            <span className="text-xs sm:text-sm text-zinc-300 whitespace-nowrap">
                              {equalizerGains[freq]?.toFixed(1)} dB
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Reverb Section */}
                <div className="border-b border-[#2a2a2a] pb-8">
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-xl font-semibold">
                      {t("settings.reverb")}
                    </Label>
                    <Switch
                      id="reverb-enabled"
                      checked={reverbEnabled}
                      onCheckedChange={setReverbEnabled}
                      className="data-[state=checked]:bg-violet-600"
                    />
                  </div>

                  {reverbEnabled && (
                    <>
                      <div className="mb-4">
                        <Label
                          htmlFor="reverb-room-size"
                          className="text-sm font-medium text-gray-400 mb-2 block"
                        >
                          {t("settings.roomSize")}
                        </Label>
                        <Select
                          value={reverbRoomSize}
                          onValueChange={handleReverbRoomSizeChange}
                        >
                          <SelectTrigger className="w-full bg-[#2a2a2a] border-[#3a3a3a] text-white">
                            <SelectValue
                              placeholder={t("settings.selectRoomSize")}
                            />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
                            {Object.keys(reverbIRPaths).map((size) => (
                              <SelectItem key={size} value={size}>
                                {t(
                                  `settings.${
                                    size as "small" | "medium" | "large"
                                  }`,
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="mb-4">
                        <Label
                          htmlFor="reverb-mix"
                          className="text-sm font-medium text-gray-400 mb-2 block"
                        >
                          {t("settings.dryWetMix")}
                        </Label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {t("settings.dry")}
                          </span>
                          <Slider
                            id="reverb-mix"
                            min={0}
                            max={100}
                            step={1}
                            value={[reverbMix * 100]}
                            onValueChange={(value) =>
                              setReverbMix(value[0] / 100)
                            }
                            className="flex-1 hover:cursor-grab active:cursor-grabbing"
                          />
                          <span className="text-xs text-gray-400">
                            {t("settings.wet")}
                          </span>
                          <span className="text-xs sm:text-sm text-zinc-300 whitespace-nowrap">
                            {(reverbMix * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {/* --- Playback Speed --- */}
            <div className="border-b border-[#2a2a2a] pb-8">
              <div className="flex items-center justify-between mb-4">
                <Label className="text-xl font-semibold">
                  {t("settings.playbackSpeed")}
                </Label>
                <Switch
                  id="playback-rate-enabled"
                  checked={playbackRateEnabled}
                  onCheckedChange={setPlaybackRateEnabled}
                  className="data-[state=checked]:bg-violet-600"
                />
              </div>
              <p className="text-gray-400 text-sm mt-2 mb-4">
                {t("settings.playbackSpeedDesc")}
              </p>

              <div className="flex items-center gap-4">
                <Slider
                  id="playback-rate-slider"
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={[playbackRate]}
                  onValueChange={(value) => setPlaybackRate(value[0])}
                  className="flex-1"
                  disabled={!playbackRateEnabled}
                />
                <span className="text-sm text-zinc-300 w-16 text-center">
                  {playbackRate.toFixed(2)}x
                </span>
              </div>
            </div>

            {/* Normalization & Wave Analyzer (conditionally rendered) */}
            {!isIosDevice && (
              <>
                <div className="border-b border-[#2a2a2a] pb-8">
                  <Label
                    htmlFor="normalization-mode-select"
                    className="text-xl font-semibold mb-4 block"
                  >
                    {t("settings.normalization")}
                  </Label>
                  <Select
                    value={normalizationMode}
                    onValueChange={(value: NormalizationMode) =>
                      setNormalizationMode(value)
                    }
                  >
                    <SelectTrigger className="w-full bg-[#2a2a2a] border-[#3a3a3a] text-white">
                      <SelectValue placeholder={t("settings.selectMode")} />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
                      <SelectItem value="off">{t("settings.off")}</SelectItem>
                      <SelectItem value="loud">{t("settings.loud")}</SelectItem>
                      <SelectItem value="normal">
                        {t("settings.normal")}
                      </SelectItem>
                      <SelectItem value="quiet">
                        {t("settings.quiet")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-gray-400 text-sm mt-2">
                    {t("settings.normalizationDesc")}
                  </p>
                </div>

                <div className="border-b border-[#2a2a2a] pb-8">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="wave-analyzer-toggle"
                      className="text-xl font-semibold"
                    >
                      {t("settings.waveAnalyzer")}
                    </Label>
                    <Switch
                      id="wave-analyzer-toggle"
                      checked={waveAnalyzerEnabled}
                      onCheckedChange={setWaveAnalyzerEnabled}
                      className="data-[state=checked]:bg-violet-600"
                    />
                  </div>
                  <p className="text-gray-400 text-sm mt-2 mb-4">
                    {t("settings.waveAnalyzerDesc")}
                  </p>

                  {/* --- Analyzer Smoothness Control --- */}
                  {waveAnalyzerEnabled && (
                    <div className="mt-4">
                      <Label className="text-sm font-medium text-gray-300 mb-3 block">
                        {t("settings.waveAnalyzerSmoothness")}
                      </Label>
                      <div className="flex">
                        {(
                          ["low", "medium", "high"] as AnalyzerSmoothness[]
                        ).map((mode, index, arr) => (
                          <button
                            key={mode}
                            onClick={() => setAnalyzerSmoothness(mode)}
                            className={`
                                  flex-1 py-2 px-4 text-sm font-medium transition-colors
                                  ${
                                    analyzerSmoothness === mode
                                      ? "bg-violet-600 text-white"
                                      : "bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a]"
                                  }
                                  ${index === 0 ? "rounded-l-md" : ""}
                                  ${index === arr.length - 1 ? "rounded-r-md" : ""}
                                  border-r border-[#1a1a1a] last:border-r-0
                                `}
                          >
                            {t(`settings.smoothness.${mode}`)}
                          </button>
                        ))}
                      </div>
                      <p className="text-yellow-500/80 text-xs mt-2">
                        {t("settings.smoothnessPerformance")}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Reset Settings */}
            {!isIosDevice && (
              <div>
                <Button
                  onClick={resetAudioSettings}
                  variant="outline"
                  className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-500 border-red-900/50 hover:border-red-800"
                >
                  {t("settings.resetAudio")}
                </Button>
                <p className="text-gray-400 text-sm mt-2 text-center">
                  {t("settings.resetAudioDesc")}
                </p>
              </div>
            )}
          </Card>

          <h1 className="text-3xl font-bold text-white mb-6 mt-8">
            {" "}
            {t("settings.downloads")}
          </h1>
          <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white shadow-lg p-6 space-y-8">
            <div>
              <div className="flex items-center justify-between mb-4">
                <Label className="text-xl font-semibold">
                  {t("settings.storage")}
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshStorage}
                  disabled={isCalculatingStorage}
                  className="text-gray-400 hover:text-white"
                >
                  <RefreshCw
                    className={`size-4 ${
                      isCalculatingStorage ? "animate-spin" : ""
                    }`}
                  />
                </Button>
              </div>
              <div className="bg-[#2a2a2a]/50 p-4 rounded-md">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">
                    {t("settings.downloadedContent")}
                  </span>
                  <span className="font-semibold">
                    {isCalculatingStorage ? (
                      <span className="text-gray-400">
                        {t("settings.calculating")}
                      </span>
                    ) : (
                      formatBytes(storageUsage.usage)
                    )}
                  </span>
                </div>
                <div className="w-full bg-[#1a1a1a] rounded-full h-2.5 mt-2 border border-[#3a3a3a]">
                  <div
                    className="bg-violet-600 h-2.5 rounded-full"
                    style={{
                      width: `${
                        (storageUsage.usage / storageUsage.quota) * 100
                      }%`,
                    }}
                  ></div>
                </div>
                <p className="text-xs text-zinc-500 mt-2 text-right">
                  {t("settings.totalAvailable") + " "}
                  {formatBytes(storageUsage.quota)}
                </p>
              </div>

              <div className="mt-6">
                <Button
                  onClick={clearAllDownloads}
                  variant="destructive"
                  className="w-full"
                >
                  {t("settings.clearAllDownloads")}
                </Button>
                <p className="text-gray-400 text-sm mt-2 text-center">
                  {t("settings.clearLabel")}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
};

export default SettingsPage;
