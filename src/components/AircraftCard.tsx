import { AirplaneTilt, PencilSimple, Star, Info } from '@phosphor-icons/react';

interface AircraftCardProps {
  aircraft?: string | null;
  tailNumber?: string | null;
  airline?: string;
  timesFlown?: number;
}

export default function AircraftCard({
  aircraft,
  tailNumber,
  airline,
  timesFlown = 0,
}: AircraftCardProps) {
  return (
    <div className="card p-5 mb-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
        <AirplaneTilt size={16} className="text-[#007AFF]" weight="fill" />
        Where's My Plane?
      </h3>

      {/* Aircraft Image Area */}
      <div className="relative h-48 rounded-xl overflow-hidden mb-4"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
        }}
      >
        {/* Starfield effect */}
        <div className="absolute inset-0"
          style={{
            background: 'radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.4) 0%, transparent 100%), radial-gradient(1px 1px at 40% 70%, rgba(255,255,255,0.3) 0%, transparent 100%), radial-gradient(1.5px 1.5px at 60% 20%, rgba(255,255,255,0.5) 0%, transparent 100%), radial-gradient(1px 1px at 80% 50%, rgba(255,255,255,0.3) 0%, transparent 100%), radial-gradient(1px 1px at 10% 80%, rgba(255,255,255,0.4) 0%, transparent 100%), radial-gradient(1.5px 1.5px at 70% 90%, rgba(255,255,255,0.3) 0%, transparent 100%), radial-gradient(1px 1px at 50% 50%, rgba(255,255,255,0.2) 0%, transparent 100%)',
          }}
        />
        {/* Plane silhouette - CSS only */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <AirplaneTilt
              size={80}
              className="text-white/10"
              weight="fill"
              style={{ transform: 'rotate(-30deg)' }}
            />
          </div>
        </div>
        {/* Pro badge */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-bold text-white/80">
          ✦ FREE
        </div>
      </div>

      {/* Aircraft Details */}
      <div className="space-y-3 mb-4">
        {aircraft && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
              <AirplaneTilt size={16} className="text-[var(--text-secondary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[var(--text-primary)]">{aircraft}</div>
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Model</div>
            </div>
          </div>
        )}
        {tailNumber && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
              <PencilSimple size={16} className="text-[var(--text-secondary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[var(--text-primary)]">{tailNumber}</div>
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Tail No.</div>
            </div>
            <PencilSimple size={14} className="text-[var(--text-tertiary)]" />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="rounded-xl bg-[var(--bg-tertiary)] p-4 mb-4">
        <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          Stats
        </h4>
        <div className="flex items-center gap-2">
          <Star size={16} className="text-amber-400" weight="fill" />
          <span className="text-sm font-bold text-[var(--text-primary)]">{timesFlown} times</span>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">
          {timesFlown === 0
            ? "You haven't flown on this aircraft yet"
            : `You've flown on this aircraft ${timesFlown} time${timesFlown > 1 ? 's' : ''}`}
        </p>
      </div>

      {/* About */}
      {airline && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <Info size={14} className="text-[var(--text-tertiary)]" />
          <span>About {airline}</span>
        </div>
      )}
    </div>
  );
}
