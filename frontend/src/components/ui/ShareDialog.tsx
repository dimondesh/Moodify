// src/components/ui/ShareDialog.tsx
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Link2, Check } from "lucide-react";
import { Drawer } from "vaul";
import { useChatStore } from "@/stores/useChatStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { ScrollArea } from "./scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Separator } from "./separator";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./dialog";
import toast from "react-hot-toast";

const PANEL_CLASS =
  "flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-3 rounded-md bg-zinc-900 p-2.5 text-zinc-100 shadow-lg";

type ShareDensity = "compact" | "comfortable";

type SharePanelProps = {
  entityType: "song" | "album" | "playlist";
  entityId: string;
  onRequestClose: () => void;
  density?: ShareDensity;
  /** When false, parent supplies title/description (e.g. Dialog header or Drawer.Title). */
  showHeading?: boolean;
};

function SharePanel({
  entityType,
  entityId,
  onRequestClose,
  density = "compact",
  showHeading = true,
}: SharePanelProps) {
  const { t } = useTranslation();
  const { users, sendMessage } = useChatStore();
  const { user } = useAuthStore();
  const [isCopied, setIsCopied] = useState(false);
  const comfortable = density === "comfortable";

  const handleCopyLink = () => {
    const baseUrl = window.location.origin;
    const pathMap: Record<string, string> = {
      song: "track",
      album: "albums",
      playlist: "playlists",
    };
    const path = pathMap[entityType] || entityType;
    const shareUrl = `${baseUrl}/${path}/${entityId}`;

    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        toast.success(t("common.linkCopied"));
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(() => {
        toast.error(t("common.copyFailed"));
      });
  };

  const handleSend = (receiverId: string) => {
    if (user) {
      const content = `${t("common.checkOutThis")} ${entityType}!`;
      sendMessage(receiverId, user.id, content, "share", {
        entityType,
        entityId,
      });
      toast.success(t("common.sharedToChat"));
      onRequestClose();
    }
  };

  return (
    <>
      {showHeading ? (
        <div className="shrink-0 space-y-1 px-0.5">
          <p
            className={cn(
              "font-semibold text-zinc-100",
              comfortable ? "text-base" : "text-sm",
            )}
          >
            {t("common.shareWithFriend")}
          </p>
          <p
            className={cn("text-zinc-500", comfortable ? "text-sm" : "text-xs")}
          >
            {t("common.selectFriendToShare", {
              entity: t(`common.entities.instrumental.${entityType}`),
            })}
          </p>
        </div>
      ) : null}

      <Button
        type="button"
        variant="secondary"
        className={cn(
          "mx-auto w-full shrink-0 rounded-3xl bg-white font-medium text-[#1f1f1f] hover:bg-zinc-200 md:rounded-lg md:bg-zinc-800/50 md:text-white md:hover:bg-zinc-800",
          comfortable ? "h-10 max-w-50 text-sm" : "h-8 max-w-50 text-xs",
          isCopied
            ? "bg-emerald-500 transition-colors text-white hover:bg-emerald-600"
            : "",
        )}
        data-vaul-no-drag
        onClick={handleCopyLink}
      >
        {isCopied ? (
          <Check
            className={cn(
              "mr-1.5 shrink-0 white",
              comfortable ? "size-4" : "size-3.5",
            )}
          />
        ) : (
          <Link2
            className={cn(
              "mr-1.5 shrink-0",
              comfortable ? "size-4" : "size-3.5",
            )}
          />
        )}
        {t("common.copyLink")}
      </Button>

      <div className="flex shrink-0 items-center gap-2">
        <Separator className="flex-1 bg-zinc-700 my-8" />
        <span className="text-xs uppercase text-zinc-500">
          {t("common.orSendToFriend")}
        </span>
        <Separator className="flex-1 bg-zinc-700" />
      </div>

      <ScrollArea
        className={cn(comfortable ? "min-h-0 flex-1 pr-1" : "h-64 pr-1")}
      >
        <div
          className={cn(
            "flex flex-col",
            comfortable ? "gap-1 pb-1" : "space-y-2",
          )}
        >
          {users.length > 0 ? (
            users.map((friend) => (
              <div
                key={friend._id}
                className={cn(
                  "flex items-center justify-between rounded-md hover:bg-zinc-800/50",
                  comfortable ? "gap-3 p-2.5" : "p-2",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar
                    className={comfortable ? "size-11" : "size-9 shrink-0"}
                  >
                    <AvatarImage src={friend.imageUrl} />
                    <AvatarFallback>{friend.fullName[0]}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm">{friend.fullName}</span>
                </div>
                <Button
                  type="button"
                  size={comfortable ? "default" : "sm"}
                  className="shrink-0"
                  data-vaul-no-drag
                  onClick={() => handleSend(friend._id)}
                >
                  {t("common.send")}
                </Button>
              </div>
            ))
          ) : (
            <div className="mt-10 flex h-full items-center justify-center text-sm text-zinc-500">
              {t("common.noFriendsFound", "Нет друзей для отправки")}
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );
}

type ShareDialogAnchoredProps = {
  entityType: "song" | "album" | "playlist";
  entityId: string;
  children: React.ReactElement;
  isOpen?: never;
  onClose?: never;
};

type ShareDialogFloatingProps = {
  entityType: "song" | "album" | "playlist";
  entityId: string;
  isOpen: boolean;
  onClose: () => void;
  children?: undefined;
};

export type ShareDialogProps =
  | ShareDialogAnchoredProps
  | ShareDialogFloatingProps;

function isAnchoredShare(
  props: ShareDialogProps,
): props is ShareDialogAnchoredProps {
  return "children" in props && props.children != null;
}

export const ShareDialog: React.FC<ShareDialogProps> = (props) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const [anchoredOpen, setAnchoredOpen] = useState(false);
  const fetchUsers = useChatStore((s) => s.fetchUsers);

  const { entityType, entityId } = props;

  const floatingOpen = isAnchoredShare(props) ? false : props.isOpen;
  const onFloatingClose = isAnchoredShare(props) ? () => {} : props.onClose;

  const surfaceOpen = isAnchoredShare(props) ? anchoredOpen : floatingOpen;

  useEffect(() => {
    if (surfaceOpen) {
      void fetchUsers();
    }
  }, [surfaceOpen, fetchUsers]);

  const handleFloatingOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onFloatingClose();
    },
    [onFloatingClose],
  );

  const closeAnchored = useCallback(() => setAnchoredOpen(false), []);

  useEffect(() => {
    setAnchoredOpen(false);
  }, [entityId, entityType]);

  const drawerChrome = (onRequestClose: () => void, density: ShareDensity) => (
    <>
      <div className="flex shrink-0 cursor-grab select-none items-center gap-2 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] active:cursor-grabbing">
        <Drawer.Close asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-vaul-no-drag
            className="size-11 shrink-0 text-zinc-400 hover:text-white"
            aria-label={t("player.close")}
          >
            <ChevronDown className="size-7" />
          </Button>
        </Drawer.Close>
        <Drawer.Title className="min-w-0 flex-1 pr-2 text-center text-base font-semibold text-zinc-100">
          {t("common.shareWithFriend")}
        </Drawer.Title>
        <div className="size-11 shrink-0" aria-hidden />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overscroll-contain px-3 py-3">
        <SharePanel
          entityType={entityType}
          entityId={entityId}
          onRequestClose={onRequestClose}
          density={density}
          showHeading={false}
        />
      </div>

      <div className="flex shrink-0 justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <Drawer.Close asChild>
          <Button
            type="button"
            data-vaul-no-drag
            className="h-11 w-full max-w-30 rounded-3xl bg-violet-500 text-sm font-medium text-[#1f1f1f]"
          >
            {t("player.done")}
          </Button>
        </Drawer.Close>
      </div>
    </>
  );

  if (isAnchoredShare(props)) {
    const { children } = props;

    if (isMobile) {
      return (
        <Drawer.Root
          open={anchoredOpen}
          onOpenChange={setAnchoredOpen}
          shouldScaleBackground={false}
        >
          <Drawer.Trigger asChild>{children}</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-[100] bg-black/40" />
            <Drawer.Content
              aria-describedby={undefined}
              className="fixed inset-0 z-[100] flex h-[100dvh] max-h-[100dvh] flex-col rounded-none border-0 bg-zinc-900 text-zinc-100 outline-none"
            >
              {drawerChrome(closeAnchored, "comfortable")}
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      );
    }

    return (
      <Popover open={anchoredOpen} onOpenChange={setAnchoredOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={6}
          className="w-auto border-0 bg-transparent p-0 shadow-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className={PANEL_CLASS}>
            <SharePanel
              entityType={entityType}
              entityId={entityId}
              onRequestClose={closeAnchored}
              density="compact"
            />
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  if (isMobile) {
    return (
      <Drawer.Root
        open={floatingOpen}
        onOpenChange={handleFloatingOpenChange}
        shouldScaleBackground={false}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[100] bg-black/40" />
          <Drawer.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-[100] flex h-[100dvh] max-h-[100dvh] flex-col rounded-none border-0 bg-zinc-900 text-zinc-100 outline-none"
          >
            {drawerChrome(onFloatingClose, "comfortable")}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog open={floatingOpen} onOpenChange={handleFloatingOpenChange}>
      <DialogContent
        showCloseButton
        className="z-[150] max-h-[min(32rem,85vh)] gap-3 overflow-hidden border-zinc-700 bg-zinc-900 p-4 text-white sm:max-w-[min(22rem,calc(100vw-2rem))]"
      >
        <DialogHeader className="shrink-0 space-y-1 text-left">
          <DialogTitle className="text-base text-zinc-100">
            {t("common.shareWithFriend")}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            {t("common.selectFriendToShare", {
              entity: t(`common.entities.instrumental.${entityType}`),
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <SharePanel
            entityType={entityType}
            entityId={entityId}
            onRequestClose={onFloatingClose}
            density="compact"
            showHeading={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
