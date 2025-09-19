// frontend/src/pages/OfflinePage/OfflinePage.tsx

import { WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

const OfflinePage = () => {
  const { t } = useTranslation();
  return (
    <>
      <Helmet>
        <title>{t("offline.title")}</title>
      </Helmet>
      <div className="h-full flex flex-col items-center justify-center text-center p-4">
        <WifiOff className="size-24 text-zinc-500 mb-8" />
        <h1 className="text-3xl font-bold text-white mb-2">
          {t("offline.heading")}
        </h1>
        <p className="text-zinc-400 max-w-sm mb-8">
          {t("offline.description")}
        </p>
        <Button asChild className="bg-violet-600 hover:bg-violet-700">
          <Link to="/library">{t("offline.goToLibrary")}</Link>
        </Button>
      </div>
    </>
  );
};

export default OfflinePage;
