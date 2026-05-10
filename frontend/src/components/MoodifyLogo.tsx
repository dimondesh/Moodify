// src/components/MoodifyLogo.tsx

import "./MoodifyLogo.css";
import { useAudioSettingsStore } from "../lib/webAudio";

// Добавляем интерфейс для пропсов компонента
interface MoodifyLogoProps {
  isWhite?: boolean; // Необязательный пропс, по умолчанию будет false
}

const MoodifyLogo = ({ isWhite = false }: MoodifyLogoProps) => {
  const { isReduceMotionEnabled } = useAudioSettingsStore();

  return (
    <div className="logo-container">
      <img
        src="/Moodify-transparent.svg"
        alt="Moodify Logo"
        className={`moodify-logo ${
          isReduceMotionEnabled ? "no-animation" : "animated"
        }`}
        style={isWhite ? { filter: "brightness(0) invert(1)" } : undefined}
      />
    </div>
  );
};

export default MoodifyLogo;
