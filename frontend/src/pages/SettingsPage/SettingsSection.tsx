import React from "react";

interface SettingsSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  children,
  className = "",
}) => (
  <section className={`mb-10 ${className}`}>
    {title ? (
      <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
    ) : null}
    <div className="divide-y divide-white/10">{children}</div>
  </section>
);
