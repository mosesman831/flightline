export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatTime(iso: string | null, timezone?: string): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  const use24h = localStorage.getItem('flightline-time-format') === '24h';
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !use24h,
    timeZone: timezone,
    timeZoneName: timezone ? 'short' : undefined,
  });
}

/**
 * Format time "local" (in the given timezone) and show a "your time" annotation
 * if the user's timezone differs.
 */
export interface FormattedTimeResult {
  local: string;         // "10:30 AM GMT+1"
  localShort: string;    // "10:30"
  userTime: string | null; // "2:30 AM PDT" or null if same tz
  differs: boolean;
}

/** Get user's IANA timezone */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatTimeWithTz(
  iso: string | null,
  airportTimezone?: string,
): FormattedTimeResult {
  if (!iso) return { local: '--:--', localShort: '--:--', userTime: null, differs: false };

  const d = new Date(iso);
  const use24h = localStorage.getItem('flightline-time-format') === '24h';

  const local = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !use24h,
    timeZone: airportTimezone,
    timeZoneName: 'short',
  });

  const localShort = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !use24h,
    timeZone: airportTimezone,
  });

  const userTz = getUserTimezone();
  const isSame = !airportTimezone || airportTimezone === userTz;

  const userTime = isSame
    ? null
    : d.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: !use24h,
        timeZone: userTz,
        timeZoneName: 'short',
      });

  return { local, localShort, userTime, differs: !isSame };
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDuration(isoStart: string, isoEnd: string): string {
  const start = new Date(isoStart);
  const end = new Date(isoEnd);
  const diff = end.getTime() - start.getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

export function getCountdown(target: string): string {
  const now = new Date();
  const targetDate = new Date(target);
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) return '';
  if (diff < 3600000) {
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export function getCountdownMs(target: string): number {
  return new Date(target).getTime() - Date.now();
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'scheduled': return 'text-blue-500';
    case 'boarding': return 'text-emerald-500';
    case 'active': return 'text-emerald-500';
    case 'landed': return 'text-gray-500';
    case 'delayed': return 'text-amber-500';
    case 'cancelled': return 'text-rose-500';
    case 'diverted': return 'text-rose-500';
    default: return 'text-gray-400';
  }
}

export function getStatusBg(status: string): string {
  switch (status) {
    case 'scheduled': return 'bg-blue-500/10 text-blue-500';
    case 'boarding': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'active': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'landed': return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
    case 'delayed': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'cancelled': return 'bg-rose-500/10 text-rose-600 dark:text-rose-400';
    case 'diverted': return 'bg-rose-500/10 text-rose-600 dark:text-rose-400';
    default: return 'bg-gray-500/10 text-gray-400';
  }
}

export function getStatusText(status: string): string {
  switch (status) {
    case 'scheduled': return 'On Time';
    case 'boarding': return 'Boarding';
    case 'active': return 'In Flight';
    case 'landed': return 'Landed';
    case 'delayed': return 'Delayed';
    case 'cancelled': return 'Cancelled';
    case 'diverted': return 'Diverted';
    default: return status;
  }
}

export function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).substring(2, 11);
}

export function groupFlightsByDate(flights: { date: string; scheduledDeparture: string }[]): Map<string, typeof flights> {
  const groups = new Map<string, typeof flights>();
  for (const f of [...flights].sort((a, b) => new Date(a.scheduledDeparture).getTime() - new Date(b.scheduledDeparture).getTime())) {
    const label = formatDate(f.date);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(f);
  }
  return groups;
}

export function getDelayColor(chance: number): string {
  if (chance < 15) return '#10B981';
  if (chance < 30) return '#F59E0B';
  if (chance < 60) return '#F97316';
  return '#F43F5E';
}

export function isWithinNextHour(iso: string): boolean {
  return new Date(iso).getTime() - Date.now() < 3600000;
}
