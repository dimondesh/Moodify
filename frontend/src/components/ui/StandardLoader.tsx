// src/components/ui/StandardLoader.tsx

import React from "react";
import { cn } from "../../lib/utils";

interface StandardLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
  showText?: boolean;
}

const StandardLoader: React.FC<StandardLoaderProps> = ({
  size = "md",
  className,
  text = "Loading...",
  showText = false,
}) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Gradient orb loader */}
      <div className="relative">
        <div
          className={cn(
            "bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] rounded-full animate-pulse",
            sizeClasses[size]
          )}
        ></div>
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] rounded-full animate-ping opacity-75",
            sizeClasses[size]
          )}
        ></div>
        <div
          className={cn(
            "absolute inset-1 bg-[#0f0f0f] rounded-full",
            size === "sm" ? "inset-0.5" : size === "lg" ? "inset-2" : "inset-1"
          )}
        ></div>
        <div
          className={cn(
            "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#8b5cf6] rounded-full animate-pulse",
            size === "sm"
              ? "w-1 h-1"
              : size === "lg"
              ? "w-2 h-2"
              : "w-1.5 h-1.5"
          )}
        ></div>
      </div>

      {/* Optional text */}
      {showText && (
        <p className="text-gray-400 text-sm font-light tracking-widest uppercase">
          {text}
        </p>
      )}
    </div>
  );
};

export default StandardLoader;
