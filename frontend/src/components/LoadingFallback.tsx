import { Loader } from "lucide-react";
import React from "react";
import { Card, CardContent } from "./ui/card";
import { useTranslation } from "react-i18next";

export const LoadingFallback: React.FC = () => {
  const {t} = useTranslation()
  
    return (
    <div className="h-screen w-full bg-zinc-950 flex items-center justify-center">
 <Card className="w-[90%] max-w-md bg-zinc-900 border-zinc-800">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <Loader className="size-6 text-violet-500 animate-spin" />
            <h3 className="text-zinc-400 text-xl font-bold">
              {t("auth.loggingIn")}
            </h3>
            <p className="text-zinc-400 text-sm">{t("auth.redirecting")}</p>
          </CardContent>
        </Card>    </div>
  );
};

export default LoadingFallback;
