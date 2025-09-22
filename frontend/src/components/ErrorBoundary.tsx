import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "./ui/card";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children }) => {
  const { t } = useTranslation();
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.name === "ChunkLoadError") {
        console.error("ChunkLoadError occurred:", event.error);
        window.location.reload();
        return;
      }
      setError(event.error);
      setHasError(true);
    };

    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  if (hasError) {
    return (
      <div className="h-screen w-full bg-[#0f0f0f] flex items-center justify-center">
        <Card className="w-[90%] max-w-md bg-[#1a1a1a] border-[#2a2a2a]">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <h2 className="text-gray-400 text-xl font-bold">
              {t("errors.somethingWentWrong")}
            </h2>
            <button
              className="px-4 py-2 bg-violet-600 text-white rounded-full hover:bg-violet-700 transition-colors"
              onClick={() => window.location.reload()}
            >
              {t("errors.reloadPage")}
            </button>
            <p className="text-gray-500 text-sm">{error?.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return children;
};

export default ErrorBoundary;
