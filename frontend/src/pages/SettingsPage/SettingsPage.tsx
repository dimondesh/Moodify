// frontend/src/pages/SettingsPage/SettingsPage.tsx

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  defaultFrequencies,
  equalizerPresets,
  NormalizationMode,
  PlaybackRatePreset,
  webAudioService,
  ReverbRoomSize,
  reverbIRPaths,
  useAudioSettingsStore,
} from "../../lib/webAudio";
import { RefreshCw, ChevronRight } from "lucide-react";
import { Label } from "../../components/ui/label";
import { Slider } from "../../components/ui/slider";
import { Switch } from "../../components/ui/switch";
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
import { usePlayerStore } from "../../stores/usePlayerStore";
import type { SmartShuffleRepeatMode } from "../../lib/smartShuffleContext";
import { Helmet } from "react-helmet-async";
import { useOfflineStore } from "../../stores/useOfflineStore";
import toast from "react-hot-toast";
import { useUIStore } from "@/stores/useUIStore";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SettingsSection } from "./SettingsSection";
import { SettingsRow } from "./SettingsRow";
import { SettingsSubRow } from "./SettingsSubRow";

const compactSelectTriggerClass =
  "w-auto min-w-[140px] bg-zinc-800/50 border-[#3a3a3a] text-white";

const SettingsPage: React.FC = () => {
  const {
    equalizerEnabled,
    equalizerGains,
    normalizationMode,
    waveAnalyzerEnabled,
    activePresetName,
    reverbEnabled,
    reverbRoomSize,
    playbackRateEnabled,
    playbackRatePreset,
    playbackRate,
    isReduceMotionEnabled,
    setEqualizerEnabled,
    setEqualizerGain,
    setNormalizationMode,
    setWaveAnalyzerEnabled,
    applyPreset,
    resetAudioSettings,
    setReverbEnabled,
    setReverbRoomSize,
    setPlaybackRateEnabled,
    setPlaybackRatePreset,
    setPlaybackRate,
    setIsReduceMotionEnabled,
  } = useAudioSettingsStore();

  const smartShuffleRepeatMode = usePlayerStore(
    (s) => s.smartShuffleRepeatMode,
  );
  const setSmartShuffleRepeatMode = usePlayerStore(
    (s) => s.setSmartShuffleRepeatMode,
  );
  const autoplayEnabled = usePlayerStore((s) => s.autoplayEnabled);
  const setAutoplayEnabled = usePlayerStore((s) => s.setAutoplayEnabled);

  const { isIosDevice } = useUIStore();
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const { t, i18n } = useTranslation();
  const {
    user,
    updateUserLanguage,
    updateUserPrivacy,
    updateRecentlyListenedArtistsPrivacy,
    deleteAccount,
  } = useAuthStore();
  const isAnonymous = user?.isAnonymous ?? false;
  const hasPassword = user?.hasPassword ?? true;
  const isAdmin = user?.isAdmin ?? false;
  const showRecentlyListenedArtists = user?.showRecentlyListenedArtists ?? true;

  const frequencies = defaultFrequencies;

  useEffect(() => {
    if (
      webAudioService.getAudioContext() &&
      webAudioService.getAudioContext()?.state !== "closed"
    ) {
      webAudioService.applySettingsToGraph();
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

  const resetDeleteAccountDialog = () => {
    setDeletePassword("");
    setDeleteConfirmEmail("");
    setIsDeletingAccount(false);
  };

  const handleDeleteAccountDialogChange = (open: boolean) => {
    setDeleteAccountOpen(open);
    if (!open) resetDeleteAccountDialog();
  };

  const canConfirmDeleteAccount = hasPassword
    ? deletePassword.length > 0
    : deleteConfirmEmail.trim().toLowerCase() ===
      (user?.email ?? "").toLowerCase();

  const handleDeleteAccount = async () => {
    if (!canConfirmDeleteAccount || isDeletingAccount) return;

    setIsDeletingAccount(true);
    try {
      await deleteAccount(
        hasPassword
          ? { password: deletePassword }
          : { confirmEmail: deleteConfirmEmail.trim() },
      );
      toast.success(t("settings.deleteAccountDialog.success"));
    } catch (error: unknown) {
      setIsDeletingAccount(false);
      const err = error as {
        response?: { status?: number; data?: { error?: string } };
      };
      if (err?.response?.status === 403) {
        toast.error(t("settings.deleteAccountDialog.adminForbidden"));
      } else if (
        err?.response?.status === 401 ||
        err?.response?.data?.error?.toLowerCase().includes("password")
      ) {
        toast.error(t("settings.wrongCurrentPassword"));
      } else {
        toast.error(t("settings.deleteAccountDialog.failed"));
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
  };

  const handlePlaybackRatePresetChange = (value: string) => {
    setPlaybackRatePreset(value as PlaybackRatePreset);
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

  const { getDownloadedContentSize, clearAllDownloads, clearAppCache } =
    useOfflineStore((s) => s.actions);
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

  const playbackPresetLabels: Record<PlaybackRatePreset, string> = {
    slowed: t("settings.playbackPresetSlowed"),
    normal: t("settings.playbackPresetNormal"),
    spedUp: t("settings.playbackPresetSpedUp"),
    custom: t("settings.playbackPresetCustom"),
  };

  return (
    <>
      <Helmet>
        <title>Settings</title>
        <meta
          name="description"
          content="Manage your language preferences and audio settings, including equalizer, reverb, and normalization, on Moodify Music."
        />
      </Helmet>
      <div className="min-h-screen relative pb-40 lg:pb-0">
        <div className="container mx-auto p-4 sm:p-6 md:p-8 max-w-2xl">
          <h1 className="text-3xl font-bold text-white mb-8">
            {t("settings.title")}
          </h1>

          <SettingsSection>
            <SettingsRow label={t("settings.language")}>
              <Select value={i18n.language} onValueChange={handleLanguageChange}>
                <SelectTrigger className={compactSelectTriggerClass}>
                  <SelectValue placeholder={t("settings.language")} />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
                  <SelectItem value="ru">Русский</SelectItem>
                  <SelectItem value="uk">Українська</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>

            <SettingsRow
              label={t("settings.privacy.anonymousMode")}
              description={t("settings.privacy.anonymousModeDesc")}
            >
              <Switch
                id="anonymous-mode-toggle"
                checked={isAnonymous}
                onCheckedChange={handleAnonymousToggle}
                className="data-[state=checked]:bg-violet-600"
              />
            </SettingsRow>

            <SettingsRow label={t("settings.reduceMotion")}>
              <Switch
                id="reduceMotion-enabled"
                checked={isReduceMotionEnabled}
                onCheckedChange={setIsReduceMotionEnabled}
                className="data-[state=checked]:bg-violet-600"
              />
            </SettingsRow>

            <SettingsRow
              label={t("settings.privacy.showRecentlyListenedArtists")}
              description={t(
                "settings.privacy.showRecentlyListenedArtistsDesc",
              )}
            >
              <Switch
                id="recently-listened-artists-toggle"
                checked={showRecentlyListenedArtists}
                onCheckedChange={handleRecentlyListenedArtistsToggle}
                className="data-[state=checked]:bg-violet-600"
              />
            </SettingsRow>
          </SettingsSection>

          <SettingsSection title={t("settings.securityTitle")}>
            {hasPassword ? (
              <Link to="/settings/change-password" className="block">
                <SettingsRow
                  label={t("settings.changePassword")}
                  description={t("settings.changePasswordDesc")}
                >
                  <ChevronRight className="size-5 text-zinc-500" />
                </SettingsRow>
              </Link>
            ) : (
              <SettingsRow
                label={t("settings.changePassword")}
                description={t("settings.changePasswordUnavailable")}
              />
            )}

            <div className="py-4">
              <h3 className="text-base font-medium text-red-400 mb-1">
                {t("settings.dangerZone")}
              </h3>
              <p className="text-sm text-zinc-400 mb-4">
                {t("settings.deleteAccountDesc")}
              </p>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={isAdmin}
                onClick={() => setDeleteAccountOpen(true)}
              >
                {t("settings.deleteAccount")}
              </Button>
              {isAdmin && (
                <p className="text-gray-500 text-sm mt-2">
                  {t("settings.deleteAccountDialog.adminForbidden")}
                </p>
              )}
            </div>
          </SettingsSection>

          <AlertDialog
            open={deleteAccountOpen}
            onOpenChange={handleDeleteAccountDialogChange}
          >
            <AlertDialogContent className="bg-zinc-900 text-white border-zinc-700">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">
                  {t("settings.deleteAccountDialog.title")}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400">
                  {t("settings.deleteAccountDialog.description")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 py-2">
                {hasPassword ? (
                  <>
                    <Label
                      htmlFor="delete-account-password"
                      className="text-gray-300"
                    >
                      {t("settings.deleteAccountDialog.passwordLabel")}
                    </Label>
                    <Input
                      id="delete-account-password"
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-zinc-800/50 border-[#3a3a3a] text-white"
                      autoComplete="current-password"
                    />
                  </>
                ) : (
                  <>
                    <Label
                      htmlFor="delete-account-email"
                      className="text-gray-300"
                    >
                      {t("settings.deleteAccountDialog.confirmEmailLabel")}
                    </Label>
                    <Input
                      id="delete-account-email"
                      type="email"
                      value={deleteConfirmEmail}
                      onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                      placeholder={user?.email}
                      className="bg-zinc-800/50 border-[#3a3a3a] text-white"
                      autoComplete="email"
                    />
                  </>
                )}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel
                  disabled={isDeletingAccount}
                  className="bg-zinc-800/50 text-white hover:bg-zinc-600 border-none"
                >
                  {t("settings.deleteAccountDialog.cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 text-white hover:bg-red-700"
                  disabled={!canConfirmDeleteAccount || isDeletingAccount}
                  onClick={(e) => {
                    e.preventDefault();
                    void handleDeleteAccount();
                  }}
                >
                  {t("settings.deleteAccountDialog.confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <SettingsSection title={t("settings.audioTitle")}>
            {!isIosDevice && (
              <>
                <div>
                  <SettingsRow label={t("settings.equalizer")}>
                    <Switch
                      id="equalizer-mode"
                      checked={equalizerEnabled}
                      onCheckedChange={setEqualizerEnabled}
                      className="data-[state=checked]:bg-violet-600"
                    />
                  </SettingsRow>

                  <SettingsSubRow
                    label={t("settings.preset")}
                    disabled={!equalizerEnabled}
                  >
                    <Select
                      onValueChange={handlePresetChange}
                      value={activePresetName}
                      disabled={!equalizerEnabled}
                    >
                      <SelectTrigger className={compactSelectTriggerClass}>
                        <SelectValue placeholder={t("settings.selectPreset")} />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white max-h-60 overflow-y-auto">
                        {equalizerPresets.map((preset) => (
                          <SelectItem key={preset.name} value={preset.name}>
                            {t(`equalizerPresets.${preset.name}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </SettingsSubRow>

                  {equalizerEnabled && (
                    <div className="grid grid-cols-6 gap-2 sm:gap-3 md:gap-4 mt-4 pb-4 justify-items-center">
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
                  )}
                </div>

                <div>
                  <SettingsRow label={t("settings.reverb")}>
                    <Switch
                      id="reverb-enabled"
                      checked={reverbEnabled}
                      onCheckedChange={setReverbEnabled}
                      className="data-[state=checked]:bg-violet-600"
                    />
                  </SettingsRow>

                  <SettingsSubRow
                    label={t("settings.roomSize")}
                    disabled={!reverbEnabled}
                  >
                    <Select
                      value={reverbRoomSize}
                      onValueChange={handleReverbRoomSizeChange}
                      disabled={!reverbEnabled}
                    >
                      <SelectTrigger className={compactSelectTriggerClass}>
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
                  </SettingsSubRow>
                </div>
              </>
            )}

            <div>
              <SettingsRow
                label={t("settings.playbackSpeed")}
                description={t("settings.playbackSpeedDesc")}
              >
                <Switch
                  id="playback-rate-enabled"
                  checked={playbackRateEnabled}
                  onCheckedChange={setPlaybackRateEnabled}
                  className="data-[state=checked]:bg-violet-600"
                />
              </SettingsRow>

              <SettingsSubRow
                label={t("settings.playbackPreset")}
                disabled={!playbackRateEnabled}
              >
                <Select
                  value={playbackRatePreset}
                  onValueChange={handlePlaybackRatePresetChange}
                  disabled={!playbackRateEnabled}
                >
                  <SelectTrigger className={compactSelectTriggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
                    {(
                      Object.keys(playbackPresetLabels) as PlaybackRatePreset[]
                    ).map((preset) => (
                      <SelectItem key={preset} value={preset}>
                        {playbackPresetLabels[preset]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsSubRow>

              {playbackRateEnabled && playbackRatePreset === "custom" && (
                <SettingsSubRow label={t("settings.playbackPresetCustom")}>
                  <div className="flex items-center gap-3 min-w-[180px]">
                    <Slider
                      id="playback-rate-slider"
                      min={0.5}
                      max={1.5}
                      step={0.05}
                      value={[playbackRate]}
                      onValueChange={(value) => setPlaybackRate(value[0])}
                      className="flex-1 min-w-[100px]"
                    />
                    <span className="text-sm text-zinc-300 w-12 text-right tabular-nums">
                      {playbackRate.toFixed(2)}x
                    </span>
                  </div>
                </SettingsSubRow>
              )}
            </div>

            {!isIosDevice && (
              <>
                <SettingsRow
                  label={t("settings.normalization")}
                  description={t("settings.normalizationDesc")}
                >
                  <Select
                    value={normalizationMode}
                    onValueChange={(value: NormalizationMode) =>
                      setNormalizationMode(value)
                    }
                  >
                    <SelectTrigger className={compactSelectTriggerClass}>
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
                </SettingsRow>

                <SettingsRow
                  label={t("settings.waveAnalyzer")}
                  description={t("settings.waveAnalyzerDesc")}
                >
                  <Switch
                    id="wave-analyzer-toggle"
                    checked={waveAnalyzerEnabled}
                    onCheckedChange={setWaveAnalyzerEnabled}
                    className="data-[state=checked]:bg-violet-600"
                  />
                </SettingsRow>

                <div className="py-4">
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
              </>
            )}
          </SettingsSection>

          <SettingsSection title={t("settings.playbackTitle")}>
            <SettingsRow
              label={t("settings.autoplay")}
              description={t("settings.autoplayDesc")}
            >
              <Switch
                id="autoplay-enabled"
                checked={autoplayEnabled}
                onCheckedChange={setAutoplayEnabled}
                className="data-[state=checked]:bg-violet-600"
              />
            </SettingsRow>
            <SettingsRow
              label={t("settings.smartShuffleRepeats")}
              description={t("settings.smartShuffleRepeatsDesc")}
            >
              <Select
                value={smartShuffleRepeatMode}
                onValueChange={(value) =>
                  setSmartShuffleRepeatMode(value as SmartShuffleRepeatMode)
                }
              >
                <SelectTrigger className={compactSelectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
                  <SelectItem value="default">
                    {t("settings.smartShuffleRepeatsDefault")}
                  </SelectItem>
                  <SelectItem value="fewerRepeats">
                    {t("settings.smartShuffleRepeatsFewer")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>
          </SettingsSection>

          <SettingsSection title={t("settings.downloads")}>
            <SettingsRow label={t("settings.storage")}>
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
            </SettingsRow>

            <div className="py-4">
              <div className="bg-zinc-800/50 p-4 rounded-md">
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
                        storageUsage.quota > 0
                          ? (storageUsage.usage / storageUsage.quota) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-2 text-right">
                  {t("settings.totalAvailable")}{" "}
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

              <div className="mt-3">
                <Button
                  onClick={clearAppCache}
                  variant="outline"
                  className="w-full bg-zinc-800/50 hover:bg-[#3a3a3a] border-[#3a3a3a]"
                >
                  {t("settings.clearAppCache", "Очистить кэш приложения")}
                </Button>
                <p className="text-gray-400 text-sm mt-2 text-center">
                  {t(
                    "settings.clearAppCacheDesc",
                    "Удаляет кэш (включая SW) и применяет обновления без hard reload.",
                  )}
                </p>
              </div>
            </div>
          </SettingsSection>
        </div>
      </div>
    </>
  );
};

export default SettingsPage;
