import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { fetchHomeFeedStatus } from "@/lib/api/home";
import {
  clearHomeFeedGenerating,
  markHomeFeedGenerating,
} from "@/lib/homeFeedGeneration";
import { invalidateHomeBootstrap } from "@/lib/invalidateQueries";
import { prefetchHomeData } from "@/lib/prefetchHome";
import { useAuthStore } from "@/stores/useAuthStore";
import OnboardingGeneratingScreen from "./OnboardingGeneratingScreen";

const POLL_INTERVAL_MS = 1500;
const TIMEOUT_MS = 90_000;

interface UseOnboardingFeedGenerationOptions {
  enabled: boolean;
  onComplete: () => void;
}

export function useOnboardingFeedGeneration({
  enabled,
  onComplete,
}: UseOnboardingFeedGenerationOptions) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const startedAtRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  const finishAndNavigate = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;

    const authKey = useAuthStore.getState().user?.id ?? "__guest__";
    await invalidateHomeBootstrap(authKey);
    await prefetchHomeData(authKey, { force: true });
    clearHomeFeedGenerating();
    onComplete();
    navigate("/", { replace: true });
  }, [navigate, onComplete]);

  const failGeneration = useCallback(() => {
    clearHomeFeedGenerating();
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (!enabled || completedRef.current) return;

    markHomeFeedGenerating();
    startedAtRef.current = Date.now();
    let cancelled = false;

    const poll = async () => {
      while (!cancelled && !completedRef.current) {
        try {
          const { status } = await fetchHomeFeedStatus();

          if (status === "ready") {
            await finishAndNavigate();
            return;
          }

          if (status === "failed") {
            toast.error(t("onboarding.generatingFailed"));
            failGeneration();
            return;
          }
        } catch {
          if (!cancelled) {
            toast.error(t("onboarding.generatingFailed"));
            failGeneration();
          }
          return;
        }

        if (
          startedAtRef.current &&
          Date.now() - startedAtRef.current >= TIMEOUT_MS
        ) {
          toast.error(t("onboarding.generatingFailed"));
          failGeneration();
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [enabled, failGeneration, finishAndNavigate, t]);
}

export { OnboardingGeneratingScreen };
