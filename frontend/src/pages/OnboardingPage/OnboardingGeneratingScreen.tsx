import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import MoodifyLogo from "@/components/MoodifyLogo";
import MoodifyLoader from "@/components/ui/MoodifyLoader";
import { cn } from "@/lib/utils";

const STEP_KEYS = [
  "onboarding.generatingStep1",
  "onboarding.generatingStep2",
  "onboarding.generatingStep3",
] as const;

const STEP_INTERVAL_MS = 3200;

const OnboardingGeneratingScreen = () => {
  const { t } = useTranslation();
  const [stepIndex, setStepIndex] = useState(0);
  const [textVisible, setTextVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setTextVisible(false);
      window.setTimeout(() => {
        setStepIndex((current) => (current + 1) % STEP_KEYS.length);
        setTextVisible(true);
      }, 320);
    }, STEP_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <Helmet>
        <title>{t("onboarding.generatingTitle")} · Moodify Music</title>
      </Helmet>

      <div className="h-dvh min-h-screen bg-[#0f0f0f] text-white flex flex-col overflow-hidden">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 lg:px-12 py-8 lg:py-12 flex flex-col flex-1 min-h-0">
          <div className="flex justify-center mb-6 lg:mb-8">
            <MoodifyLogo />
          </div>

          <header className="text-center mb-4 lg:mb-6 max-w-2xl mx-auto">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3">
              {t("onboarding.generatingTitle")}
            </h1>
            <p className="text-gray-400 text-sm sm:text-base lg:text-lg">
              {t("onboarding.generatingSubtitle")}
            </p>
          </header>

          <div className="flex flex-1 flex-col items-center justify-center min-h-[14rem]">
            <MoodifyLoader size="lg" />

            <p
              className={cn(
                "mt-8 sm:mt-10 text-center text-xl sm:text-2xl lg:text-3xl font-medium text-violet-400 px-4 max-w-xl",
                "transition-opacity duration-500 ease-in-out",
                textVisible ? "opacity-100" : "opacity-0",
              )}
            >
              {t(STEP_KEYS[stepIndex])}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default OnboardingGeneratingScreen;
