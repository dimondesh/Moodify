import { Music } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveListeningIndicatorProps {
  className?: string;
}

export function LiveListeningIndicator({
  className,
}: LiveListeningIndicatorProps) {
  return (
    <Music
      className={cn("shrink-0 text-violet-500", className)}
      aria-hidden
    />
  );
}
