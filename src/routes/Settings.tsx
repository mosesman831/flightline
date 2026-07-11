import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
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
  Key,
  Plugs,
  Link,
  Warning,
  CheckCircle,
  ArrowsClockwise,
  Eye,
  EyeSlash,
  CaretDown,
  ShieldCheck,
} from '@phosphor-icons/react';
import { exportFlights, importFlights, notifyFlightsChanged } from '../store/flightStore';
import type { Flight } from '../types/flight';
import { del, keys, createStore } from 'idb-keyval';

// ─── Exported helpers ────────────────────────────────────────────────
export function getApiKeys(): {
  aviationstack?: string;
  airlabs?: string;
  flightapi?: string;
} {
  return {
    aviationstack:
      localStorage.getItem('flightline-key-aviationstack') || undefined,
    airlabs: localStorage.getItem('flightline-key-airlabs') || undefined,
    flightapi: localStorage.getItem('flightline-key-flightapi') || undefined,
  };
}

export function getWorkerUrl(): string {
  return (
    localStorage.getItem('flightline-worker-url') || 'http://localhost:8787'
  );
}

// ─── Provider config ─────────────────────────────────────────────────
interface ProviderConfig {
  id: string;
  label: string;
  localStorageKey: string;
  tier: string;
  description: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'aviationstack',
    label: 'Aviationstack',
    localStorageKey: 'flightline-key-aviationstack',
    tier: '100 req/mo free — Gates, terminals, airline codes',
    description: 'Real-time flight status, gates, terminals, and airline codes.',
  },
  {
    id: 'airlabs',
    label: 'AirLabs',
    localStorageKey: 'flightline-key-airlabs',
    tier: '1,000 req/mo free — Flight status, airports, airlines, fleet',
    description:
      'Flight status, airport info, airline data, and fleet details.',
  },
  {
    id: 'flightapi',
    label: 'FlightAPI.io',
    localStorageKey: 'flightline-key-flightapi',
    tier: '20 req/mo free — Flight pricing, schedules',
    description: 'Flight pricing, schedules, and fare information.',
  },
];

// ─── Types ───────────────────────────────────────────────────────────
interface SettingsProps {
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  flights: Flight[];
  refresh: () => void;
}

type ThemeMode = 'system' | 'light' | 'dark';

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

  // Data Providers state
  const [workerUrl, setWorkerUrl] = useState(() => getWorkerUrl());
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>(
    () => {
      const keys: Record<string, string> = {};
      for (const p of PROVIDERS) {
        keys[p.id] = localStorage.getItem(p.localStorageKey) || '';
      }
      return keys;
    }
  );
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<
    Record<string, 'idle' | 'loading' | 'success' | 'error'>
  >(() => {
    const s: Record<string, 'idle' | 'loading' | 'success' | 'error'> = {};
    for (const p of PROVIDERS) {
      s[p.id] = localStorage.getItem(p.localStorageKey) ? 'idle' : 'idle';
    }
    return s;
  });

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

  // ─── Provider helpers ────────────────────────────────────────────
  function saveProviderKey(id: string, value: string) {
    setProviderKeys((prev) => ({ ...prev, [id]: value }));
    const cfg = PROVIDERS.find((p) => p.id === id);
    if (cfg) {
      if (value) {
        localStorage.setItem(cfg.localStorageKey, value);
      } else {
        localStorage.removeItem(cfg.localStorageKey);
      }
    }
  }

  function saveWorkerUrl(value: string) {
    setWorkerUrl(value);
    if (value) {
      localStorage.setItem('flightline-worker-url', value);
    } else {
      localStorage.removeItem('flightline-worker-url');
    }
  }

  const testConnection = useCallback(
    async (provider: ProviderConfig) => {
      const apiKey = providerKeys[provider.id];
      if (!apiKey) {
        showStatus(`Enter an API key for ${provider.label} first`);
        return;
      }
      setTestStatus((prev) => ({ ...prev, [provider.id]: 'loading' }));
      try {
        const url = `${workerUrl.replace(/\/$/, '')}/api/providers?provider=${provider.id}`;
        const res = await fetch(url, {
          headers: { 'X-API-Key': apiKey },
        });
        if (res.ok) {
          setTestStatus((prev) => ({ ...prev, [provider.id]: 'success' }));
          showStatus(`${provider.label} connected`);
        } else {
          setTestStatus((prev) => ({ ...prev, [provider.id]: 'error' }));
          showStatus(`${provider.label} — connection failed (${res.status})`);
        }
      } catch {
        setTestStatus((prev) => ({ ...prev, [provider.id]: 'error' }));
        showStatus(`${provider.label} — unreachable`);
      }
    },
    [providerKeys, workerUrl]
  );

  function toggleProviderExpand(id: string) {
    setExpandedProvider((prev) => (prev === id ? null : id));
  }

  function toggleShowKey(id: string) {
    setShowKey((prev) => ({ ...prev, [id]: !prev[id] }));
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

      {/* ─── Data Providers ──────────────────────────────────────── */}
      <div className="card p-5 mb-4">
        <SettingsSection
          icon={<Plugs size={16} />}
          label="Data Providers"
        />

        {/* Worker URL */}
        <div className="px-4 mb-4">
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            <Link size={12} />
            Worker URL
          </label>
          <input
            type="url"
            value={workerUrl}
            onChange={(e) => saveWorkerUrl(e.target.value)}
            placeholder="https://flightline-api.YOUR_SUBDOMAIN.workers.dev"
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm border border-[var(--border-color)] focus:outline-none focus:border-[#007AFF] transition-colors font-mono"
          />
        </div>

        {/* Provider cards */}
        <div className="space-y-2 px-4">
          {PROVIDERS.map((provider) => {
            const isExpanded = expandedProvider === provider.id;
            const hasKey = !!providerKeys[provider.id];
            const status = testStatus[provider.id];

            return (
              <div
                key={provider.id}
                className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] overflow-hidden transition-all duration-200"
              >
                {/* Provider header (always visible) */}
                <button
                  onClick={() => toggleProviderExpand(provider.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  {/* Status dot */}
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${
                      hasKey
                        ? status === 'success'
                          ? 'bg-green-500'
                          : status === 'error'
                            ? 'bg-rose-500'
                            : 'bg-[#007AFF]'
                        : 'bg-[var(--text-tertiary)]'
                    }`}
                  />

                  {/* Label + tier */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      {provider.label}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] truncate">
                      {provider.tier}
                    </div>
                  </div>

                  {/* Expand arrow */}
                  <CaretDown
                    size={14}
                    className={`text-[var(--text-secondary)] transition-transform duration-200 shrink-0 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Expanded content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-3">
                        {/* Description */}
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          {provider.description}
                        </p>

                        {/* API Key input */}
                        <div>
                          <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                            <Key size={12} />
                            API Key
                          </label>
                          <div className="relative">
                            <input
                              type={showKey[provider.id] ? 'text' : 'password'}
                              value={providerKeys[provider.id]}
                              onChange={(e) =>
                                saveProviderKey(provider.id, e.target.value)
                              }
                              placeholder={`Enter your ${provider.label} API key`}
                              className="w-full px-3 py-2.5 pr-10 rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm border border-[var(--border-color)] focus:outline-none focus:border-[#007AFF] transition-colors font-mono placeholder:font-sans"
                            />
                            <button
                              type="button"
                              onClick={() => toggleShowKey(provider.id)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                              aria-label={
                                showKey[provider.id]
                                  ? 'Hide API key'
                                  : 'Show API key'
                              }
                            >
                              {showKey[provider.id] ? (
                                <EyeSlash size={16} />
                              ) : (
                                <Eye size={16} />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Test Connection button */}
                        <button
                          onClick={() => testConnection(provider)}
                          disabled={
                            !providerKeys[provider.id] ||
                            testStatus[provider.id] === 'loading'
                          }
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--border-color)] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {testStatus[provider.id] === 'loading' ? (
                            <>
                              <ArrowsClockwise
                                size={14}
                                className="animate-spin"
                              />
                              Testing…
                            </>
                          ) : testStatus[provider.id] === 'success' ? (
                            <>
                              <CheckCircle size={14} className="text-green-500" />
                              Connected
                            </>
                          ) : testStatus[provider.id] === 'error' ? (
                            <>
                              <Warning size={14} className="text-rose-500" />
                              Retry
                            </>
                          ) : (
                            <>
                              <Plugs size={14} />
                              Test Connection
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Privacy note */}
        <div className="mx-4 mt-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          <ShieldCheck
            size={14}
            className="text-[var(--text-secondary)] mt-0.5 shrink-0"
          />
          <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
            These keys are stored locally on your device and sent to the
            Flightline proxy worker. They are never shared with third parties.
          </p>
        </div>
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
