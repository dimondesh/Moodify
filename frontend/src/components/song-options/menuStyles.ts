/** Shared row styles for song options menu items and sub-triggers. */
const SONG_MENU_ROW =
  "gap-2 cursor-pointer !rounded-none !px-3 !py-2 !text-sm !text-zinc-100 outline-none select-none transition-colors hover:!bg-zinc-800/50 focus:!bg-zinc-800/50 focus:!text-zinc-100 data-[highlighted]:!bg-zinc-800/50 data-[state=open]:!bg-zinc-800/50 data-[state=open]:!text-zinc-100 [&_svg:not([class*='text-'])]:!text-zinc-400 [&_svg:not([class*='size-'])]:!size-4 [&_svg]:shrink-0";

/** Shared popover/dropdown surface — matches SaveSongToLibraryControl panel. */
export const DROPDOWN_SURFACE =
  "rounded-md border-0 bg-zinc-900 text-zinc-100 shadow-lg";

/** Same surface as SaveSongToLibraryControl desktop popover (PANEL_CLASS). */
export const SONG_MENU_SURFACE =
  `w-56 min-w-[13rem] overflow-hidden !p-0 ${DROPDOWN_SURFACE}`;

export const SONG_MENU_ITEM = SONG_MENU_ROW;

/** Same as item row + chevron aligned to the right. */
export const SONG_MENU_SUB_TRIGGER = `${SONG_MENU_ROW} [&>svg:last-child]:!ml-auto [&>svg:last-child]:!size-3.5`;

export const SONG_SUBMENU_LIST_ITEM =
  "w-full rounded-none px-3 py-2 text-left text-sm text-zinc-100 transition-colors hover:bg-zinc-800/50";

export const SONG_MENU_DIVIDER = "border-zinc-800";
