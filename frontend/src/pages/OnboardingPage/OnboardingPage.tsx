import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Check, Search } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CoverImage } from "@/components/CoverImage";
import { CDN_DEFAULT_ARTIST_IMAGE } from "@/lib/cdn";
import {
  fetchOnboardingArtistsPage,
  type OnboardingArtist,
} from "@/lib/api/onboarding";
import { fetchSearch } from "@/lib/api/search";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  TASTE_ONBOARDING_MIN_ARTISTS,
  TASTE_ONBOARDING_MAX_ARTISTS,
} from "@/constants/onboarding";
import CardGridSkeleton from "@/components/ui/skeletons/CardGridSkeleton";
import { cn } from "@/lib/utils";
import MoodifyLogo from "@/components/MoodifyLogo";
import {
  markHomeFeedGenerating,
  clearHomeFeedGenerating,
} from "@/lib/homeFeedGeneration";
import {
  OnboardingGeneratingScreen,
  useOnboardingFeedGeneration,
} from "./useOnboardingFeedGeneration";

function dedupeArtistsById<T extends { _id: string }>(artists: T[]): T[] {
  const seen = new Set<string>();
  return artists.filter((artist) => {
    const id = String(artist._id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

const OnboardingPage = () => {
  const { t } = useTranslation();
  const completeTasteOnboarding = useAuthStore(
    (s) => s.completeTasteOnboarding,
  );
  const isLoading = useAuthStore((s) => s.isLoading);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OnboardingArtist[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingFeed, setIsGeneratingFeed] = useState(false);

  useOnboardingFeedGeneration({
    enabled: isGeneratingFeed,
    onComplete: () => setIsGeneratingFeed(false),
  });

  const isSearchMode = debouncedQuery.length > 0;

  const {
    data: artistsPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingSuggested,
  } = useInfiniteQuery({
    queryKey: ["onboarding-artists"],
    queryFn: ({ pageParam }) => fetchOnboardingArtistsPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.reduce((sum, page) => sum + page.artists.length, 0);
    },
    enabled: !isSearchMode,
  });

  const suggestedArtists = useMemo(
    () =>
      dedupeArtistsById(
        artistsPages?.pages.flatMap((page) => page.artists) ?? [],
      ),
    [artistsPages],
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!debouncedQuery) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    void fetchSearch(debouncedQuery)
      .then((results) => {
        if (cancelled) return;
        setSearchResults(
          dedupeArtistsById(
            (results.artists || []).map((a) => ({
              _id: a._id,
              name: a.name,
              images: a.images,
            })),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) toast.error(t("onboarding.searchFailed"));
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, t]);

  useEffect(() => {
    if (isSearchMode || !hasNextPage || isFetchingNextPage) return;

    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isSearchMode, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const toggleArtist = useCallback(
    (artistId: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(artistId)) {
          next.delete(artistId);
          return next;
        }
        if (next.size >= TASTE_ONBOARDING_MAX_ARTISTS) {
          toast.error(
            t("onboarding.maxArtists", { count: TASTE_ONBOARDING_MAX_ARTISTS }),
          );
          return prev;
        }
        next.add(artistId);
        return next;
      });
    },
    [t],
  );

  const displayArtists = useMemo(
    () => dedupeArtistsById(isSearchMode ? searchResults : suggestedArtists),
    [isSearchMode, searchResults, suggestedArtists],
  );

  const handleContinue = async () => {
    if (selectedIds.size < TASTE_ONBOARDING_MIN_ARTISTS) return;
    markHomeFeedGenerating();
    setIsGeneratingFeed(true);
    setIsSubmitting(true);
    try {
      await completeTasteOnboarding([...selectedIds]);
    } catch {
      clearHomeFeedGenerating();
      setIsGeneratingFeed(false);
      toast.error(t("onboarding.submitFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isGeneratingFeed) {
    return <OnboardingGeneratingScreen />;
  }

  const renderArtistCard = (artist: OnboardingArtist) => {
    const isSelected = selectedIds.has(artist._id);
    return (
      <button
        key={artist._id}
        type="button"
        onClick={() => toggleArtist(artist._id)}
        className={cn(
          "flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl transition-all text-left w-full",
          isSelected ? "opacity-100" : "opacity-75 hover:opacity-100",
        )}
      >
        <div className="relative w-full aspect-square max-w-[100px] sm:max-w-[120px] md:max-w-[140px] lg:max-w-[152px] mx-auto">
          <CoverImage
            entity={artist}
            size="card"
            defaultUrl={CDN_DEFAULT_ARTIST_IMAGE}
            alt={artist.name}
            className={cn(
              "w-full h-full object-cover rounded-full transition-transform duration-200",
              isSelected && "scale-[1.03]",
            )}
          />
          {isSelected && (
            <>
              <span
                className="absolute inset-0 rounded-full bg-violet-500/30 pointer-events-none"
                aria-hidden
              />
              <span className="absolute bottom-1 right-1 bg-violet-500 rounded-full p-1 shadow-lg shadow-black/40">
                <Check className="w-4 h-4 text-black" strokeWidth={3} />
              </span>
            </>
          )}
        </div>
        <span
          className={cn(
            "text-sm lg:text-base font-medium text-center line-clamp-2 w-full leading-tight",
            isSelected ? "text-white" : "text-gray-300",
          )}
        >
          {artist.name}
        </span>
      </button>
    );
  };

  return (
    <>
      <Helmet>
        <title>{t("onboarding.title")} · Moodify Music</title>
      </Helmet>
      <div className="h-dvh min-h-screen bg-[#0f0f0f] text-white flex flex-col overflow-hidden">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 lg:px-12 py-8 lg:py-12 flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex justify-center mb-6 lg:mb-8">
            <MoodifyLogo />
          </div>

          <header className="text-center mb-8 lg:mb-10 max-w-2xl mx-auto">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3">
              {t("onboarding.title")}
            </h1>
            <p className="text-gray-400 text-sm sm:text-base lg:text-lg">
              {t("onboarding.subtitle", {
                count: TASTE_ONBOARDING_MIN_ARTISTS,
              })}
            </p>
            <p className="text-violet-400 text-sm lg:text-base mt-4 font-medium">
              {t("onboarding.selectedCount", {
                selected: selectedIds.size,
                min: TASTE_ONBOARDING_MIN_ARTISTS,
              })}
            </p>
          </header>

          <div className="relative mb-6 lg:mb-8 w-full max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("onboarding.searchPlaceholder")}
              className="pl-11 bg-gray-900 border-gray-700 h-12 lg:h-14 rounded-full text-base"
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain no-scrollbar pb-32 lg:pb-36">
            {isSearchMode && (
              <h2 className="text-lg lg:text-xl font-semibold mb-4 lg:mb-6">
                {t("onboarding.searchResultsTitle")}
              </h2>
            )}

            {!isSearchMode && isLoadingSuggested ? (
              <CardGridSkeleton count={12} />
            ) : isSearchMode && isSearching ? (
              <CardGridSkeleton count={6} />
            ) : displayArtists.length === 0 ? (
              <p className="text-gray-400 text-center py-12 text-base">
                {isSearchMode
                  ? t("onboarding.noSearchResults")
                  : t("onboarding.noArtists")}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                  {displayArtists.map(renderArtistCard)}
                </div>
                {!isSearchMode && (
                  <div
                    ref={loadMoreRef}
                    className="flex justify-center py-8 min-h-[48px]"
                  >
                    {isFetchingNextPage && (
                      <CardGridSkeleton count={6} className="w-full" />
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 lg:p-8 bg-gradient-to-t from-[#0f0f0f] from-60% via-[#0f0f0f]/95 to-transparent pointer-events-none">
            <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 lg:px-12 flex justify-center pointer-events-auto">
              <Button
                type="button"
                disabled={
                  selectedIds.size < TASTE_ONBOARDING_MIN_ARTISTS ||
                  isSubmitting ||
                  isLoading
                }
                onClick={() => void handleContinue()}
                className="w-full max-w-md h-12 lg:h-14 text-base bg-violet-500 hover:bg-violet-600 text-black font-bold rounded-full disabled:opacity-50"
              >
                {isSubmitting
                  ? t("onboarding.submitting")
                  : t("onboarding.continue")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default OnboardingPage;
