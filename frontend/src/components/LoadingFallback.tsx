import { useTranslation } from "react-i18next";
import MoodifyLoader from "./ui/MoodifyLoader";

export const LoadingFallback = () => {
  const { t } = useTranslation();
  return <MoodifyLoader fullScreen text={t("auth.loggingIn")} size="lg" />;
};

export default LoadingFallback;
