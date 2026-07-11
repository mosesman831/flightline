import { Warning, CaretRight } from '@phosphor-icons/react';

interface DisruptionAlertProps {
  severity?: 'low' | 'medium' | 'high';
  message?: string;
  actionUrl?: string;
}

export default function DisruptionAlert({
  severity = 'medium',
  message = 'Weather, ATC, or airline issues may affect this flight',
  actionUrl,
}: DisruptionAlertProps) {
  const colors = {
    low: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-600', icon: 'text-blue-500' },
    medium: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-600', icon: 'text-amber-500' },
    high: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-600', icon: 'text-rose-500' },
  };

  const c = colors[severity];

  return (
    <div className={`rounded-2xl ${c.bg} border ${c.border} p-4 mb-4`}>
      <div className="flex items-start gap-3">
        <Warning size={20} className={`${c.icon} mt-0.5 shrink-0`} weight="fill" />
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-semibold ${c.text} mb-1`}>
            Know What's Behind the Disruption
          </h4>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {message}
          </p>
          {actionUrl && (
            <button className="flex items-center gap-1 mt-2 text-xs font-semibold text-[#007AFF]">
              Learn more <CaretRight size={12} weight="bold" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
