import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Newspaper, Play, RefreshCw } from 'lucide-react';
import type {
  AdaptivePalette,
  ArticleReaderPayload,
  BrowserOpenMode,
  GeneralNewsCategoryId,
  NewsCategoryId,
  NewsFeedItem,
  NewsFeedResponse,
  NsoCategoryId,
} from '../types/skyline';
import type { Switch2LayoutMetrics } from '../utils/rp5Layout';
import {
  GENERAL_NEWS_FALLBACK_BY_CATEGORY,
  NEWS_FALLBACK_BY_CATEGORY,
} from '../utils/rssFeedParser';
import { BottomControllerGlyph } from './BottomControllerGlyph';
import { SwitchPdfIcon } from './SwitchPdfIcons';
import { UiKitNewsIcon, UiKitNsoIcon } from './UiKitIcons';

interface NewsGridViewProps {
  mode: 'nso' | 'news';
  browserMode: BrowserOpenMode;
  palette: AdaptivePalette;
  metrics: Switch2LayoutMetrics;
  onOpenInBrowser: (url: string) => void;
  onClose: () => void;
}

const NSO_CATEGORIES: { id: NsoCategoryId; label: string }[] = [
  { id: 'nintendo', label: 'Nintendo' },
  { id: 'action', label: 'Action' },
  { id: 'rpg', label: 'RPG' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'indie', label: 'Indie' },
  { id: 'multiplayer', label: 'Multiplayer' },
];

const GENERAL_NEWS_CATEGORIES: { id: GeneralNewsCategoryId; label: string }[] = [
  { id: 'latest', label: 'Latest News' },
  { id: 'elnuevodia', label: 'El Nuevo Día' },
  { id: 'puerto_rico', label: 'Puerto Rico' },
  { id: 'r_puertorico', label: 'r/PuertoRico' },
  { id: 'politics', label: 'Politics' },
  { id: 'economy', label: 'Economy' },
  { id: 'tech', label: 'Tech' },
];

const LOCAL_FALLBACK_ART = '/src/assets/images/cover_crimson_odyssey_1795374633248.jpg';

/**
 * Powers both Nintendo Online and News:
 * - Nintendo Online: Nintendo + game genres (Action, RPG, Adventure, Indie, Multiplayer)
 * - News: El Nuevo Día, Puerto Rico, r/PuertoRico, Politics, Economy, Tech, Latest News
 * - Bold Nintendo-style titles + larger readable descriptions
 * - Fullscreen news reader: top half photo (or video), bottom half complete story scrollable via analog/D-Pad
 * - Big red Open button, no "Back to Grid" text, Refresh placed in bottom controls bar
 */
export function NewsGridView({
  mode,
  browserMode,
  palette,
  metrics,
  onOpenInBrowser,
  onClose,
}: NewsGridViewProps) {
  const activeCategories = mode === 'nso' ? NSO_CATEGORIES : GENERAL_NEWS_CATEGORIES;
  const [category, setCategory] = useState<NewsCategoryId>(
    mode === 'nso' ? 'nintendo' : 'latest'
  );
  const [focusZone, setFocusZone] = useState<'cats' | 'grid'>('grid');
  const [focusedCatIdx, setFocusedCatIdx] = useState(0);

  const [items, setItems] = useState<NewsFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMoreFromServer, setHasMoreFromServer] = useState(true);
  const [serverBatchPage, setServerBatchPage] = useState(1);
  const [pageIdx, setPageIdx] = useState(0);
  const [focusedIdx, setFocusedIdx] = useState(0);

  const [activeArticle, setActiveArticle] = useState<NewsFeedItem | null>(null);
  const [articleDetails, setArticleDetails] = useState<ArticleReaderPayload | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [playingVideoInApp, setPlayingVideoInApp] = useState(false);

  const latestReqIdRef = useRef(0);
  const storyScrollRef = useRef<HTMLDivElement>(null);

  // Keep category aligned when switching between Nintendo Online and News
  useEffect(() => {
    setCategory(mode === 'nso' ? 'nintendo' : 'latest');
    setFocusedCatIdx(0);
    setActiveArticle(null);
    setFocusZone('grid');
  }, [mode]);

  const fetchFeed = useCallback(
    async (forceRefresh = false, nextBatchPage = 1, append = false) => {
      const reqId = ++latestReqIdRef.current;
      const validCat =
        mode === 'nso'
          ? (category in NEWS_FALLBACK_BY_CATEGORY ? (category as NsoCategoryId) : 'nintendo')
          : (category in GENERAL_NEWS_FALLBACK_BY_CATEGORY
              ? (category as GeneralNewsCategoryId)
              : 'latest');

      if (!append) {
        setItems([]);
        setPageIdx(0);
        setFocusedIdx(0);
        setServerBatchPage(1);
      }
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const sp = new URLSearchParams();
        sp.set('page', String(nextBatchPage));
        sp.set('category', validCat);
        if (forceRefresh) sp.set('refresh', '1');

        const endpoint =
          mode === 'nso'
            ? `/api/feeds/nso?${sp.toString()}`
            : `/api/feeds/news?${sp.toString()}`;
        const res = await fetch(endpoint);
        const json = (await res.json()) as NewsFeedResponse;
        if (reqId !== latestReqIdRef.current) return;

        if (Array.isArray(json.items) && json.items.length > 0) {
          if (append) {
            setItems((prev) => {
              const seen = new Set(prev.map((x) => x.id));
              const extra = json.items.filter((x) => !seen.has(x.id));
              return [...prev, ...extra];
            });
          } else {
            setItems(json.items);
          }
          setHasMoreFromServer(Boolean(json.hasMore));
          setServerBatchPage(nextBatchPage);
        } else if (!append) {
          const offlineFallback =
            mode === 'nso'
              ? NEWS_FALLBACK_BY_CATEGORY[validCat as NsoCategoryId]
              : GENERAL_NEWS_FALLBACK_BY_CATEGORY[validCat as GeneralNewsCategoryId];
          setItems(offlineFallback);
          setHasMoreFromServer(false);
        }
      } catch {
        if (!append && reqId === latestReqIdRef.current) {
          const offlineFallback =
            mode === 'nso'
              ? NEWS_FALLBACK_BY_CATEGORY[validCat as NsoCategoryId]
              : GENERAL_NEWS_FALLBACK_BY_CATEGORY[validCat as GeneralNewsCategoryId];
          setItems(offlineFallback);
        }
      } finally {
        if (reqId === latestReqIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [mode, category]
  );

  useEffect(() => {
    fetchFeed(false, 1, false);
  }, [fetchFeed]);

  const openStoryReader = useCallback(async (item: NewsFeedItem) => {
    setActiveArticle(item);
    setPlayingVideoInApp(false);
    setArticleDetails(null);
    setArticleLoading(true);
    try {
      const res = await fetch(`/api/feeds/article?url=${encodeURIComponent(item.url)}`);
      if (res.ok) {
        const payload = (await res.json()) as ArticleReaderPayload;
        setArticleDetails(payload);
      }
    } catch {
      // Keep item fallback text
    } finally {
      setArticleLoading(false);
    }
  }, []);

  const totalPages = Math.max(1, Math.ceil(items.length / 4));
  const pageItems = items.slice(pageIdx * 4, pageIdx * 4 + 4);

  const goNextPage = useCallback(() => {
    if (pageIdx + 1 < totalPages) {
      setPageIdx((p) => p + 1);
      setFocusedIdx(0);
    } else if (hasMoreFromServer && !loading) {
      fetchFeed(false, serverBatchPage + 1, true).then(() => {
        setPageIdx((p) => p + 1);
        setFocusedIdx(0);
      });
    }
  }, [fetchFeed, hasMoreFromServer, loading, pageIdx, serverBatchPage, totalPages]);

  const handleOpenExternalUrl = useCallback(
    (targetUrl: string) => {
      if (browserMode === 'in-app') {
        onOpenInBrowser(targetUrl);
      } else {
        const isAndroid = /android/i.test(navigator.userAgent);
        if (isAndroid) {
          window.location.href = `googlechrome://navigate?url=${encodeURIComponent(targetUrl)}`;
        } else {
          const link = document.createElement('a');
          link.href = targetUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    },
    [browserMode, onOpenInBrowser]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (playingVideoInApp) setPlayingVideoInApp(false);
        else if (activeArticle) setActiveArticle(null);
        else onClose();
        return;
      }

      if (activeArticle) {
        if (e.key === 'ArrowDown' || e.key === 'PageDown') {
          e.preventDefault();
          e.stopPropagation();
          storyScrollRef.current?.scrollBy({ top: e.key === 'PageDown' ? 220 : 90, behavior: 'smooth' });
        } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
          e.preventDefault();
          e.stopPropagation();
          storyScrollRef.current?.scrollBy({ top: e.key === 'PageUp' ? -220 : -90, behavior: 'smooth' });
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          const url = articleDetails?.videoUrl || activeArticle.videoUrl || activeArticle.url;
          handleOpenExternalUrl(url);
        }
        return;
      }

      if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        e.stopPropagation();
        fetchFeed(true, 1, false);
        return;
      }

      if (focusZone === 'cats') {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          const next = (focusedCatIdx + 1) % activeCategories.length;
          setFocusedCatIdx(next);
          setCategory(activeCategories[next].id);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          const prev = (focusedCatIdx - 1 + activeCategories.length) % activeCategories.length;
          setFocusedCatIdx(prev);
          setCategory(activeCategories[prev].id);
        } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          setFocusZone('grid');
          setFocusedIdx(0);
        }
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        if (focusedIdx + 1 < pageItems.length) {
          setFocusedIdx((p) => p + 1);
        } else {
          goNextPage();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        if (focusedIdx > 0) {
          setFocusedIdx((p) => p - 1);
        } else if (pageIdx > 0) {
          setPageIdx((p) => p - 1);
          setFocusedIdx(3);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIdx((p) => (p + 2 < pageItems.length ? p + 2 : p));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (focusedIdx - 2 >= 0) {
          setFocusedIdx((p) => p - 2);
        } else {
          setFocusZone('cats');
        }
      } else if (e.key === 'Enter' && pageItems[focusedIdx]) {
        e.preventDefault();
        e.stopPropagation();
        openStoryReader(pageItems[focusedIdx]);
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [
    activeCategories,
    activeArticle,
    articleDetails,
    fetchFeed,
    focusZone,
    focusedCatIdx,
    focusedIdx,
    goNextPage,
    handleOpenExternalUrl,
    onClose,
    openStoryReader,
    pageIdx,
    pageItems,
    playingVideoInApp,
  ]);

  const h = metrics.viewportHeight;
  const padX = Math.max(24, Math.round(metrics.screenMargin * 0.92));
  const isDark = palette.isDark;
  const bg = isDark ? '#16181D' : '#EFEFEF';
  const cardBg = isDark ? '#23262F' : '#FFFFFF';
  const textMain = isDark ? '#F3F4F6' : '#181B20';
  const textMuted = isDark ? '#B0B7C3' : '#4B5563';
  const divider = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)';
  const accentColor = mode === 'nso' ? '#E60012' : '#2BAB23';

  const resolvedHeroImage =
    (activeArticle && articleDetails?.heroImageUrl) || activeArticle?.imageUrl || LOCAL_FALLBACK_ART;
  const resolvedVideoUrl =
    (activeArticle && articleDetails?.videoUrl) || activeArticle?.videoUrl;
  const storyParagraphs =
    activeArticle && articleDetails?.paragraphs && articleDetails.paragraphs.length > 0
      ? articleDetails.paragraphs
      : activeArticle?.content
          .split(/\n+/)
          .map((p) => p.trim())
          .filter(Boolean) ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'nso' ? 'Nintendo Online' : 'News'}
      data-testid={mode === 'nso' ? 'nso-view' : 'news-view'}
      className="animate-ns2-fade absolute inset-0 z-40 flex flex-col overflow-hidden select-none"
      style={{ backgroundColor: bg, color: textMain }}
    >
      {/* Top Header + Controller-Selectable Genre Bookmarks */}
      <div style={{ paddingLeft: `${padX}px`, paddingRight: `${padX}px` }}>
        <div
          className="flex items-center justify-between gap-4"
          style={{ height: `${Math.max(50, Math.round(h * 0.11))}px` }}
        >
          <div className="flex items-center gap-3 shrink-0">
            {mode === 'nso' ? (
              <UiKitNsoIcon size={30} highlighted={true} />
            ) : (
              <UiKitNewsIcon size={30} />
            )}
            <h1
              className="font-ud-bold tracking-tight"
              style={{ fontSize: `${Math.max(19, Math.round(h * 0.038))}px` }}
            >
              {mode === 'nso' ? 'Nintendo Online' : 'News'}
            </h1>
          </div>

          <nav
            aria-label="Categories"
            data-testid="news-category-bar"
            className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1"
          >
            {activeCategories.map((cat, idx) => {
              const active = category === cat.id;
              const isCatFocused = focusZone === 'cats' && focusedCatIdx === idx;
              return (
                <button
                  key={cat.id}
                  type="button"
                  data-testid={`news-cat-${cat.id}`}
                  onClick={() => {
                    setCategory(cat.id);
                    setFocusedCatIdx(idx);
                    setFocusZone('grid');
                  }}
                  className={`px-3.5 py-1.5 rounded-full whitespace-nowrap cursor-pointer transition-all ${
                    active ? 'font-ud-bold' : 'font-ud-semibold'
                  }`}
                  style={{
                    fontSize: `${Math.max(12, Math.round(h * 0.021))}px`,
                    backgroundColor: active ? accentColor : cardBg,
                    color: active ? '#FFFFFF' : textMain,
                    border: isCatFocused
                      ? `2.5px solid ${palette.dockRingColor}`
                      : active
                        ? `2px solid ${accentColor}`
                        : `1px solid ${divider}`,
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="w-full h-px" style={{ backgroundColor: divider }} />
      </div>

      {/* Main 2x2 Squared Cards Grid */}
      <div
        className="flex-1 flex flex-col justify-center min-h-0"
        style={{
          paddingLeft: `${padX}px`,
          paddingRight: `${padX}px`,
          paddingTop: `${Math.max(12, Math.round(h * 0.022))}px`,
          paddingBottom: `${Math.max(10, Math.round(h * 0.02))}px`,
        }}
      >
        {loading && pageItems.length === 0 ? (
          <div className="grid grid-cols-2 grid-rows-2 gap-4 h-full">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl"
                style={{ backgroundColor: cardBg, opacity: 0.75 }}
              />
            ))}
          </div>
        ) : pageItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 text-sm opacity-70">
            <Newspaper className="w-8 h-8" />
            <span>No articles available in this feed right now.</span>
          </div>
        ) : (
          <div
            data-testid="news-2x2-grid"
            className="grid grid-cols-2 grid-rows-2 gap-4 h-full min-h-0"
          >
            {pageItems.map((item, idx) => {
              const isSelected = focusZone === 'grid' && focusedIdx === idx;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`news-card-${idx}`}
                  onMouseEnter={() => {
                    setFocusZone('grid');
                    setFocusedIdx(idx);
                  }}
                  onClick={() => openStoryReader(item)}
                  className="relative flex flex-col overflow-hidden text-left cursor-pointer focus:outline-none transition-transform duration-150"
                  style={{
                    backgroundColor: cardBg,
                    borderRadius: '10px',
                    boxShadow: 'none',
                  }}
                >
                  {/* Selection border rendered ABOVE artwork */}
                  {isSelected && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 z-30"
                      style={{
                        borderRadius: '10px',
                        border: `3.5px solid #E60012`,
                      }}
                    />
                  )}

                  {/* Top 50%: High-Res Photo */}
                  <div className="w-full h-1/2 overflow-hidden bg-black/25 shrink-0 relative">
                    <img
                      src={item.imageUrl || LOCAL_FALLBACK_ART}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (img.dataset.fbApplied !== '1') {
                          img.dataset.fbApplied = '1';
                          img.src = LOCAL_FALLBACK_ART;
                        }
                      }}
                      className="w-full h-full object-cover block"
                    />
                    <span
                      className="absolute top-2 left-2 px-2.5 py-0.5 rounded text-[11px] font-ud-bold text-white"
                      style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}
                    >
                      {item.sourceName}
                    </span>
                    {item.videoUrl && (
                      <span
                        className="absolute top-2 right-2 px-2 py-0.5 rounded text-[11px] font-ud-bold text-white flex items-center gap-1"
                        style={{ backgroundColor: accentColor }}
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>Video</span>
                      </span>
                    )}
                  </div>

                  {/* Bottom 50%: Big Bold Nintendo-Style Title + Larger Readable Description */}
                  <div className="w-full h-1/2 px-4 py-2.5 flex flex-col justify-center gap-1.5 min-h-0">
                    <h3
                      className="font-ud-bold leading-snug line-clamp-2 tracking-tight"
                      style={{
                        fontSize: `${Math.max(15, Math.round(h * 0.03))}px`,
                        color: textMain,
                      }}
                    >
                      {item.title}
                    </h3>
                    <p
                      className="font-ud-regular leading-snug line-clamp-2"
                      style={{
                        fontSize: `${Math.max(12, Math.round(h * 0.022))}px`,
                        color: textMuted,
                      }}
                    >
                      {item.summary}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Controller Bar (Refresh moved here as requested) */}
      <footer style={{ paddingLeft: `${padX}px`, paddingRight: `${padX}px` }}>
        <div className="w-full h-px" style={{ backgroundColor: divider }} />
        <div
          className="flex items-center justify-between"
          style={{ height: `${Math.max(42, Math.round(h * 0.088))}px` }}
        >
          <div className="flex items-center gap-4">
            <BottomControllerGlyph size={metrics.helpIconSize} color={textMain} />

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="news-prev-page"
                disabled={pageIdx <= 0}
                onClick={() => {
                  setPageIdx((p) => Math.max(0, p - 1));
                  setFocusedIdx(0);
                }}
                aria-label="Previous news page"
                className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer disabled:opacity-35 hover:bg-black/5"
              >
                <SwitchPdfIcon
                  button="STICK_L"
                  size={20}
                  fillColor={textMain}
                  cutoutColor={bg}
                />
                <span className="text-xs font-ud-semibold">Prev</span>
              </button>
              <span
                data-testid="news-page-indicator"
                className="text-xs font-mono-tabular"
                style={{ color: textMuted }}
              >
                {pageIdx + 1} / {totalPages}
                {hasMoreFromServer ? '+' : ''}
              </span>
              <button
                type="button"
                data-testid="news-next-page"
                disabled={pageIdx + 1 >= totalPages && !hasMoreFromServer}
                onClick={goNextPage}
                aria-label="Next news page"
                className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer disabled:opacity-35 hover:bg-black/5"
              >
                <SwitchPdfIcon
                  button="STICK_R"
                  size={20}
                  fillColor={textMain}
                  cutoutColor={bg}
                />
                <span className="text-xs font-ud-semibold">
                  {pageIdx + 1 >= totalPages && hasMoreFromServer ? 'Load More' : 'Next'}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button
              type="button"
              data-testid="news-refresh-btn"
              onClick={() => fetchFeed(true, 1, false)}
              className="flex items-center gap-2 cursor-pointer hover:opacity-75"
            >
              <SwitchPdfIcon
                button="X"
                size={Math.max(20, Math.round(metrics.helpIconSize * 0.65))}
                fillColor={textMain}
                cutoutColor={bg}
              />
              <span
                className="font-ud-semibold flex items-center gap-1"
                style={{ fontSize: `${metrics.helpFontSize}px`, color: textMain }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 cursor-pointer hover:opacity-75"
            >
              <SwitchPdfIcon
                button="B"
                size={Math.max(20, Math.round(metrics.helpIconSize * 0.65))}
                fillColor={textMain}
                cutoutColor={bg}
              />
              <span
                className="font-ud-semibold"
                style={{ fontSize: `${metrics.helpFontSize}px`, color: textMain }}
              >
                Back
              </span>
            </button>

            {pageItems[focusedIdx] && (
              <button
                type="button"
                onClick={() => openStoryReader(pageItems[focusedIdx])}
                className="flex items-center gap-2 cursor-pointer hover:opacity-75"
              >
                <SwitchPdfIcon
                  button="A"
                  size={Math.max(20, Math.round(metrics.helpIconSize * 0.65))}
                  fillColor={textMain}
                  cutoutColor={bg}
                />
                <span
                  className="font-ud-semibold"
                  style={{ fontSize: `${metrics.helpFontSize}px`, color: textMain }}
                >
                  Open
                </span>
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* FULLSCREEN News Reader: Top Half Photo, Bottom Half Complete Scrollable News (Up/Down Analog), Big Red Open */}
      {activeArticle && (
        <article
          data-testid="news-full-reader"
          className="animate-ns2-fade absolute inset-0 z-50 flex flex-col overflow-hidden"
          style={{ backgroundColor: bg, color: textMain }}
        >
          {/* Top Half: Full-Width Photo or Video */}
          <div className="relative w-full h-[46%] shrink-0 bg-black overflow-hidden">
            {playingVideoInApp && resolvedVideoUrl ? (
              resolvedVideoUrl.endsWith('.mp4') ? (
                <video
                  src={resolvedVideoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain bg-black"
                />
              ) : (
                <iframe
                  src={`${resolvedVideoUrl}?autoplay=1`}
                  title={activeArticle.title}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  className="w-full h-full border-0 bg-black"
                />
              )
            ) : (
              <img
                src={resolvedHeroImage}
                alt={activeArticle.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.dataset.fbApplied !== '1') {
                    img.dataset.fbApplied = '1';
                    img.src = LOCAL_FALLBACK_ART;
                  }
                }}
                className="w-full h-full object-cover block"
              />
            )}

            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
              style={{
                background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.65) 100%)',
              }}
            />

            <div className="absolute top-3.5 left-5 flex items-center gap-2.5">
              <span
                className="px-3 py-1 rounded-full text-xs font-ud-bold text-white"
                style={{ backgroundColor: '#E60012' }}
              >
                {activeArticle.sourceName}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-ud-semibold bg-black/70 text-white">
                {activeArticle.publishedAt}
              </span>
            </div>
          </div>

          {/* Bottom Half: Scrollable Complete News Story */}
          <div
            ref={storyScrollRef}
            className="flex-1 min-h-0 overflow-y-auto no-scrollbar"
            style={{
              paddingLeft: `${padX * 1.15}px`,
              paddingRight: `${padX * 1.15}px`,
              paddingTop: '16px',
              paddingBottom: '16px',
            }}
          >
            <h2
              className="font-ud-bold leading-tight tracking-tight mb-3"
              style={{ fontSize: `${Math.max(22, Math.round(h * 0.044))}px` }}
            >
              {activeArticle.title}
            </h2>

            {articleLoading && (
              <p className="text-xs font-ud-semibold mb-2" style={{ color: accentColor }}>
                Loading complete story...
              </p>
            )}

            <div className="space-y-3 pb-4">
              {storyParagraphs.map((para, i) => (
                <p
                  key={i}
                  className="font-ud-regular leading-relaxed"
                  style={{
                    fontSize: `${Math.max(15, Math.round(h * 0.027))}px`,
                    color: isDark ? '#E5E7EB' : '#23272F',
                  }}
                >
                  {para}
                </p>
              ))}
            </div>
          </div>

          {/* Reader Bottom Bar: Big Red Open Button + Scroll Hint + B Close */}
          <footer style={{ paddingLeft: `${padX}px`, paddingRight: `${padX}px` }}>
            <div className="w-full h-px" style={{ backgroundColor: divider }} />
            <div
              className="flex items-center justify-between"
              style={{ height: `${Math.max(52, Math.round(h * 0.1))}px` }}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  data-testid="news-open-browser"
                  onClick={() => handleOpenExternalUrl(resolvedVideoUrl || activeArticle.url)}
                  className="inline-flex items-center gap-2.5 px-7 py-2.5 rounded-xl font-ud-bold text-white cursor-pointer hover:opacity-90 active:scale-[0.98] transition-transform"
                  style={{
                    backgroundColor: '#E60012',
                    fontSize: `${Math.max(14, Math.round(h * 0.026))}px`,
                  }}
                >
                  <span>Open</span>
                  <ExternalLink className="w-4 h-4" />
                </button>

                {resolvedVideoUrl && (
                  <button
                    type="button"
                    data-testid="news-play-video-in-app"
                    onClick={() => setPlayingVideoInApp((v) => !v)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-ud-bold text-white cursor-pointer"
                    style={{ backgroundColor: '#0EA5E9' }}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{playingVideoInApp ? 'Photo' : 'Video'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-6">
                <span className="text-xs font-ud-regular" style={{ color: textMuted }}>
                  Analog / ↑↓ Scroll
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (playingVideoInApp) setPlayingVideoInApp(false);
                    else setActiveArticle(null);
                  }}
                  className="flex items-center gap-2 cursor-pointer hover:opacity-75"
                >
                  <SwitchPdfIcon
                    button="B"
                    size={Math.max(20, Math.round(metrics.helpIconSize * 0.65))}
                    fillColor={textMain}
                    cutoutColor={bg}
                  />
                  <span
                    className="font-ud-semibold"
                    style={{ fontSize: `${metrics.helpFontSize}px`, color: textMain }}
                  >
                    Back
                  </span>
                </button>
              </div>
            </div>
          </footer>
        </article>
      )}
    </div>
  );
}
