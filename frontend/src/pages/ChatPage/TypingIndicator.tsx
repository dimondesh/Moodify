// frontend/src/pages/ChatPage/TypingIndicator.tsx
import React from "react";
import "./TypingIndicator.css";

export const TypingIndicator: React.FC = () => {
  return (
    <div className="typing-indicator">
      <div className="typing-dot"></div>
      <div className="typing-dot"></div>
      <div className="typing-dot"></div>
    </div>
  );
};
