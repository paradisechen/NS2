import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Download,
  FolderOpen,
  Globe,
  HelpCircle,
  ImagePlus,
  Minus,
  Pencil,
  RotateCcw,
  Sun,
  UserPlus,
  Users,
  Volume2,
} from 'lucide-react';
import type {
  AdaptivePalette,
  AlbumPhotoItem,
  GameItem,
  SkylineConfig,
  ThemeAppearanceMode,
  UserProfile,
} from '../types/skyline';
import { HUD_THEME_SWATCHES } from '../utils/artworkPalette';
import { buildSkylineConfigQueryString } from '../utils/skylineConfigQuery';
import { DEFAULT_SKYLINE_CONFIG, type Switch2LayoutMetrics } from '../utils/rp5Layout';
import { playUiSound } from '../utils/uiSounds';
import { SwitchPdfIcon } from './SwitchPdfIcons';
import { UiKitAvatar } from './UiKitAvatar';
import { BottomControllerGlyph } from './BottomControllerGlyph';

export type ProfileSettingsTab =
  | 'profile'
  | 'friends'
  | 'customize'
  | 'hud'
  | 'userSettings'
  | 'about';

interface ProfileSettingsViewProps {
  initialTab?: ProfileSettingsTab;
  activeUser: UserProfile;
  users: UserProfile[];
  games: GameItem[];
  config: SkylineConfig;
  palette: AdaptivePalette;
  metrics: Switch2LayoutMetrics;
  onUpdateConfig: (next: SkylineConfig) => void;
  onRenameUser: (userId: string, nextName: string) => void;
  onSelectUser: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  onLoadAlbumPhotos: (photos: AlbumPhotoItem[], folderLabel: string) => void;
  onApplyAlbumDirectory?: (dirPath: string) => void;
  onOpenUserSelect: () => void;
  onSelectGame: (idx: number) => void;
  onClose: () => void;
}

export function ProfileSettingsView({
  initialTab = 'profile',
  activeUser,
  users,
  games,
  config,
  palette,
  metrics,
  onUpdateConfig,
  onRenameUser,
  onSelectUser,
  onDeleteUser,
  onLoadAlbumPhotos,
  onApplyAlbumDirectory,
  onOpenUserSelect,
  onSelectGame,
  onClose,
}: ProfileSettingsViewProps) {
  const [activeTab, setActiveTab] = useState<ProfileSettingsTab>(initialTab);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(activeUser.name);
  const [albumDirDraft, setAlbumDirDraft] = useState(config.albumFolderLabel);
  const [showActivityHelp, setShowActivityHelp] = useState(false);
  const [downloadingTheme, setDownloadingTheme] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const albumFolderInputRef = useRef<HTMLInputElement>(null);
  const albumFilesInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setDraftName(activeUser.name);
  }, [activeUser.name]);

  useEffect(() => {
    setAlbumDirDraft(config.albumFolderLabel);
  }, [config.albumFolderLabel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const isDarkPage =
    config.appearanceMode === 'dark' || (config.appearanceMode === 'auto' && palette.isDark);
  const selectedHudSwatch = HUD_THEME_SWATCHES.find((s) => s.id === config.hudThemeId);
  const accentColor =
    config.hudThemeId !== 'auto' && selectedHudSwatch
      ? selectedHudSwatch.hex
      : isDarkPage
        ? '#38BDF8'
        : '#0B6BE8';

  const pageBg = isDarkPage ? '#1A1C21' : '#EFEFEF';
  const sidebarBg = isDarkPage ? '#22252C' : '#EAEAEA';
  const textMain = isDarkPage ? '#F3F4F6' : '#2C2C2C';
  const textMuted = isDarkPage ? '#9CA3AF' : '#6B7280';
  const dividerColor = isDarkPage ? 'rgba(255,255,255,0.12)' : '#C8C8C8';
  const focusCyanBorder = accentColor;

  const h = metrics.viewportHeight;
  const padX = Math.max(24, Math.round(metrics.screenMargin * 0.9));
  const currentGame =
    [...games].sort((a, b) => (b.lastPlayedSeq ?? 0) - (a.lastPlayedSeq ?? 0))[0] ??
    games[0] ??
    null;

  const downloadHref = `/api/download/pegasus-theme.zip?${buildSkylineConfigQueryString(config)}`;

  const handleDownloadThemeZip = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (downloadingTheme) return;
    setDownloadingTheme(true);
    setDownloadError(null);
    setDownloadSuccess(false);
    try {
      const freshUrl = `${downloadHref}&_t=${Date.now()}`;
      const response = await fetch(freshUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('zip') && !contentType.includes('octet-stream')) {
        throw new Error('Invalid theme archive response');
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'skylineos2-pegasus-theme.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
      playUiSound('confirm', config.uiSoundsEnabled);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2600);
    } catch (err) {
      playUiSound('error', config.uiSoundsEnabled);
      setDownloadError(
        err instanceof Error ? `Download failed: ${err.message}` : 'Failed to download theme ZIP'
      );
    } finally {
      setDownloadingTheme(false);
    }
  };

  const handleAlbumFileChange = (e: React.ChangeEvent<HTMLInputElement>, isFolderPick: boolean) => {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)
    );
    if (files.length === 0) return;

    const loaded: AlbumPhotoItem[] = files.slice(0, 60).map((file, idx) => ({
      id: `local-${Date.now()}-${idx}`,
      name: file.name,
      url: URL.createObjectURL(file),
      addedAt: 'Synced from Folder',
    }));

    let nextLabel = config.albumFolderLabel;
    if (isFolderPick) {
      const rel = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath;
      const topDir = rel?.split('/')[0];
      if (topDir) nextLabel = `/storage/emulated/0/${topDir}`;
    } else {
      nextLabel = `${files.length} Local Photo${files.length === 1 ? '' : 's'} Selected`;
    }

    onLoadAlbumPhotos(loaded, nextLabel);
    e.target.value = '';
  };

  const navItems: {
    id: ProfileSettingsTab;
    label: string;
    subtitle?: string;
    dividerAfter?: boolean;
  }[] = [
    { id: 'profile', label: 'Profile', dividerAfter: true },
    { id: 'friends', label: 'Friend List' },
    { id: 'customize', label: 'Customize' },
    { id: 'hud', label: 'HUD', dividerAfter: true },
    { id: 'userSettings', label: 'User Settings' },
    { id: 'about', label: 'About' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${activeUser.name}’s Settings`}
      data-testid="profile-settings-view"
      className="animate-ns2-fade absolute inset-0 z-40 flex flex-col overflow-hidden select-none"
      style={{ backgroundColor: pageBg, color: textMain }}
    >
      {/* Top Header Row — "{User}'s Settings" */}
      <div style={{ paddingLeft: `${padX}px`, paddingRight: `${padX}px` }}>
        <div
          className="flex items-center justify-between"
          style={{ height: `${Math.max(48, Math.round(h * 0.115))}px` }}
        >
          <div className="flex items-center gap-3.5">
            <UiKitAvatar
              characterId={activeUser.characterId}
              size={Math.max(32, Math.round(h * 0.068))}
              roundedClass="rounded-full"
              alt={activeUser.name}
            />
            <h1
              data-testid="settings-header-title"
              className="font-ud-medium tracking-tight"
              style={{ fontSize: `${Math.max(18, Math.round(h * 0.036))}px` }}
            >
              {activeUser.name}&rsquo;s Settings
            </h1>
          </div>
        </div>
        <div className="w-full h-px" style={{ backgroundColor: dividerColor }} />
      </div>

      {/* Main Split Section */}
      <div className="flex-1 flex min-h-0">
        <aside
          className="flex flex-col shrink-0 overflow-y-auto no-scrollbar"
          style={{
            width: '29.5%',
            backgroundColor: sidebarBg,
            paddingLeft: `${padX}px`,
            paddingRight: `${Math.max(16, Math.round(padX * 0.6))}px`,
            paddingTop: `${Math.max(14, Math.round(h * 0.03))}px`,
          }}
        >
          <div className="space-y-1.5">
            {navItems.map((item) => {
              const isSelected = activeTab === item.id;
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    data-testid={`profile-tab-${item.id}`}
                    onClick={() => {
                      playUiSound('tick', config.uiSoundsEnabled);
                      setActiveTab(item.id);
                    }}
                    className="relative w-full text-left px-3.5 py-2.5 cursor-pointer focus:outline-none"
                    style={{
                      backgroundColor: isSelected
                        ? isDarkPage
                          ? '#2C303A'
                          : '#FFFFFF'
                        : 'transparent',
                      border: isSelected
                        ? `3px solid ${focusCyanBorder}`
                        : '3px solid transparent',
                    }}
                  >
                    {isSelected && (
                      <span
                        aria-hidden="true"
                        className="absolute left-1.5 top-2 bottom-2 w-[3.5px]"
                        style={{ backgroundColor: accentColor }}
                      />
                    )}
                    <div
                      className={`pl-1.5 leading-snug ${isSelected ? 'font-ud-medium' : 'font-ud-regular'}`}
                      style={{
                        fontSize: `${Math.max(16, Math.round(h * 0.032))}px`,
                        color: isSelected ? accentColor : textMain,
                      }}
                    >
                      {item.label}
                    </div>
                    {item.subtitle && (
                      <div
                        className="pl-1.5 font-ud-regular mt-0.5"
                        style={{
                          fontSize: `${Math.max(12, Math.round(h * 0.022))}px`,
                          color: textMuted,
                        }}
                      >
                        {item.subtitle}
                      </div>
                    )}
                  </button>

                  {item.dividerAfter && (
                    <div
                      className="my-2 w-full h-px"
                      style={{ backgroundColor: dividerColor }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <section
          className="flex-1 overflow-y-auto no-scrollbar"
          style={{
            paddingLeft: `${Math.max(28, Math.round(padX * 1.15))}px`,
            paddingRight: `${Math.max(28, Math.round(padX * 1.15))}px`,
            paddingTop: `${Math.max(18, Math.round(h * 0.036))}px`,
            paddingBottom: `${Math.max(16, Math.round(h * 0.03))}px`,
          }}
        >
          {/* TAB 1: Profile */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="flex items-start gap-7">
                <div className="shrink-0 overflow-hidden">
                  <UiKitAvatar
                    characterId={activeUser.characterId}
                    size={Math.max(118, Math.round(h * 0.255))}
                    roundedClass="rounded-none"
                    alt={activeUser.name}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

                  {/* Row 1: Username + Pencil Edit */}
                  <div className="flex items-center justify-between py-2.5 px-1">
                    {editingName ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const trimmed = draftName.trim();
                          if (trimmed) onRenameUser(activeUser.id, trimmed);
                          setEditingName(false);
                        }}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          maxLength={14}
                          autoFocus
                          className="px-2 py-0.5 text-sm font-ud-regular rounded focus:outline-none"
                          style={{
                            border: `2px solid ${focusCyanBorder}`,
                            backgroundColor: isDarkPage ? '#2C303A' : '#FFFFFF',
                            color: textMain,
                          }}
                        />
                        <button
                          type="submit"
                          className="px-2.5 py-1 rounded text-xs font-ud-medium text-white cursor-pointer"
                          style={{ backgroundColor: accentColor }}
                        >
                          Save
                        </button>
                      </form>
                    ) : (
                      <>
                        <span
                          className="font-ud-semibold"
                          style={{ fontSize: `${Math.max(19, Math.round(h * 0.04))}px` }}
                        >
                          {activeUser.name}
                        </span>
                        <button
                          type="button"
                          aria-label="Edit user name"
                          onClick={() => setEditingName(true)}
                          className="p-1.5 rounded hover:bg-black/5 cursor-pointer"
                          style={{ color: textMuted }}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

                  {currentGame && (
                    <div className="flex items-center gap-3.5 py-2.5 px-1">
                      <img
                        src={currentGame.coverUrl}
                        alt={currentGame.title}
                        referrerPolicy="no-referrer"
                        className="w-13 h-13 object-cover shrink-0 rounded-sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-xs"
                            style={{ backgroundColor: '#2ED573' }}
                          />
                          <span
                            className="font-ud-bold"
                            style={{
                              color: '#2ED573',
                              fontSize: `${Math.max(13, Math.round(h * 0.025))}px`,
                            }}
                          >
                            Online · Last Played
                          </span>
                        </div>
                        <div
                          className="font-ud-semibold truncate mt-0.5"
                          style={{ fontSize: `${Math.max(15, Math.round(h * 0.03))}px` }}
                        >
                          {currentGame.title}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

                  <div
                    className="py-2.5 px-1 font-ud-regular"
                    style={{ fontSize: `${Math.max(14, Math.round(h * 0.027))}px` }}
                  >
                    <span style={{ color: textMuted }}>Friend Code: </span>
                    <span className="font-ud-semibold tabular-nums">
                      {activeUser.friendCode || 'SW-1234-5678-9012'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Play Activity */}
              <div>
                <div className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-1 h-4"
                      style={{ backgroundColor: isDarkPage ? '#94A3B8' : '#4A4E57' }}
                    />
                    <h2
                      className="font-ud-medium"
                      style={{ fontSize: `${Math.max(13, Math.round(h * 0.028))}px` }}
                    >
                      Play Activity
                    </h2>
                  </div>
                  <button
                    type="button"
                    aria-label="Play Activity Info"
                    onClick={() => setShowActivityHelp((v) => !v)}
                    className="cursor-pointer hover:opacity-75"
                    style={{ color: textMuted }}
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>

                {showActivityHelp && (
                  <div
                    className="mb-2 px-3 py-1.5 text-xs font-ud-regular"
                    style={{ backgroundColor: sidebarBg, color: textMuted }}
                  >
                    Play hours track games launched through SkylineOS 2 on this Retroid Pocket 5.
                  </div>
                )}

                <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

                <div data-testid="profile-play-activity">
                  {games.slice(0, 5).map((g, idx) => (
                    <div key={g.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectGame(idx);
                          onClose();
                        }}
                        className="w-full flex items-center gap-4 py-2.5 text-left cursor-pointer hover:bg-black/5 transition-colors"
                      >
                        <img
                          src={g.coverUrl}
                          alt={g.title}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 object-cover shrink-0 rounded-sm"
                        />
                        <div className="min-w-0">
                          <div
                            className="font-ud-medium truncate"
                            style={{ fontSize: `${Math.max(13, Math.round(h * 0.026))}px` }}
                          >
                            {g.title}
                          </div>
                          <div
                            className="font-ud-regular mt-0.5"
                            style={{
                              fontSize: `${Math.max(11, Math.round(h * 0.021))}px`,
                              color: accentColor,
                            }}
                          >
                            Played for {Math.max(1, Math.round(g.playTimeHours))} hours or more
                          </div>
                        </div>
                      </button>
                      <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Friend List (No Fake Friends) */}
          {activeTab === 'friends' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1">
                <span className="w-1 h-4" style={{ backgroundColor: accentColor }} />
                <h2 className="font-ud-semibold text-lg">Friend List</h2>
              </div>
              <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />
              <div
                className="py-12 px-6 flex flex-col items-center justify-center text-center gap-3 rounded-xl"
                style={{ backgroundColor: sidebarBg, border: `1px solid ${dividerColor}` }}
              >
                <Users className="w-10 h-10 opacity-50" />
                <div className="font-ud-bold text-lg">No Friends Added Yet</div>
                <p
                  className="font-ud-regular text-sm max-w-md leading-relaxed"
                  style={{ color: textMuted }}
                >
                  Share your Friend Code ({activeUser.friendCode || 'SW-1234-5678-9012'}) or send requests from GameChat to see real friends here.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: Customize (Home + All Software Size) */}
          {activeTab === 'customize' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-4" style={{ backgroundColor: accentColor }} />
                  <h2 className="font-ud-semibold text-lg">Customize Home &amp; All Software</h2>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateConfig(DEFAULT_SKYLINE_CONFIG)}
                  className="flex items-center gap-1.5 text-sm font-ud-medium cursor-pointer hover:opacity-80"
                  style={{ color: accentColor }}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset</span>
                </button>
              </div>
              <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

              {/* UI Sounds ON/OFF Switch */}
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 opacity-75" />
                  <span className="font-ud-semibold text-base">UI Sounds</span>
                </div>
                <button
                  type="button"
                  data-testid="toggle-ui-sounds"
                  onClick={() => {
                    const next = !config.uiSoundsEnabled;
                    onUpdateConfig({ ...config, uiSoundsEnabled: next });
                    if (next) playUiSound('confirm', true);
                  }}
                  className="px-4 py-1.5 rounded-full text-sm font-ud-semibold cursor-pointer min-w-[82px]"
                  style={{
                    backgroundColor: config.uiSoundsEnabled ? accentColor : sidebarBg,
                    color: config.uiSoundsEnabled ? '#FFFFFF' : textMain,
                  }}
                >
                  {config.uiSoundsEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

              {/* Game Background ON/OFF Switch */}
              <div className="flex items-center justify-between py-2.5">
                <span className="font-ud-semibold text-base">Game Background</span>
                <button
                  type="button"
                  data-testid="toggle-game-bg"
                  onClick={() =>
                    onUpdateConfig({ ...config, enableBackgroundArt: !config.enableBackgroundArt })
                  }
                  className="px-4 py-1.5 rounded-full text-sm font-ud-semibold cursor-pointer min-w-[82px]"
                  style={{
                    backgroundColor: config.enableBackgroundArt ? accentColor : sidebarBg,
                    color: config.enableBackgroundArt ? '#FFFFFF' : textMain,
                  }}
                >
                  {config.enableBackgroundArt ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

              {/* Same-line Horizontal Sliders */}
              {[
                {
                  id: 'bg-opacity',
                  label: 'Background Opacity',
                  value: `${config.backgroundDimPct}%`,
                  min: 0,
                  max: 100,
                  step: 2,
                  cur: config.backgroundDimPct,
                  disabled: !config.enableBackgroundArt,
                  onChange: (v: number) => onUpdateConfig({ ...config, backgroundDimPct: v }),
                },
                {
                  id: 'cover-size',
                  label: 'Home Cover Size',
                  value: `${config.cardSizePct}%`,
                  min: 28,
                  max: 42,
                  step: 1,
                  cur: config.cardSizePct,
                  disabled: false,
                  onChange: (v: number) => onUpdateConfig({ ...config, cardSizePct: v }),
                },
                {
                  id: 'allsoft-size',
                  label: 'All Software Size',
                  value: `${config.allSoftwareSizePct}%`,
                  min: 75,
                  max: 130,
                  step: 5,
                  cur: config.allSoftwareSizePct,
                  disabled: false,
                  onChange: (v: number) => onUpdateConfig({ ...config, allSoftwareSizePct: v }),
                },
                {
                  id: 'cover-spacing',
                  label: 'Cover Spacing',
                  value: `${metrics.cardGap}px`,
                  min: 0.08,
                  max: 0.22,
                  step: 0.005,
                  cur: config.cardSpacingRatio,
                  disabled: false,
                  onChange: (v: number) => onUpdateConfig({ ...config, cardSpacingRatio: v }),
                },
                {
                  id: 'border-width',
                  label: 'Border Width',
                  value: `${metrics.borderStroke}px`,
                  min: 4,
                  max: 10,
                  step: 1,
                  cur: config.borderThicknessPx720,
                  disabled: false,
                  onChange: (v: number) => onUpdateConfig({ ...config, borderThicknessPx720: v }),
                },
                {
                  id: 'dock-scale',
                  label: 'Dock Size',
                  value: `${metrics.dockHeight}px`,
                  min: 9,
                  max: 16,
                  step: 0.4,
                  cur: config.dockHeightPct,
                  disabled: false,
                  onChange: (v: number) => onUpdateConfig({ ...config, dockHeightPct: v }),
                },
              ].map((row) => (
                <div key={row.id}>
                  <div className="flex items-center justify-between gap-6 py-2.5">
                    <span className="font-ud-semibold text-base shrink-0">{row.label}</span>
                    <div className="flex items-center gap-3 w-64 max-w-[55%]">
                      <input
                        type="range"
                        aria-label={row.label}
                        data-testid={`slider-${row.id}`}
                        min={row.min}
                        max={row.max}
                        step={row.step}
                        disabled={row.disabled}
                        value={row.cur}
                        onChange={(e) => row.onChange(Number(e.target.value))}
                        className="flex-1 cursor-pointer disabled:opacity-40"
                        style={{ accentColor }}
                      />
                      <span
                        className="font-mono-tabular text-sm font-ud-semibold w-14 text-right"
                        style={{ color: accentColor }}
                      >
                        {row.value}
                      </span>
                    </div>
                  </div>
                  <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: HUD (Strict 4x2 flat circle grid) */}
          {activeTab === 'hud' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 pb-1">
                <span className="w-1 h-4" style={{ backgroundColor: accentColor }} />
                <h2 className="font-ud-semibold text-lg">HUD &amp; Sidebar Colors</h2>
              </div>
              <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

              <div className="space-y-3">
                <div className="font-ud-semibold text-base">Theme Accent Color</div>
                <div
                  data-testid="hud-color-grid"
                  className="grid grid-cols-4 gap-x-6 gap-y-4 py-1"
                >
                  {HUD_THEME_SWATCHES.map((swatch) => {
                    const selected = config.hudThemeId === swatch.id;
                    return (
                      <button
                        key={swatch.id}
                        type="button"
                        data-testid={`hud-swatch-${swatch.id}`}
                        onClick={() => {
                          playUiSound('tick', config.uiSoundsEnabled);
                          onUpdateConfig({ ...config, hudThemeId: swatch.id });
                        }}
                        className="flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
                      >
                        <span
                          className="w-12 h-12 rounded-full flex items-center justify-center transition-transform duration-150 hover:scale-105"
                          style={{
                            backgroundColor: swatch.hex,
                            outline: selected ? `3px solid ${swatch.hex}` : 'none',
                            outlineOffset: '3px',
                          }}
                        >
                          {selected && <Check className="w-5 h-5 text-white" strokeWidth={3} />}
                        </span>
                        <span
                          className={`text-xs ${selected ? 'font-ud-medium' : 'font-ud-regular'}`}
                          style={{ color: selected ? textMain : textMuted }}
                        >
                          {swatch.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

              <div className="flex items-center justify-between py-1.5">
                <span className="font-ud-medium text-sm">Artwork Color Sync</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateConfig({ ...config, adaptiveColors: !config.adaptiveColors })
                  }
                  className="px-4 py-1.5 rounded-full text-xs font-ud-medium cursor-pointer"
                  style={{
                    backgroundColor: config.adaptiveColors ? accentColor : sidebarBg,
                    color: config.adaptiveColors ? '#FFFFFF' : textMain,
                  }}
                >
                  {config.adaptiveColors ? 'Active' : 'Static'}
                </button>
              </div>

              <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

              <div className="flex items-center justify-between py-1.5">
                <span className="font-ud-medium text-sm">Appearance Polarity</span>
                <div className="flex gap-2">
                  {(['auto', 'light', 'dark'] as ThemeAppearanceMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      data-testid={`appearance-${mode}`}
                      onClick={() => onUpdateConfig({ ...config, appearanceMode: mode })}
                      className="px-4 py-1.5 rounded-full text-xs font-ud-medium capitalize cursor-pointer"
                      style={{
                        backgroundColor: config.appearanceMode === mode ? accentColor : sidebarBg,
                        color: config.appearanceMode === mode ? '#FFFFFF' : textMain,
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: User Settings (Brightness, Browser Mode, Album Location, Profile, Clock, Aspect) */}
          {activeTab === 'userSettings' && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 pb-1">
                <span className="w-1 h-4" style={{ backgroundColor: accentColor }} />
                <h2 className="font-ud-semibold text-lg">User &amp; System Settings</h2>
              </div>
              <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

              {/* Brightness Slider */}
              <div className="flex items-center justify-between gap-6 py-2.5">
                <div className="flex items-center gap-2 shrink-0">
                  <Sun className="w-4 h-4 opacity-75" />
                  <span className="font-ud-semibold text-base">Brightness</span>
                </div>
                <div className="flex items-center gap-3 w-64 max-w-[55%]">
                  <input
                    type="range"
                    aria-label="Brightness"
                    data-testid="slider-brightness"
                    min={35}
                    max={100}
                    step={5}
                    value={config.brightnessPct}
                    onChange={(e) =>
                      onUpdateConfig({ ...config, brightnessPct: Number(e.target.value) })
                    }
                    className="flex-1 cursor-pointer"
                    style={{ accentColor }}
                  />
                  <span
                    className="font-mono-tabular text-sm font-ud-semibold w-12 text-right"
                    style={{ color: accentColor }}
                  >
                    {config.brightnessPct}%
                  </span>
                </div>
              </div>
              <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

              {/* Browser Mode (In-App vs Send to Chrome) */}
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 opacity-75" />
                  <span className="font-ud-semibold text-base">Internet Browser Mode</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    data-testid="browser-mode-in-app"
                    onClick={() => onUpdateConfig({ ...config, browserMode: 'in-app' })}
                    className="px-4 py-1.5 rounded-lg text-sm font-ud-medium cursor-pointer"
                    style={{
                      backgroundColor: config.browserMode === 'in-app' ? accentColor : sidebarBg,
                      color: config.browserMode === 'in-app' ? '#FFFFFF' : textMain,
                    }}
                  >
                    In-App Browser
                  </button>
                  <button
                    type="button"
                    data-testid="browser-mode-chrome"
                    onClick={() => onUpdateConfig({ ...config, browserMode: 'chrome' })}
                    className="px-4 py-1.5 rounded-lg text-sm font-ud-medium cursor-pointer"
                    style={{
                      backgroundColor: config.browserMode === 'chrome' ? accentColor : sidebarBg,
                      color: config.browserMode === 'chrome' ? '#FFFFFF' : textMain,
                    }}
                  >
                    Open in Chrome
                  </button>
                </div>
              </div>
              <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

              {/* Photos Directory (Auto-loads inside NS2 Album section) */}
              <div className="space-y-2 py-2.5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-ud-semibold text-base">Photos Directory</div>
                    <div
                      data-testid="settings-album-location-label"
                      className="font-ud-regular text-sm truncate mt-0.5"
                      style={{ color: textMuted }}
                    >
                      {config.albumFolderLabel}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      data-testid="settings-select-album-folder"
                      onClick={() => albumFolderInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-ud-medium text-white cursor-pointer"
                      style={{ backgroundColor: accentColor }}
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>Select Folder</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => albumFilesInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-ud-medium cursor-pointer"
                      style={{ backgroundColor: sidebarBg, color: textMain, border: `1px solid ${dividerColor}` }}
                    >
                      <ImagePlus className="w-4 h-4" />
                      <span>Pick Photos</span>
                    </button>
                    <input
                      ref={albumFolderInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      // @ts-expect-error non-standard folder selection supported by Chromium/Android
                      webkitdirectory=""
                      onChange={(e) => handleAlbumFileChange(e, true)}
                      className="hidden"
                    />
                    <input
                      ref={albumFilesInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleAlbumFileChange(e, false)}
                      className="hidden"
                    />
                  </div>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (onApplyAlbumDirectory) {
                      onApplyAlbumDirectory(albumDirDraft);
                    } else {
                      onUpdateConfig({
                        ...config,
                        albumFolderLabel: albumDirDraft.trim() || '/storage/emulated/0/Pictures',
                      });
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    aria-label="Photos Directory Path"
                    data-testid="settings-album-dir-input"
                    value={albumDirDraft}
                    onChange={(e) => setAlbumDirDraft(e.target.value)}
                    placeholder="/storage/emulated/0/Pictures"
                    className="flex-1 px-3 py-1.5 rounded-lg text-sm font-mono-tabular focus:outline-none"
                    style={{
                      backgroundColor: sidebarBg,
                      color: textMain,
                      border: `1px solid ${dividerColor}`,
                    }}
                  />
                  <button
                    type="submit"
                    data-testid="settings-apply-album-dir"
                    className="px-3.5 py-1.5 rounded-lg text-sm font-ud-semibold text-white cursor-pointer"
                    style={{ backgroundColor: accentColor }}
                  >
                    Set Root
                  </button>
                </form>
              </div>
              <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

              <div className="space-y-2.5 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-ud-semibold text-base">Users &amp; Profiles</span>
                  <button
                    type="button"
                    onClick={onOpenUserSelect}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-ud-medium text-white cursor-pointer hover:opacity-90"
                    style={{ backgroundColor: accentColor }}
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Switch or Add (+) User</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {users.map((u) => {
                    const isCur = u.id === activeUser.id;
                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between gap-2.5 p-2 rounded-lg"
                        style={{
                          backgroundColor: sidebarBg,
                          border: isCur ? `2px solid ${accentColor}` : `1px solid ${dividerColor}`,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectUser(u.id)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <UiKitAvatar characterId={u.characterId} size={36} roundedClass="rounded-md" alt={u.name} />
                          <div className="min-w-0">
                            <div className="font-ud-semibold text-sm truncate">{u.name}</div>
                            <div className="text-xs font-ud-regular" style={{ color: isCur ? accentColor : textMuted }}>
                              {isCur ? 'Active Profile' : 'Tap to Switch'}
                            </div>
                          </div>
                        </button>
                        {users.length > 1 && (
                          <button
                            type="button"
                            data-testid={`settings-delete-user-${u.id}`}
                            aria-label={`Delete user ${u.name}`}
                            onClick={() => onDeleteUser(u.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-ud-bold text-white cursor-pointer hover:opacity-90 shrink-0"
                            style={{ backgroundColor: '#E60012' }}
                          >
                            <Minus className="w-3.5 h-3.5" strokeWidth={3} />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

              <div className="flex items-center justify-between py-2.5">
                <span className="font-ud-semibold text-base">Battery Percentage</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateConfig({ ...config, showBatteryPercent: !config.showBatteryPercent })
                  }
                  className="px-4 py-2 rounded-lg text-sm font-ud-medium cursor-pointer min-w-[104px]"
                  style={{ backgroundColor: sidebarBg, border: `1px solid ${dividerColor}` }}
                >
                  {config.showBatteryPercent ? 'Shown' : 'Hidden'}
                </button>
              </div>
              <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

              <div className="flex items-center justify-between py-2.5">
                <span className="font-ud-semibold text-base">Clock Format</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateConfig({
                      ...config,
                      timeFormat: config.timeFormat === '12hr' ? '24hr' : '12hr',
                    })
                  }
                  className="px-4 py-2 rounded-lg text-sm font-ud-medium cursor-pointer min-w-[104px]"
                  style={{ backgroundColor: sidebarBg, border: `1px solid ${dividerColor}` }}
                >
                  {config.timeFormat.toUpperCase()}
                </button>
              </div>
              <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

              <div className="flex items-center justify-between py-2.5">
                <span className="font-ud-semibold text-base">Screen Aspect Ratio</span>
                <div className="flex gap-2">
                  {(['fit-16-9', 'fill'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onUpdateConfig({ ...config, rp5FrameMode: mode })}
                      className="px-4 py-2 rounded-lg text-sm font-ud-medium cursor-pointer"
                      style={{
                        backgroundColor: config.rp5FrameMode === mode ? accentColor : sidebarBg,
                        color: config.rp5FrameMode === mode ? '#FFFFFF' : textMain,
                      }}
                    >
                      {mode === 'fit-16-9' ? 'RP5 16:9 Exact' : 'Fill Browser'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

              {/* Pegasus Theme Package & Direct Launch */}
              <div className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <span className="font-ud-semibold text-base block">Pegasus Theme (Switch 2)</span>
                  <span className="font-ud-regular text-sm block opacity-85" style={{ color: textMuted }}>
                    skylineos2-pegasus-theme.zip · Switch 2 layout + Eden direct boot fix (calibrated to your settings)
                  </span>
                  {downloadError && (
                    <span className="font-ud-medium text-sm block mt-1" style={{ color: '#EF4444' }}>
                      {downloadError}
                    </span>
                  )}
                </div>
                <a
                  href={downloadHref}
                  download="skylineos2-pegasus-theme.zip"
                  onClick={handleDownloadThemeZip}
                  data-testid="btn-download-pegasus-theme"
                  aria-busy={downloadingTheme}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-ud-semibold text-white shrink-0 cursor-pointer hover:opacity-90 shadow-sm"
                  style={{ backgroundColor: accentColor }}
                >
                  {downloadSuccess ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                  <span>
                    {downloadingTheme
                      ? 'Preparing ZIP...'
                      : downloadSuccess
                        ? 'Downloaded!'
                        : 'Download Theme (.zip)'}
                  </span>
                </a>
              </div>
              <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />
            </div>
          )}

          {/* TAB 6: About */}
          {activeTab === 'about' && (
            <div className="space-y-4" data-testid="settings-about-content">
              <div className="flex items-center gap-2 pb-1">
                <span className="w-1 h-4" style={{ backgroundColor: accentColor }} />
                <h2 className="font-ud-semibold text-lg">About SkylineOS 2</h2>
              </div>
              <div className="h-px w-full" style={{ backgroundColor: dividerColor }} />

              <div className="space-y-3 py-2 font-ud-regular text-base leading-relaxed">
                <p>Designed by Chen.Paradise 🇵🇷</p>
                <p>
                  Forked from{' '}
                  <a
                    href="https://github.com/RBertoCases/skylineOS"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                    style={{ color: accentColor }}
                  >
                    https://github.com/RBertoCases/skylineOS
                  </a>
                </p>
                <p className="font-ud-thin" style={{ color: textMuted }}>
                  2026 For Education purposes Only.
                </p>
                <p>Hecho con ❤️🇵🇷 en Santurce, PR</p>

                <div className="pt-2 space-y-1.5">
                  <a
                    href={downloadHref}
                    download="skylineos2-pegasus-theme.zip"
                    onClick={handleDownloadThemeZip}
                    data-testid="btn-about-download-pegasus"
                    aria-busy={downloadingTheme}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-ud-medium text-white cursor-pointer hover:opacity-90 shadow-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    {downloadSuccess ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                    <span>
                      {downloadingTheme
                        ? 'Preparing ZIP...'
                        : downloadSuccess
                          ? 'Downloaded!'
                          : 'Download Pegasus Theme ZIP'}
                    </span>
                  </a>
                  {downloadError && (
                    <p className="font-ud-medium text-xs" style={{ color: '#EF4444' }}>
                      {downloadError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Bottom Sticky Footer Bar */}
      <footer style={{ paddingLeft: `${padX}px`, paddingRight: `${padX}px` }}>
        <div className="w-full h-px" style={{ backgroundColor: dividerColor }} />
        <div
          className="flex items-center justify-between"
          style={{ height: `${Math.max(40, Math.round(h * 0.088))}px` }}
        >
          <BottomControllerGlyph size={metrics.helpIconSize} color={textMain} />

          <div className="flex items-center gap-6">
            <button
              type="button"
              data-testid="profile-back-button"
              onClick={onClose}
              className="flex items-center gap-2 cursor-pointer hover:opacity-75"
            >
              <SwitchPdfIcon
                button="B"
                size={Math.max(20, Math.round(metrics.helpIconSize * 0.65))}
                fillColor={textMain}
                cutoutColor={pageBg}
              />
              <span
                className="font-ud-regular"
                style={{ fontSize: `${metrics.helpFontSize}px`, color: textMain }}
              >
                Back
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab((cur) => (cur === 'profile' ? 'customize' : 'profile'))}
              className="flex items-center gap-2 cursor-pointer hover:opacity-75"
            >
              <SwitchPdfIcon
                button="A"
                size={Math.max(20, Math.round(metrics.helpIconSize * 0.65))}
                fillColor={textMain}
                cutoutColor={pageBg}
              />
              <span
                className="font-ud-regular"
                style={{ fontSize: `${metrics.helpFontSize}px`, color: textMain }}
              >
                OK
              </span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
