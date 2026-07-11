import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Sun,
  Moon,
  Clock,
  Database,
  Trash,
  DownloadSimple,
  UploadSimple,
  Info,
  GithubLogo,
  Monitor,
  Plugs,
  ShieldCheck,
  Bell,
} from '@phosphor-icons/react';
import { exportFlights, importFlights, notifyFlightsChanged } from '../store/flightStore';
import type { Flight } from '../types/flight';
import { del, keys, createStore } from 'idb-keyval';
import { loadPrefs, savePrefs, type NotificationPrefs } from '../utils/notificationPrefs';
import {
  requestNotificationPermission,
  sendLocalNotification,
} from '../utils/notifications';
import { fetchProviders, type ProviderReport } from '../utils/api';

// ─── Types ───────────────────────────────────────────────────────────
interface SettingsProps {
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  flights: Flight[];
  refresh: () => void;
}

type ThemeMode = 'system' | 'light' | 'dark';

// ─── Notification alert descriptors ──────────────────────────────────
const ALERT_TYPES: {
  key: keyof Omit<NotificationPrefs, 'master' | 'transitMinutes'>;
  label: string;
  description: string;
}[] = [
  {
    key: 'leaveForAirport',
    label: 'Leave for airport',
    description: 'A reminder when it is time to head to the airport.',
  },
  {
    key: 'boarding',
    label: 'Boarding soon',
    description: 'A heads-up shortly before boarding begins.',
  },
  {
    key: 'gateChange',
    label: 'Gate changes',
    description: 'Alerts you the moment your departure gate changes.',
  },
  {
    key: 'inboundLate',
    label: 'Inbound aircraft late',
    description: 'When the aircraft flying your route is running behind.',
  },
  {
    key: 'statusChange',
    label: 'Status changes',
    description: 'Delays, cancellations, and diversions to your flight.',
  },
];

const flightStore = createStore('flightline-db', 'flights');

// ─── Main component ──────────────────────────────────────────────────
export default function Settings({
  darkMode,
  setDarkMode,
  flights,
  refresh,
}: SettingsProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (
      (localStorage.getItem('flightline-theme-mode') as ThemeMode) ??
      (darkMode ? 'dark' : 'light')
    );
  });
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>(() => {
    return (
      (localStorage.getItem('flightline-time-format') as '12h' | '24h') ??
      '12h'
    );
  });
  const [clearing, setClearing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Data Providers readiness (read-only; keys live on the Worker).
  const [providers, setProviders] = useState<ProviderReport[] | null>(null);

  // Notification preferences (SPEC §12.3c / §12.5a-b).
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => loadPrefs());
  const [permissionDenied, setPermissionDenied] = useState(false);

  const demoCount = flights.filter((f) => f.isDemo).length;
  const activeCount = flights.filter((f) => !f.archived).length;
  const archivedCount = flights.filter((f) => f.archived).length;

  // System theme matchMedia listener
  useEffect(() => {
    if (themeMode !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setDarkMode(e.matches);
    };
    setDarkMode(mq.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, [themeMode, setDarkMode]);

  // Load read-only provider readiness on mount.
  useEffect(() => {
    let cancelled = false;
    fetchProviders().then((report) => {
      if (!cancelled) setProviders(report);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function applyThemeMode(mode: ThemeMode) {
    setThemeMode(mode);
    localStorage.setItem('flightline-theme-mode', mode);
    if (mode === 'system') {
      const prefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches;
      setDarkMode(prefersDark);
    } else if (mode === 'dark') {
      setDarkMode(true);
    } else {
      setDarkMode(false);
    }
  }

  function toggleTimeFormat() {
    const next = timeFormat === '12h' ? '24h' : '12h';
    setTimeFormat(next);
    localStorage.setItem('flightline-time-format', next);
  }

  function showStatus(msg: string) {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 2500);
  }

  async function handleClearAll() {
    setClearing(true);
    try {
      const allKeys = await keys(flightStore);
      for (const key of allKeys) {
        await del(key, flightStore);
      }
      notifyFlightsChanged();
      refresh();
      showStatus('All data cleared');
    } catch {
      showStatus('Failed to clear data');
    } finally {
      setClearing(false);
      setShowClearConfirm(false);
    }
  }

  async function handleExport() {
    try {
      const json = await exportFlights();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flightline-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('Flights exported');
    } catch {
      showStatus('Export failed');
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const count = await importFlights(text);
      refresh();
      showStatus(`Imported ${count} flights`);
    } catch {
      showStatus('Import failed — invalid file');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ─── Notification pref helpers ───────────────────────────────────
  function updatePrefs(next: NotificationPrefs) {
    setPrefs(next);
    savePrefs(next);
    // Let the app rebuild its notification timers.
    window.dispatchEvent(new Event('flightline-prefs-changed'));
  }

  async function toggleMaster() {
    if (prefs.master) {
      updatePrefs({ ...prefs, master: false });
      return;
    }
    const granted = await requestNotificationPermission();
    if (granted) {
      setPermissionDenied(false);
      updatePrefs({ ...prefs, master: true });
    } else {
      setPermissionDenied(true);
    }
  }

  function toggleAlert(
    key: keyof Omit<NotificationPrefs, 'master' | 'transitMinutes'>
  ) {
    updatePrefs({ ...prefs, [key]: !prefs[key] });
  }

  function setTransitMinutes(value: number) {
    const clamped = Math.max(0, Math.min(240, Math.round(value || 0)));
    updatePrefs({ ...prefs, transitMinutes: clamped });
  }

  async function handlePreview() {
    const granted =
      'Notification' in window && Notification.permission === 'granted';
    if (!granted) {
      showStatus('Enable notifications first to preview');
      return;
    }
    await sendLocalNotification('Gate changed', {
      body: 'BA178 now departs from gate B12',
      tag: 'flightline-preview',
    });
    showStatus('Preview notification sent');
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="max-w-lg mx-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center active:scale-90 transition-transform"
          aria-label="Back to flights"
        >
          <ArrowLeft size={20} className="text-[var(--text-primary)]" />
        </button>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">
          Settings
        </h1>
      </div>

      {/* Status toast */}
      {statusMessage && (
        <div className="mb-4 px-4 py-3 rounded-2xl bg-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] font-medium text-center animate-fade-in">
          {statusMessage}
        </div>
      )}

      {/* Appearance */}
      <div className="card p-5 mb-4">
        <SettingsSection icon={<Sun size={16} />} label="Appearance" />
        <div className="space-y-1">
          {(
            [
              { mode: 'system' as ThemeMode, icon: Monitor, label: 'System' },
              { mode: 'light' as ThemeMode, icon: Sun, label: 'Light' },
              { mode: 'dark' as ThemeMode, icon: Moon, label: 'Dark' },
            ] as const
          ).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => applyThemeMode(mode)}
              role="radio"
              aria-checked={themeMode === mode}
              aria-label={`${label} theme`}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                themeMode === mode
                  ? 'bg-[#007AFF]/10 text-[#007AFF]'
                  : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              <Icon size={18} weight={themeMode === mode ? 'fill' : 'regular'} />
              <span className="text-sm font-medium">{label}</span>
              {themeMode === mode && (
                <div className="ml-auto w-5 h-5 rounded-full bg-[#007AFF] flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Time Format */}
      <div className="card p-5 mb-4">
        <SettingsSection icon={<Clock size={16} />} label="Time Format" />
        <button
          onClick={toggleTimeFormat}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-[var(--bg-tertiary)] transition-colors"
          aria-label={`Time format: ${timeFormat === '12h' ? '12-hour' : '24-hour'}. Click to switch.`}
        >
          <span className="text-sm text-[var(--text-primary)]">
            {timeFormat === '12h' ? '12-hour (AM/PM)' : '24-hour'}
          </span>
          <div
            className={`relative h-7 w-11 rounded-full transition-colors duration-200 ${
              timeFormat === '24h' ? 'bg-[#007AFF]' : 'bg-[var(--text-tertiary)]'
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
                timeFormat === '24h' ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </div>
        </button>
      </div>

      {/* ─── Data Providers (read-only readiness) ────────────────── */}
      <div className="card p-5 mb-4">
        <SettingsSection icon={<Plugs size={16} />} label="Data Providers" />

        <div className="px-4">
          {providers === null ? (
            <p className="text-sm text-[var(--text-secondary)] py-2">
              Checking providers…
            </p>
          ) : providers.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--text-tertiary)] shrink-0" />
              <p className="text-sm text-[var(--text-secondary)]">
                Worker unreachable
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {providers.map((provider) => {
                const dotClass = !provider.configured
                  ? 'bg-[var(--text-tertiary)]'
                  : provider.lastOutcome === 'ok'
                    ? 'bg-green-500'
                    : provider.lastOutcome === 'error'
                      ? 'bg-rose-500'
                      : 'bg-[#007AFF]';
                const label = !provider.configured
                  ? 'Not configured'
                  : provider.lastOutcome === 'ok'
                    ? 'Connected'
                    : provider.lastOutcome === 'error'
                      ? 'Error'
                      : 'Ready';
                return (
                  <div
                    key={provider.key}
                    className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)]"
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${dotClass}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {provider.name}
                        </span>
                        <span className="text-xs font-medium text-[var(--text-secondary)] shrink-0">
                          {label}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-0.5">
                        {provider.data}
                      </p>
                      {provider.lastOutcome === 'error' && provider.lastError && (
                        <p className="text-xs text-rose-500 leading-relaxed mt-0.5">
                          {provider.lastError}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Privacy note */}
        <div className="mx-4 mt-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          <ShieldCheck
            size={14}
            className="text-[var(--text-secondary)] mt-0.5 shrink-0"
          />
          <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
            Provider API keys are configured on the Worker (server-side), not in
            the browser.
          </p>
        </div>
      </div>

      {/* ─── Notifications ───────────────────────────────────────── */}
      <div className="card p-5 mb-4">
        <SettingsSection icon={<Bell size={16} />} label="Notifications" />

        {/* Master toggle */}
        <button
          onClick={toggleMaster}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-[var(--bg-tertiary)] transition-colors"
          aria-label="Toggle notifications"
          aria-pressed={prefs.master}
        >
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Notifications
          </span>
          <div
            className={`relative h-7 w-11 rounded-full transition-colors duration-200 ${
              prefs.master ? 'bg-[#007AFF]' : 'bg-[var(--text-tertiary)]'
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
                prefs.master ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </div>
        </button>

        {/* iOS permission-denied hint */}
        {permissionDenied && !prefs.master && (
          <p className="mx-4 mt-2 text-xs text-rose-500 leading-relaxed">
            Enable notifications for Flightline in iOS Settings › Notifications.
          </p>
        )}

        {!prefs.master && (
          <p className="mx-4 mt-2 text-xs text-[var(--text-tertiary)] leading-relaxed">
            Turn on notifications to get timely alerts for your tracked flights.
          </p>
        )}

        {/* Per-alert toggles */}
        {prefs.master && (
          <div className="mt-2 space-y-1">
            {ALERT_TYPES.map(({ key, label, description }) => (
              <button
                key={key}
                onClick={() => toggleAlert(key)}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                aria-label={`Toggle ${label}`}
                aria-pressed={prefs[key]}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    {label}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {description}
                  </div>
                </div>
                <div
                  className={`relative h-6 w-10 rounded-full shrink-0 transition-colors duration-200 ${
                    prefs[key] ? 'bg-[#007AFF]' : 'bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                      prefs[key] ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>
            ))}

            {/* Transit time */}
            <div className="px-4 pt-3">
              <label
                htmlFor="transit-minutes"
                className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
              >
                Transit time to airport (minutes)
              </label>
              <input
                id="transit-minutes"
                type="number"
                min={0}
                max={240}
                value={prefs.transitMinutes}
                onChange={(e) => setTransitMinutes(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm border border-[var(--border-color)] focus:outline-none focus:border-[#007AFF] transition-colors tabular-nums"
              />
            </div>

            {/* Preview */}
            <div className="px-4 pt-3 space-y-2">
              <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                <Bell
                  size={16}
                  className="text-[#007AFF] mt-0.5 shrink-0"
                  weight="fill"
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    Gate changed
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    BA178 now departs from gate B12
                  </div>
                </div>
              </div>
              <button
                onClick={handlePreview}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--border-color)] active:scale-[0.98] transition-all"
              >
                <Bell size={14} />
                Preview
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="card p-5 mb-4">
        <SettingsSection icon={<Database size={16} />} label="Flight Data" />
        <div className="space-y-3 px-4 py-2">
          <StatRow label="Active flights" value={String(activeCount)} />
          <StatRow label="Archived flights" value={String(archivedCount)} />
          <StatRow label="Total flights" value={String(flights.length)} />
          {demoCount > 0 && (
            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium">
              <Info size={14} />
              Demo mode — {demoCount} demo flight
              {demoCount !== 1 ? 's' : ''} loaded
            </div>
          )}
        </div>
      </div>

      {/* Import / Export */}
      <div className="card p-5 mb-4">
        <SettingsSection
          icon={<DownloadSimple size={16} />}
          label="Import & Export"
        />
        <div className="flex gap-3 px-4 pt-2">
          <button
            onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--border-color)] active:scale-[0.98] transition-all"
          >
            <DownloadSimple size={16} />
            Export JSON
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--border-color)] active:scale-[0.98] transition-all disabled:opacity-40"
          >
            <UploadSimple size={16} />
            {importing ? 'Importing...' : 'Import JSON'}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
      </div>

      {/* Clear All Data */}
      <div className="card p-5 mb-4">
        <SettingsSection icon={<Trash size={16} />} label="Danger Zone" />
        <div className="px-4 pt-2">
          {showClearConfirm ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Are you sure? This will permanently delete all your flights.
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-3 rounded-2xl bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium active:scale-[0.98] transition-transform"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="flex-1 px-4 py-3 rounded-2xl bg-rose-500 text-white text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-40"
                >
                  {clearing ? 'Clearing...' : 'Delete All'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="w-full px-4 py-3 rounded-2xl bg-rose-500/10 text-rose-500 text-sm font-medium hover:bg-rose-500/20 active:scale-[0.98] transition-all"
            >
              Clear All Data
            </button>
          )}
        </div>
      </div>

      {/* About */}
      <div className="card p-5 mb-8">
        <SettingsSection icon={<Info size={16} />} label="About" />
        <div className="px-4 pt-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-secondary)]">
              Flightline
            </span>
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              v1.0
            </span>
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[#007AFF] hover:underline"
          >
            <GithubLogo size={16} />
            View on GitHub
          </a>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Shared sub-components ───────────────────────────────────────────
function SettingsSection({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className="text-sm font-semibold text-[var(--text-primary)]">
        {label}
      </span>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
        {value}
      </span>
    </div>
  );
}
