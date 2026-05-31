import { cn } from "@/lib/utils";

const bubbleSizes = [
  { width: "w-48", height: "h-16" },
  { width: "w-36", height: "h-12" },
  { width: "w-56", height: "h-20" },
  { width: "w-40", height: "h-14" },
  { width: "w-44", height: "h-16" },
  { width: "w-32", height: "h-12" },
] as const;

const ChatMessagesSkeleton = () => (
  <div className="space-y-2">
    {bubbleSizes.map(({ width, height }, i) => {
      const isOwn = i % 2 === 1;

      return (
        <div
          key={i}
          className={cn(
            "w-full min-w-0 max-w-full box-border flex",
            isOwn ? "justify-end" : "justify-start",
          )}
        >
          <div
            className={cn(
              "flex items-end gap-2 min-w-0 max-w-[calc(100vw-2.5rem)] sm:max-w-[min(100%,28rem)]",
              isOwn && "flex-row-reverse",
            )}
          >
            <div className="size-8 rounded-full bg-zinc-800 animate-pulse shrink-0" />
            <div
              className={cn(
                "rounded-2xl bg-zinc-800 animate-pulse",
                width,
                height,
              )}
            />
          </div>
        </div>
      );
    })}
  </div>
);

export default ChatMessagesSkeleton;
