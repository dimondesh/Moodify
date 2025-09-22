// src/components/MoodifyLogo.tsx

import "./MoodifyLogo.css";
import { useAudioSettingsStore } from "../lib/webAudio";

const MoodifyLogo = () => {
  const { isReduceMotionEnabled } = useAudioSettingsStore();

  return (
    <div className="logo-container">
      <img
        src="/Moodify.svg"
        alt="Moodify Logo"
        className={`moodify-logo ${
          isReduceMotionEnabled ? "no-animation" : "animated"
        }`}
      />
    </div>
  );
};

export default MoodifyLogo;
