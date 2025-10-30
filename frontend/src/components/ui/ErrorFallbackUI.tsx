// src/components/ui/ErrorFallbackUI.tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "./card"; // Убедитесь, что путь правильный

interface ErrorFallbackUIProps {
  error: Error | null;
}

export const ErrorFallbackUI: React.FC<ErrorFallbackUIProps> = ({ error }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="h-screen w-full bg-[#0f0f0f] flex items-center justify-center">
      <Card className="w-[90%] max-w-md bg-[#1a1a1a] border-[#2a2a2a]">
        <CardContent className="flex flex-col items-center gap-4 pt-6">
          <h2 className="text-gray-400 text-xl font-bold">
            {t("errors.somethingWentWrong")}
          </h2>
          <div className="flex items-center gap-4">
            <button
              className="px-4 py-2 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition-colors"
              onClick={handleGoBack}
            >
              {t("errors.goBack", "Вернуться назад")}
            </button>
            <button
              className="px-4 py-2 bg-violet-600 text-white rounded-full hover:bg-violet-700 transition-colors"
              onClick={() => window.location.reload()}
            >
              {t("errors.reloadPage")}
            </button>
          </div>
          {process.env.NODE_ENV === "development" && error && (
            <p className="text-gray-500 text-sm mt-2">{error.message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
