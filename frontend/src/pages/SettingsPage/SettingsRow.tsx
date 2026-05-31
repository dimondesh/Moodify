import React from "react";

interface SettingsRowProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  label,
  description,
  children,
  className = "",
  onClick,
}) => (
  <div
    className={`flex items-center justify-between gap-4 py-4 ${onClick ? "cursor-pointer hover:bg-white/5 -mx-2 px-2 rounded-md transition-colors" : ""} ${className}`}
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={
      onClick
        ? (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick();
            }
          }
        : undefined
    }
  >
    <div className="min-w-0 flex-1">
      <div className="text-base font-medium text-white">{label}</div>
      {description ? (
        <p className="text-sm text-zinc-400 mt-1">{description}</p>
      ) : null}
    </div>
    {children ? (
      <div className="shrink-0 flex items-center">{children}</div>
    ) : null}
  </div>
);
