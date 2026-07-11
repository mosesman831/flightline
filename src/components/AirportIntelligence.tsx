import { Buildings, Clock, PersonSimpleWalk, Sparkle } from '@phosphor-icons/react';
import { getAirportInfo } from '../data/airportInfo';

interface AirportIntelligenceProps {
  iata: string;
  cityName?: string;
}

export default function AirportIntelligence({ iata, cityName }: AirportIntelligenceProps) {
  const info = getAirportInfo(iata);
  if (!info) return null;

  return (
    <div className="card p-5 mb-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-2">
        <Buildings size={16} weight="fill" className="text-[#007AFF]" />
        Airport Intelligence — {info.iata}
      </h3>
      {cityName && (
        <p className="text-xs text-[var(--text-tertiary)] mb-3">{cityName}</p>
      )}

      {/* Terminals */}
      <div className="mb-4">
        <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">
          Terminals
        </div>
        <div className="flex flex-wrap gap-1.5">
          {info.terminals.map((terminal) => (
            <span
              key={terminal}
              className="text-[11px] font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] rounded-full px-2.5 py-0.5"
            >
              {terminal}
            </span>
          ))}
        </div>
      </div>

      {/* Security wait band */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0">
          <Clock size={16} className="text-[var(--text-secondary)]" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-[var(--text-tertiary)]">Security wait</div>
          <div className="text-sm font-medium text-[var(--text-primary)]">{info.securityWaitBand}</div>
        </div>
      </div>

      {/* Walk-time note */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0">
          <PersonSimpleWalk size={16} className="text-[var(--text-secondary)]" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-[var(--text-tertiary)]">Walk time</div>
          <div className="text-sm font-medium text-[var(--text-primary)]">{info.walkTimeNote}</div>
        </div>
      </div>

      {/* Amenities */}
      <div className="mb-4">
        <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">
          Amenities
        </div>
        <div className="flex flex-wrap gap-1.5">
          {info.amenities.map((amenity) => (
            <span
              key={amenity}
              className="text-[11px] font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] rounded-full px-2.5 py-0.5"
            >
              {amenity}
            </span>
          ))}
        </div>
      </div>

      {info.tips && (
        <div className="flex items-start gap-2 mb-3 text-xs text-[var(--text-secondary)]">
          <Sparkle size={14} className="text-[#007AFF] mt-0.5 shrink-0" />
          <span>{info.tips}</span>
        </div>
      )}

      <div className="pt-3 border-t border-[var(--border-color)] text-[10px] text-[var(--text-tertiary)]">
        Typical guidance — not live.
      </div>
    </div>
  );
}
