import { Timer, Ruler, Moon, Sun, CalendarBlank } from '@phosphor-icons/react';

interface FlightInfoBarProps {
  durationMinutes: number;
  distanceKm?: number;
  isOvernight?: boolean;
  departureTime?: string;
  arrivalTime?: string;
}

export default function FlightInfoBar({
  durationMinutes,
  distanceKm,
  isOvernight,
  departureTime,
  arrivalTime,
}: FlightInfoBarProps) {
  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  const durationStr = `${hours}h ${mins}m`;

  const distStr = distanceKm
    ? distanceKm > 2000
      ? `${distanceKm.toLocaleString()} km`
      : `${Math.round(distanceKm * 0.621371).toLocaleString()} mi`
    : null;

  // Detect next-day arrival
  const nextDay = departureTime && arrivalTime
    ? new Date(arrivalTime).getDate() > new Date(departureTime).getDate() ||
      new Date(arrivalTime).getMonth() !== new Date(departureTime).getMonth()
    : false;

  return (
    <div className="flex items-center justify-center gap-4 py-3 px-4 rounded-xl bg-[var(--bg-tertiary)] text-xs text-[var(--text-secondary)]">
      <div className="flex items-center gap-1.5">
        <Timer size={14} className="text-[var(--text-tertiary)]" />
        <span className="font-semibold text-[var(--text-primary)]">{durationStr}</span>
      </div>
      {distStr && (
        <>
          <span className="text-[var(--text-tertiary)]">·</span>
          <div className="flex items-center gap-1.5">
            <Ruler size={14} className="text-[var(--text-tertiary)]" />
            <span className="font-semibold text-[var(--text-primary)]">{distStr}</span>
          </div>
        </>
      )}
      <span className="text-[var(--text-tertiary)]">·</span>
      <div className="flex items-center gap-1.5">
        {isOvernight ? (
          <Moon size={14} className="text-indigo-400" weight="fill" />
        ) : (
          <Sun size={14} className="text-amber-400" weight="fill" />
        )}
        <span className="font-semibold text-[var(--text-primary)]">
          {isOvernight ? 'Overnight' : 'Daytime'}
        </span>
      </div>
      {nextDay && (
        <>
          <span className="text-[var(--text-tertiary)]">·</span>
          <div className="flex items-center gap-1.5">
            <CalendarBlank size={14} className="text-blue-400" weight="fill" />
            <span className="font-semibold text-blue-500">+1</span>
          </div>
        </>
      )}
    </div>
  );
}
