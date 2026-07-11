import { Clock, AirplaneTilt, Timer } from '@phosphor-icons/react';

interface ArrivalForecastProps {
  flightNumber?: string;
  latePercentage?: number;
  averageDelayMins?: number;
  observedFlights?: number;
}

const DEFAULT_BARS = [
  { label: 'Early', pct: 12, color: 'bg-emerald-400' },
  { label: 'On Time', pct: 45, color: 'bg-emerald-500' },
  { label: '15m late', pct: 20, color: 'bg-amber-400' },
  { label: '30m late', pct: 12, color: 'bg-orange-400' },
  { label: '45m+ late', pct: 6, color: 'bg-rose-400' },
  { label: 'Canceled', pct: 3, color: 'bg-rose-500' },
  { label: 'Diverted', pct: 2, color: 'bg-rose-600' },
];

export default function ArrivalForecast({
  flightNumber,
  latePercentage = 33,
  averageDelayMins = 33,
  observedFlights = 33,
}: ArrivalForecastProps) {
  return (
    <div className="card p-5 mb-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Arrival Forecast</h3>
      <p className="text-xs text-[var(--text-tertiary)] mb-4">
        {flightNumber ?? 'This flight'} · performance over the last 60 days
      </p>

      {/* Summary Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 rounded-xl bg-[var(--bg-tertiary)]">
          <Clock size={16} className="text-amber-500 mx-auto mb-1" weight="fill" />
          <div className="text-lg font-bold text-[var(--text-primary)]">{latePercentage}%</div>
          <div className="text-[10px] text-[var(--text-tertiary)]">Late</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-[var(--bg-tertiary)]">
          <Timer size={16} className="text-orange-500 mx-auto mb-1" weight="fill" />
          <div className="text-lg font-bold text-[var(--text-primary)]">{averageDelayMins}m</div>
          <div className="text-[10px] text-[var(--text-tertiary)]">Avg Late</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-[var(--bg-tertiary)]">
          <AirplaneTilt size={16} className="text-blue-500 mx-auto mb-1" weight="fill" />
          <div className="text-lg font-bold text-[var(--text-primary)]">{observedFlights}</div>
          <div className="text-[10px] text-[var(--text-tertiary)]">Observed</div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="space-y-2">
        {DEFAULT_BARS.map((bar) => (
          <div key={bar.label} className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-secondary)] w-20 text-right shrink-0">
              {bar.label}
            </span>
            <div className="flex-1 h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
              <div
                className={`h-full rounded-full ${bar.color} transition-all duration-700`}
                style={{ width: `${Math.max(bar.pct, 2)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-[var(--text-primary)] w-8 text-right">
              {bar.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
