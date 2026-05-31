import { cn } from "@/lib/utils";

const ChatMessagesSkeleton = () => (
  <div className="space-y-4 py-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <div
        key={i}
        className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}
      >
        <div
          className={cn(
            "h-12 rounded-2xl bg-zinc-800 animate-pulse",
            i % 2 === 0 ? "w-48" : "w-36",
          )}
        />
      </div>
    ))}
  </div>
);

export default ChatMessagesSkeleton;
