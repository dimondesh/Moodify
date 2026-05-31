import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import CardGridSkeleton from "@/components/ui/skeletons/CardGridSkeleton";
import { useHubs } from "@/hooks/queries";
import { getHubDisplayName } from "@/lib/entitySection";
import { getImageUrlByKey } from "@/lib/imageUrl";
import {
  CDN_DEFAULT_ALBUM_COVER,
  CDN_DEFAULT_ARTIST_IMAGE,
} from "@/lib/cdn";
import type { Hub, HubPreviewCover } from "@/types";

const shadeHex = (hex: string, amount: number) => {
  const normalized = hex.replace("#", "");
  const num = parseInt(normalized, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
};

const getCoverUrl = (cover: HubPreviewCover) =>
  getImageUrlByKey(
    cover,
    "card",
    cover.entityType === "artist"
      ? CDN_DEFAULT_ARTIST_IMAGE
      : CDN_DEFAULT_ALBUM_COVER,
  );

const HubCoverStack = ({ covers }: { covers: HubPreviewCover[] }) => {
  if (!covers.length) return null;

  return (
    <div className="absolute right-2 top-2 sm:right-3 sm:top-3 w-[56%] aspect-square pointer-events-none">
      {covers.map((cover, index) => (
        <img
          key={`${cover.entityType}-${index}`}
          src={getCoverUrl(cover)}
          alt=""
          draggable={false}
          className={`absolute inset-0 h-full w-full object-cover shadow-2xl ${
            cover.entityType === "artist" ? "rounded-full" : "rounded-md"
          }`}
          style={{
            transform: `rotate(${8 + index * 6}deg) translate(${index * 5}px, ${index * 3}px) scale(${1 - index * 0.05})`,
            zIndex: covers.length - index,
          }}
        />
      ))}
    </div>
  );
};

const HubCard = ({ hub }: { hub: Hub }) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const displayName = getHubDisplayName(hub, i18n.language);
  const previewCovers = hub.previewCovers ?? [];

  return (
    <button
      type="button"
      onClick={() => navigate(`/hubs/${hub._id}`)}
      className="group relative aspect-square rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl cursor-pointer text-left isolate"
      style={{
        background: `linear-gradient(145deg, ${shadeHex(hub.accentColor, 28)} 0%, ${hub.accentColor} 42%, ${shadeHex(hub.accentColor, -42)} 100%)`,
      }}
    >
      <div
        className="absolute -right-6 -top-4 h-[72%] w-[72%] rounded-full opacity-20 blur-2xl"
        style={{ backgroundColor: shadeHex(hub.accentColor, 60) }}
      />
      <HubCoverStack covers={previewCovers} />
      <div
        className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none"
      />
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 85%, rgba(255,255,255,0.45) 0%, transparent 40%)",
        }}
      />

      <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />

      <div className="relative z-10 flex h-full flex-col justify-end p-3.5 sm:p-4 min-h-0">
        <h3 className="text-white text-base sm:text-lg font-bold leading-snug drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] break-words">
          {displayName}
        </h3>
      </div>
    </button>
  );
};

const HubBrowseGrid = () => {
  const { t } = useTranslation();
  const { data: hubs = [], isPending } = useHubs();

  if (isPending && hubs.length === 0) {
    return (
      <div>
        <div className="h-8 w-48 bg-zinc-800 rounded mb-4 animate-pulse" />
        <CardGridSkeleton count={6} className="gap-3 sm:gap-4" />
      </div>
    );
  }

  if (hubs.length === 0) {
    return (
      <p className="text-zinc-400 text-center py-12">{t("searchpage.noHubs")}</p>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-white">
        {t("searchpage.browseAll")}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
        {hubs.map((hub) => (
          <HubCard key={hub._id} hub={hub} />
        ))}
      </div>
    </div>
  );
};

export default HubBrowseGrid;
