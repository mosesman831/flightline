import { format, differenceInMinutes } from 'date-fns';
import {
  AirplaneTakeoff,
  AirplaneLanding,
  Clock,
  Door,
  Timer,
  Taxi,
} from '@phosphor-icons/react';

interface FlightTimetableProps {
  scheduledDeparture: string;
  scheduledArrival: string;
  estimatedDeparture?: string | null;
  estimatedArrival?: string | null;
  actualDeparture?: string | null;
  actualArrival?: string | null;
  gate?: string | null;
  terminal?: string | null;
}

function formatTimeShort(iso: string): string {
  return format(new Date(iso), 'h:mm a');
}

function formatDurationMinutes(start: string, end: string): string {
  const total = differenceInMinutes(new Date(end), new Date(start));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
      {children}
    </h3>
  );
}

function Row({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
        {icon}
        {label}
      </div>
      <div className="text-sm text-[var(--text-primary)] tabular-nums">
        {children}
      </div>
    </div>
  );
}

function TimePair({
  scheduled,
  estimated,
  actual,
  label,
}: {
  scheduled: string;
  estimated?: string | null;
  actual?: string | null;
  label?: string;
}) {
  const activeTime = actual || estimated || scheduled;
  const isActiveDifferent =
    activeTime !== scheduled &&
    (estimated !== null && estimated !== undefined || actual !== null && actual !== undefined);

  return (
    <div className="flex items-center gap-1.5">
      {label && <span className="text-xs text-[var(--text-tertiary)] mr-1">{label}</span>}
      <span
        className={
          isActiveDifferent
            ? 'text-[var(--text-secondary)] line-through decoration-1'
            : ''
        }
      >
        {formatTimeShort(scheduled)}
      </span>
      {isActiveDifferent && (
        <>
          <span className="text-[var(--text-tertiary)] text-xs">→</span>
          <span
            className={
              actual
                ? 'font-medium text-[var(--text-primary)]'
                : 'font-medium text-emerald-500'
            }
          >
            {formatTimeShort(activeTime)}
          </span>
        </>
      )}
    </div>
  );
}

export default function FlightTimetable({
  scheduledDeparture,
  scheduledArrival,
  estimatedDeparture,
  estimatedArrival,
  actualDeparture,
  actualArrival,
  gate,
  terminal,
}: FlightTimetableProps) {
  const depTime = estimatedDeparture || actualDeparture || scheduledDeparture;
  const arrTime = estimatedArrival || actualArrival || scheduledArrival;

  // Taxi estimates: ~33 min departure taxi, ~20 min arrival taxi
  const TAXI_DEP = 33;
  const TAXI_ARR = 20;

  const taxiToRunway = formatDurationMinutes(scheduledDeparture, depTime);
  const taxiToGate = formatDurationMinutes(scheduledArrival, arrTime);

  const totalMinutes =
    differenceInMinutes(new Date(scheduledArrival), new Date(scheduledDeparture));
  const airMinutes = totalMinutes - TAXI_DEP - TAXI_ARR;
  const airTimeStr =
    airMinutes > 0
      ? `${Math.floor(airMinutes / 60)}h ${airMinutes % 60}m`
      : formatDurationMinutes(scheduledDeparture, scheduledArrival);

  return (
    <div className="card rounded-2xl p-5 mb-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-sm font-bold text-[var(--text-primary)]">
          Flight Schedule
        </h2>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          Scheduled, Estimated, Predicted, and Actual
        </p>
      </div>

      {/* DEPART */}
      <SectionHeader>Depart</SectionHeader>

      <Row
        label={gate ? `Gate ${gate}` : 'Gate'}
        icon={<Door size={16} className="text-[var(--text-tertiary)]" weight="regular" />}
      >
        <TimePair
          scheduled={scheduledDeparture}
          estimated={estimatedDeparture}
          actual={actualDeparture}
          label={gate ? undefined : 'Gate'}
        />
      </Row>

      <Row
        label={`Taxi to runway${terminal ? ` (T${terminal})` : ''}`}
        icon={<Taxi size={16} className="text-[var(--text-tertiary)]" weight="regular" />}
      >
        <span className="text-[var(--text-secondary)]">{taxiToRunway}</span>
      </Row>

      <Row
        label="Take Off"
        icon={<AirplaneTakeoff size={16} className="text-[var(--text-tertiary)]" weight="regular" />}
      >
        <span className="font-medium">{formatTimeShort(depTime)}</span>
      </Row>

      {/* Divider */}
      <div className="border-t border-[var(--border-color)] my-2" />

      {/* ARRIVE */}
      <SectionHeader>Arrive</SectionHeader>

      <Row
        label="Land"
        icon={<AirplaneLanding size={16} className="text-[var(--text-tertiary)]" weight="regular" />}
      >
        <span className="font-medium">{formatTimeShort(arrTime)}</span>
      </Row>

      <Row
        label="Taxi to gate"
        icon={<Taxi size={16} className="text-[var(--text-tertiary)]" weight="regular" />}
      >
        <span className="text-[var(--text-secondary)]">{taxiToGate}</span>
      </Row>

      <Row
        label={gate ? `Gate ${gate}` : 'Gate Arrival'}
        icon={<Door size={16} className="text-[var(--text-tertiary)]" weight="regular" />}
      >
        <TimePair
          scheduled={scheduledArrival}
          estimated={estimatedArrival}
          actual={actualArrival}
          label={gate ? undefined : 'Gate'}
        />
      </Row>

      {/* Divider */}
      <div className="border-t border-[var(--border-color)] my-2" />

      {/* TOTALS */}
      <SectionHeader>Totals</SectionHeader>

      <Row
        label="Air Time"
        icon={<Clock size={16} className="text-[var(--text-tertiary)]" weight="regular" />}
      >
        <span className="font-medium">{airTimeStr}</span>
      </Row>

      <Row
        label="Total Time"
        icon={<Timer size={16} className="text-[var(--text-tertiary)]" weight="regular" />}
      >
        <span className="font-medium">
          {formatDurationMinutes(scheduledDeparture, scheduledArrival)}
        </span>
      </Row>
    </div>
  );
}
