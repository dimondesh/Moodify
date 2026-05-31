import { cn } from "@/lib/utils";
import { useAudioSettingsStore } from "@/lib/webAudio";

const DOT_COUNT = 3;

const SIZE_CONFIG = {
  sm: {
    track: "h-8 gap-3",
    dot: "w-2.5 h-2.5",
    text: "text-xs",
    stack: "gap-3",
  },
  md: {
    track: "h-14 gap-4",
    dot: "w-3.5 h-3.5",
    text: "text-sm",
    stack: "gap-4",
  },
  lg: {
    track: "h-20 sm:h-24 gap-4 sm:gap-5",
    dot: "w-4 h-4 sm:w-5 sm:h-5",
    text: "text-sm sm:text-base",
    stack: "gap-6 sm:gap-8",
  },
} as const;

export interface MoodifyLoaderProps {
  text?: string;
  size?: keyof typeof SIZE_CONFIG;
  className?: string;
  textClassName?: string;
  fullScreen?: boolean;
}

const MoodifyLoader = ({
  text,
  size = "md",
  className,
  textClassName,
  fullScreen = false,
}: MoodifyLoaderProps) => {
  const reducedMotion = useAudioSettingsStore((s) => s.isReduceMotionEnabled);
  const config = SIZE_CONFIG[size];

  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        config.stack,
        className,
      )}
    >
      <div
        className={cn("flex items-center justify-center", config.track)}
        aria-hidden
      >
        {Array.from({ length: DOT_COUNT }, (_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-full bg-violet-500",
              config.dot,
              reducedMotion ? "opacity-70" : "animate-dot-pulse",
            )}
            style={
              reducedMotion ? undefined : { animationDelay: `${i * 0.2}s` }
            }
          />
        ))}
      </div>

      {text ? (
        <p
          className={cn(
            "text-center text-gray-400 font-light",
            config.text,
            textClassName,
          )}
        >
          {text}
        </p>
      ) : null}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="h-screen w-full bg-[#0f0f0f] flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
};

export default MoodifyLoader;
