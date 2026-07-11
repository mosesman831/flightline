import { getStatusBg, getStatusText } from '../utils/format';

interface StatusPillProps {
  status: string;
  delayMinutes?: number | null;
}

export default function StatusPill({ status, delayMinutes }: StatusPillProps) {
  const text = getStatusText(status);
  const bgClass = getStatusBg(status);

  return (
    <span className={`pill ${bgClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'landed' ? 'bg-gray-400' :
        status === 'cancelled' ? 'bg-rose-400' :
        status === 'delayed' ? 'bg-amber-400' :
        status === 'active' || status === 'boarding' ? 'bg-emerald-400 animate-pulse' :
        status === 'scheduled' ? 'bg-blue-400' : 'bg-gray-400'
      }`} />
      {text}
      {delayMinutes != null && delayMinutes > 0 && status === 'delayed' && (
        <span className="opacity-80">+{delayMinutes}m</span>
      )}
    </span>
  );
}
