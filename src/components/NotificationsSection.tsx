import { Bell, BellRinging, CaretRight } from '@phosphor-icons/react';
import { useState } from 'react';

interface NotificationOption {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface NotificationsSectionProps {
  notificationsEnabled?: boolean;
  options?: NotificationOption[];
  onToggle?: (id: string, enabled: boolean) => void;
}

const DEFAULT_OPTIONS: NotificationOption[] = [
  { id: 'status', label: 'Status changes', description: 'Delayed, cancelled, diverted', enabled: true },
  { id: 'gate', label: 'Gate changes', description: 'When your gate is updated', enabled: true },
  { id: 'boarding', label: 'Boarding time', description: '30 min before boarding', enabled: true },
  { id: 'inbound', label: 'Inbound aircraft', description: 'When your plane is running late', enabled: false },
];

export default function NotificationsSection({
  notificationsEnabled = false,
  options = DEFAULT_OPTIONS,
  onToggle,
}: NotificationsSectionProps) {
  const [enabled, setEnabled] = useState(notificationsEnabled);
  const [showOptions, setShowOptions] = useState(false);
  const [opts, setOpts] = useState(options);

  const handleToggleAll = () => {
    setEnabled(!enabled);
  };

  const handleToggleOption = (id: string) => {
    setOpts(prev => prev.map(o => o.id === id ? { ...o, enabled: !o.enabled } : o));
    onToggle?.(id, !opts.find(o => o.id === id)?.enabled);
  };

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {enabled ? (
            <BellRinging size={18} className="text-[#007AFF]" weight="fill" />
          ) : (
            <Bell size={18} className="text-[var(--text-tertiary)]" />
          )}
          <span className="text-sm font-semibold text-[var(--text-primary)]">Notifications</span>
        </div>
        <button
          onClick={handleToggleAll}
          className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
            enabled ? 'bg-[#007AFF]' : 'bg-[var(--bg-tertiary)]'
          }`}
          aria-label="Toggle notifications"
        >
          <span
            className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${
              enabled ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {enabled ? (
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="w-full flex items-center justify-between py-2 text-sm text-[var(--text-secondary)]"
        >
          <span>{opts.filter(o => o.enabled).length} alerts configured</span>
          <CaretRight
            size={14}
            className={`transition-transform duration-200 ${showOptions ? 'rotate-90' : ''}`}
          />
        </button>
      ) : (
        <p className="text-xs text-[var(--text-tertiary)]">
          Enable to get alerts for status changes, gate updates, and delays.
        </p>
      )}

      {showOptions && enabled && (
        <div className="mt-2 space-y-2">
          {opts.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleToggleOption(opt.id)}
              className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <div className="text-left">
                <div className="text-sm font-medium text-[var(--text-primary)]">{opt.label}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{opt.description}</div>
              </div>
              <div
                className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${
                  opt.enabled ? 'bg-[#007AFF]' : 'bg-[var(--bg-tertiary)]'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    opt.enabled ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
