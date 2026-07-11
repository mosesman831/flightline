import type { Flight } from '../types/flight';
import AirlineLogo from './AirlineLogo';
import StatusPill from './StatusPill';
import { formatTime, getDelayColor, formatDate } from '../utils/format';
import { Star, ArrowRight } from '@phosphor-icons/react';
import { toggleStar } from '../store/flightStore';
import { hapticLight } from '../utils/haptic';

interface FlightCardProps {
  flight: Flight;
  onClick: () => void;
}

export default function FlightCard({ flight, onClick }: FlightCardProps) {
  const delayColor = getDelayColor(flight.delayChance);

  return (
    <button
      onClick={onClick}
      className="card w-full text-left p-4 mb-3 active:scale-[0.98] transition-transform duration-150"
      aria-label={`${flight.airlineName} ${flight.flightNumber} to ${flight.destination.city}`}
    >
      <div className="flex items-start gap-3">
        <AirlineLogo iata={flight.airlineIata} name={flight.airlineName} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {flight.airlineIata} {flight.flightNumber}
            </span>
            <StatusPill status={flight.status} delayMinutes={flight.delayMinutes} />
          </div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {flight.origin.iata}
            </span>
            <ArrowRight size={14} className="text-[var(--text-tertiary)]" weight="bold" />
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {flight.destination.iata}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
            <span>{formatTime(flight.scheduledDeparture, flight.origin.timezone)}</span>
            <span className="text-[var(--text-tertiary)]">→</span>
            <span>{formatTime(flight.scheduledArrival, flight.destination.timezone)}</span>
            <span className="text-[var(--text-tertiary)]">•</span>
            <span>{formatDate(flight.date)}</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleStar(flight.id).then(() => {
                hapticLight();
                window.dispatchEvent(new CustomEvent('flights-changed'));
              });
            }}
            className="p-1"
            aria-label={flight.starred ? 'Unstar' : 'Star'}
          >
            <Star
              size={18}
              weight={flight.starred ? 'fill' : 'regular'}
              className={flight.starred ? 'text-amber-400' : 'text-[var(--text-tertiary)]'}
            />
          </button>
          <div className="text-xs font-bold tabular-nums" style={{ color: delayColor }}>
            {flight.delayChance}%
          </div>
        </div>
      </div>
    </button>
  );
}
