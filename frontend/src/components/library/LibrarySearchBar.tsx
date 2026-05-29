import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LibrarySearchBarProps {
  variant: "sidebar" | "page";
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
}

const variantStyles = {
  sidebar: {
    button: "text-gray-400 hover:text-white hover:bg-transparent! mt-0.5 h-8 w-8 p-0",
    buttonIcon: "w-4 h-4",
    collapsedWidth: "w-8",
    input: "w-full bg-zinc-800/50 rounded-md py-2 pl-10 pr-4 text-sm text-white placeholder:text-gray-400 focus:outline-none transition duration-150 ease-in-out cursor-pointer",
    searchIcon: "absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none",
  },
  page: {
    button: "text-gray-400 hover:text-white hover:bg-zinc-800/50 h-12 w-12 p-0",
    buttonIcon: "size-5",
    collapsedWidth: "w-12",
    input: "w-full bg-zinc-800/50 rounded-md py-3 pl-12 pr-4 text-base text-white placeholder:text-gray-400 focus:outline-none transition duration-150 ease-in-out",
    searchIcon: "absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none",
  },
} as const;

export function LibrarySearchBar({
  variant,
  isOpen,
  onOpenChange,
  query,
  onQueryChange,
}: LibrarySearchBarProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const styles = variantStyles[variant];

  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <div className="flex-1">
      <div className="relative" onClick={() => onOpenChange(!isOpen)}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(!isOpen)}
          className={cn(
            "transition-all duration-300 ease-in-out z-20",
            styles.button,
            isOpen ? "opacity-0 pointer-events-none" : "opacity-100",
          )}
        >
          <Search className={styles.buttonIcon} />
        </Button>

        <div
          className={cn(
            "absolute top-0 left-0 transition-all duration-300 ease-in-out overflow-hidden z-10",
            isOpen ? "w-full opacity-100" : cn(styles.collapsedWidth, "opacity-0"),
          )}
        >
          <Search className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            placeholder={t("sidebar.searchLibrary")}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onBlur={() => onOpenChange(false)}
            className={styles.input}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}
