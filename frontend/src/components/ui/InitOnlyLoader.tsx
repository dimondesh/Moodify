import { useTranslation } from "react-i18next";
import StandardLoader from "./StandardLoader";

/** Full-screen loader for auth bootstrap and lazy-route init only. */
const InitOnlyLoader = () => {
  const { t } = useTranslation();

  return (
    <div className="h-screen w-full bg-[#0f0f0f] flex items-center justify-center">
      <StandardLoader size="lg" text={t("auth.loggingIn")} showText />
    </div>
  );
};

export default InitOnlyLoader;
