import React from "react";
import { useTranslation } from "react-i18next";
import StandardLoader from "./ui/StandardLoader";

export const LoadingFallback: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="h-screen w-full bg-[#0f0f0f] flex items-center justify-center">
      <StandardLoader size="lg" text={t("auth.loggingIn")} showText={true} />
    </div>
  );
};

export default LoadingFallback;
