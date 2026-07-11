import { Bell, BellRinging, CaretRight } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { loadPrefs, type NotificationPrefs } from '../utils/notificationPrefs';
import type { Flight } from '../types/flight';

interface NotificationsSectionProps {
  /** Retained for backwards compatibility; the real state comes from global prefs. */
  notificationsEnabled?: boolean;
  /** Optional flight context — currently presentational only. */
  flight?: Flight;
}

const ALERT_LABELS: {
  key: keyof Omit<NotificationPrefs, 'master' | 'transitMinutes'>;
  label: string;
}[] = [
  { key: 'leaveForAirport', label: 'Leave for airport' },
  { key: 'boarding', label: 'Boarding soon' },
  { key: 'gateChange', label: 'Gate changes' },
  { key: 'inboundLate', label: 'Inbound late' },
  { key: 'statusChange', label: 'Status changes' },
];

export default function NotificationsSection(_props: NotificationsSectionProps) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => loadPrefs());

  // Reflect the global prefs, staying in sync when Settings changes them.
  useEffect(() => {
    const sync = () => setPrefs(loadPrefs());
    window.addEventListener('flightline-prefs-changed', sync);
    return () => window.removeEventListener('flightline-prefs-changed', sync);
  }, []);

  const enabledAlerts = ALERT_LABELS.filter(({ key }) => prefs[key]);

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {prefs.master ? (
            <BellRinging size={18} className="text-[#007AFF]" weight="fill" />
          ) : (
            <Bell size={18} className="text-[var(--text-tertiary)]" />
          )}
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Notifications
          </span>
        </div>
        {prefs.master && (
          <span className="text-xs font-medium text-[#007AFF]">On</span>
        )}
      </div>

      {prefs.master ? (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-secondary)]">
            {enabledAlerts.length} of {ALERT_LABELS.length} alert types on
          </p>
          {enabledAlerts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {enabledAlerts.map(({ key, label }) => (
                <span
                  key={key}
                  className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#007AFF]/10 text-[#007AFF]"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
          <a
            href="#/settings"
            className="w-full flex items-center justify-between py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <span>Manage in Settings</span>
            <CaretRight size={14} />
          </a>
        </div>
      ) : (
        <a
          href="#/settings"
          className="w-full flex items-center justify-between py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <span>Enable notifications in Settings</span>
          <CaretRight size={14} />
        </a>
      )}
    </div>
  );
}
