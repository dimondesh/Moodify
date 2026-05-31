import React from "react";

interface SettingsSubRowProps {
  label: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export const SettingsSubRow: React.FC<SettingsSubRowProps> = ({
  label,
  children,
  disabled = false,
  className = "",
}) => (
  <div
    className={`flex items-center justify-between gap-4 py-3 pl-0 ${disabled ? "opacity-50 pointer-events-none" : ""} ${className}`}
    aria-disabled={disabled}
  >
    <span className="text-sm text-zinc-400">{label}</span>
    <div className="shrink-0 flex items-center">{children}</div>
  </div>
);
