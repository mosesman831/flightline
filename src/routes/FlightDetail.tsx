import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  ArrowLeft,
  ShareNetwork,
  ArrowsClockwise,
  Clock,
  Suitcase,
  Note,
  MapPin,
  SealCheck,
  WifiHigh,
  Cloud,
  AirplaneTilt,
  Info,
  Tag,
  FileText,
  ArrowRight,
  IdentificationBadge,
  Wind,
  Eye,
  Thermometer,
} from '@phosphor-icons/react';
import type { Flight, LivePosition } from '../types/flight';
import { greatCircleKm } from '../utils/geo';
import { refreshFlight, refreshPosition, POSITION_INTERVAL_MS } from '../utils/refresh';
import { fetchWeather, type ApiWeather } from '../utils/api';
import { shareFlightCard } from '../utils/shareFlight';
import { useOnlineStatus } from '../utils/useOnlineStatus';
import AirlineLogo from '../components/AirlineLogo';
import StatusPill from '../components/StatusPill';
import Countdown from '../components/Countdown';
import DelayRing from '../components/DelayRing';
import { formatTime, formatDuration, formatTimeWithTz } from '../utils/format';
import { predictDelay } from '../utils/predictions';
import FlightInfoBar from '../components/FlightInfoBar';
import BookingCodeCard from '../components/BookingCodeCard';
import FlightTimetable from '../components/FlightTimetable';
import NotificationsSection from '../components/NotificationsSection';
import ArrivalForecast from '../components/ArrivalForecast';
import AircraftCard from '../components/AircraftCard';
import RulesAndBaggage from '../components/RulesAndBaggage';
import DisruptionAlert from '../components/DisruptionAlert';
import ShareCard from '../components/ShareCard';

interface FlightDetailProps {
  flights: Flight[];
  loading?: boolean;
}

/** Live counter showing "Updated X seconds ago" */
function LiveUpdateCounter({ lastUpdatedAt }: { lastUpdatedAt: string }) {
  const [text, setText] = useState('');

  useEffect(() => {
    function tick() {
      const now = Date.now();
      const updated = new Date(lastUpdatedAt).getTime();
      const seconds = Math.floor((now - updated) / 1000);

      if (seconds < 0) {
        setText('Updated just now');
      } else if (seconds < 5) {
        setText('Updated just now');
      } else if (seconds < 60) {
        setText(`Updated ${seconds}s ago`);
      } else if (seconds < 3600) {
        setText(`Updated ${Math.floor(seconds / 60)}m ago`);
      } else {
        setText(`Updated ${Math.floor(seconds / 3600)}h ago`);
      }
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lastUpdatedAt]);

  return <span>{text}</span>;
}

function WeatherIcon({ icon }: { icon: string }) {
  return (
    <span className="text-lg">
      {icon === 'sun' ? '☀️' : icon === 'partly-cloudy' ? '⛅' : icon === 'cloudy' ? '☁️' : '🌧️'}
    </span>
  );
}

export default function FlightDetail({ flights }: FlightDetailProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [flight, setFlight] = useState<Flight | undefined>(() => flights.find((f) => f.id === id));
  const [seeMore, setSeeMore] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [refreshState, setRefreshState] = useState<'idle' | 'refreshing' | 'fresh' | 'stale' | 'failed'>('idle');
  const [originWeather, setOriginWeather] = useState<ApiWeather | null>(null);
  const [destWeather, setDestWeather] = useState<ApiWeather | null>(null);
  const online = useOnlineStatus();
  const shareCardRef = useRef<HTMLDivElement>(null);
  const shareNoteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setFlight(flights.find((f) => f.id === id));
  }, [flights, id]);

  // Clear any pending refresh-outcome / share-note reset on unmount.
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      if (shareNoteTimeoutRef.current) clearTimeout(shareNoteTimeoutRef.current);
    };
  }, []);

  // ── METAR/TAF weather: fetch origin + destination on open, refresh ≤10 min ──
  const originIcao = flight?.origin.icao;
  const destIcao = flight?.destination.icao;
  useEffect(() => {
    if (!id) return;
    const isIcao = (code: string | undefined): code is string => !!code && /^[A-Za-z]{4}$/.test(code);
    let cancelled = false;

    async function load() {
      if (isIcao(originIcao)) {
        const w = await fetchWeather(originIcao);
        if (!cancelled) setOriginWeather(w);
      }
      if (isIcao(destIcao)) {
        const w = await fetchWeather(destIcao);
        if (!cancelled) setDestWeather(w);
      }
    }

    setOriginWeather(null);
    setDestWeather(null);
    load();
    const interval = setInterval(load, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, originIcao, destIcao]);

  // ── Live position polling (detail map only): every POSITION_INTERVAL_MS ──
  const flightId = flight?.id;
  const flightStatus = flight?.status;
  const isDemo = flight?.isDemo;
  useEffect(() => {
    if (!flightId || isDemo) return;
    const terminal = flightStatus === 'landed' || flightStatus === 'cancelled' || flightStatus === 'diverted';
    if (terminal) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (interval !== null) return;
      refreshPosition(flightId!);
      interval = setInterval(() => refreshPosition(flightId!), POSITION_INTERVAL_MS);
    }
    function stop() {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    }
    function handleVisibility() {
      if (document.visibilityState === 'visible') start();
      else stop();
    }

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stop();
    };
  }, [flightId, flightStatus, isDemo]);

  // If flights are still loading, show the skeleton
  const loading = flights.length === 0 && !flight;

  if (!flight) {
    if (loading) {
      return (
        <div className="max-w-lg mx-auto pt-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full skeleton" />
            <div className="flex-1" />
            <div className="w-10 h-10 rounded-full skeleton" />
          </div>
          <div className="card p-6 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full skeleton" />
              <div className="space-y-1.5 flex-1">
                <div className="h-5 w-36 skeleton rounded-md" />
                <div className="h-3 w-24 skeleton rounded-md" />
              </div>
            </div>
            <div className="flex items-center justify-between mb-6">
              <div className="text-center space-y-2">
                <div className="h-8 w-16 skeleton rounded-md mx-auto" />
                <div className="h-3 w-12 skeleton rounded-md mx-auto" />
              </div>
              <div className="flex-1 mx-4">
                <div className="h-0.5 skeleton rounded-full" />
              </div>
              <div className="text-center space-y-2">
                <div className="h-8 w-16 skeleton rounded-md mx-auto" />
                <div className="h-3 w-12 skeleton rounded-md mx-auto" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="h-3 w-20 skeleton rounded-md" />
                <div className="h-7 w-24 skeleton rounded-md" />
              </div>
              <div className="h-16 w-16 skeleton rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-3 flex items-center gap-3">
                <div className="w-9 h-9 skeleton rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 w-16 skeleton rounded-md" />
                  <div className="h-4 w-20 skeleton rounded-md" />
                </div>
              </div>
            ))}
          </div>
          <div className="card p-5 mb-4">
            <div className="h-4 w-24 skeleton rounded-md mb-3" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 skeleton rounded-lg" />
                  <div className="space-y-1 flex-1">
                    <div className="h-3 w-20 skeleton rounded-md" />
                    <div className="h-4 w-32 skeleton rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-[var(--text-secondary)] mb-4">Flight not found</p>
        <button onClick={() => navigate('/')} className="text-[#007AFF] font-semibold">
          Back to flights
        </button>
      </div>
    );
  }

  const prediction = predictDelay(flight);
  const isActive = flight.status === 'scheduled' || flight.status === 'boarding' || flight.status === 'active';

  async function handleShare() {
    if (sharing || !shareCardRef.current || !flight) return;
    setSharing(true);
    try {
      const result = await shareFlightCard(shareCardRef.current, flight);
      const note =
        result === 'downloaded' ? 'Saved image' :
        result === 'shared-text' ? 'Shared link' :
        result === 'shared-file' ? 'Shared image' : null;
      if (note) {
        setShareNote(note);
        if (shareNoteTimeoutRef.current) clearTimeout(shareNoteTimeoutRef.current);
        shareNoteTimeoutRef.current = setTimeout(() => {
          setShareNote(null);
          shareNoteTimeoutRef.current = null;
        }, 2500);
      }
    } catch {
      // Capture/share failed
    } finally {
      setSharing(false);
    }
  }

  async function handleRefresh() {
    if (!flight || refreshState === 'refreshing') return;
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    setRefreshState('refreshing');
    const result = await refreshFlight(flight.id);
    // 'skipped' → back to idle silently; otherwise reflect the outcome briefly.
    const next = result === 'skipped' ? 'idle' : result;
    setRefreshState(next);
    if (next !== 'idle') {
      refreshTimeoutRef.current = setTimeout(() => {
        setRefreshState('idle');
        refreshTimeoutRef.current = null;
      }, 2500);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="max-w-lg mx-auto"
    >
      {/* Hidden, off-screen capture card fed to the share pipeline. */}
      <div
        aria-hidden
        style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}
      >
        <ShareCard ref={shareCardRef} flight={flight} />
      </div>

      {/* Share outcome toast */}
      {shareNote && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 px-4 py-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-medium shadow-lg"
        >
          {shareNote}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center active:scale-90 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft size={20} className="text-[var(--text-primary)]" />
        </button>
        <div className="flex-1" />
        <button
          onClick={handleRefresh}
          disabled={refreshState === 'refreshing'}
          className={`w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center active:scale-90 transition-transform disabled:opacity-60 ${
            refreshState === 'fresh' ? 'text-[#34C759]' :
            refreshState === 'stale' ? 'text-amber-500' :
            refreshState === 'failed' ? 'text-rose-500' : 'text-[var(--text-primary)]'
          }`}
          aria-label={
            refreshState === 'refreshing' ? 'Refreshing flight' :
            refreshState === 'fresh' ? 'Flight refreshed' :
            refreshState === 'stale' ? 'Showing saved data' :
            refreshState === 'failed' ? 'Refresh failed' : 'Refresh flight'
          }
        >
          <ArrowsClockwise
            size={20}
            className={refreshState === 'refreshing' ? 'animate-spin' : ''}
          />
        </button>
        <button
          onClick={handleShare}
          disabled={sharing}
          className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
          aria-label="Share flight as image"
        >
          <ShareNetwork size={20} className="text-[var(--text-primary)]" />
        </button>
      </div>

      {/* Hero Card */}
      <div className="card p-6 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <AirlineLogo iata={flight.airlineIata} name={flight.airlineName} size={44} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--text-primary)]">
                {flight.airlineIata} {flight.flightNumber}
              </span>
              <StatusPill status={flight.status} delayMinutes={flight.delayMinutes} />
            </div>
            <span className="text-xs text-[var(--text-secondary)]">{flight.airlineName}</span>
          </div>
        </div>

        {/* Route */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--text-primary)]">{flight.origin.iata}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">{flight.origin.city}</div>
            <div className="text-xs text-[var(--text-tertiary)]">{formatTime(flight.scheduledDeparture, flight.origin.timezone)}</div>
          </div>
          <div className="flex-1 mx-4">
            <div className="flex items-center">
              <div className="h-0.5 flex-1 bg-[var(--border-color)]" />
              <AirplaneTilt size={18} className="mx-2 text-[var(--text-tertiary)]" weight="fill" />
              <div className="h-0.5 flex-1 bg-[var(--border-color)]" />
            </div>
            <div className="text-center text-xs text-[var(--text-tertiary)] mt-1">
              {formatDuration(flight.scheduledDeparture, flight.scheduledArrival)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--text-primary)]">{flight.destination.iata}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">{flight.destination.city}</div>
            <div className="text-xs text-[var(--text-tertiary)]">{formatTime(flight.scheduledArrival, flight.destination.timezone)}</div>
          </div>
        </div>

        {/* Timezone-aware display */}
        {(formatTimeWithTz(flight.scheduledDeparture, flight.origin.timezone).differs ||
          formatTimeWithTz(flight.scheduledArrival, flight.destination.timezone).differs) && (
          <div className="mb-4 px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]">
            <p className="text-[11px] text-[var(--text-tertiary)] font-medium">
              Your time:&nbsp;
              {formatTimeWithTz(flight.scheduledDeparture, flight.origin.timezone).differs && (
                <span>Dep {formatTimeWithTz(flight.scheduledDeparture, flight.origin.timezone).userTime}</span>
              )}
              {formatTimeWithTz(flight.scheduledDeparture, flight.origin.timezone).differs &&
               formatTimeWithTz(flight.scheduledArrival, flight.destination.timezone).differs && <span> &middot; </span>}
              {formatTimeWithTz(flight.scheduledArrival, flight.destination.timezone).differs && (
                <span>Arr {formatTimeWithTz(flight.scheduledArrival, flight.destination.timezone).userTime}</span>
              )}
            </p>
          </div>
        )}

        {/* Countdown + Delay Ring */}
        <div className="flex items-center justify-between">
          {isActive ? (
            <Countdown targetTime={flight.scheduledDeparture} label="Departs in" />
          ) : (
            <div className="text-sm text-[var(--text-secondary)]">
              {flight.status === 'landed' && 'Flight has landed ✓'}
              {flight.status === 'cancelled' && 'Flight was cancelled'}
              {flight.status === 'diverted' && 'Flight was diverted'}
            </div>
          )}
          <div className="flex flex-col items-center">
            <DelayRing chance={prediction.delayChance} size={64} strokeWidth={4} />
            <span className="text-[10px] text-[var(--text-tertiary)] mt-1">Delay risk</span>
          </div>
        </div>

        {/* Predicted times */}
        {prediction.predictedDeparture && (
          <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Predicted</span>
              <span className="text-[var(--text-primary)] font-semibold">
                Dep {formatTime(prediction.predictedDeparture, flight.origin.timezone)}
                {prediction.predictedArrival && ` • Arr ${formatTime(prediction.predictedArrival, flight.destination.timezone)}`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Flight Info Bar */}
      <div className="mb-4">
        <FlightInfoBar
          durationMinutes={Math.round((new Date(flight.scheduledArrival).getTime() - new Date(flight.scheduledDeparture).getTime()) / 60000)}
          distanceKm={greatCircleKm(flight.origin.lat, flight.origin.lon, flight.destination.lat, flight.destination.lon)}
          isOvernight={new Date(flight.scheduledArrival).getDate() > new Date(flight.scheduledDeparture).getDate()}
          departureTime={flight.scheduledDeparture}
          arrivalTime={flight.scheduledArrival}
        />
      </div>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <QuickInfoCard icon={<IdentificationBadge size={18} />} label="Gate" value={flight.gate ?? 'TBD'} />
        <QuickInfoCard icon={<MapPin size={18} />} label="Terminal" value={flight.terminal ?? 'TBD'} />
        <QuickInfoCard icon={<AirplaneTilt size={18} />} label="Aircraft" value={flight.aircraft ?? 'TBD'} />
        <QuickInfoCard icon={<Tag size={18} />} label="Tail" value={flight.tailNumber ?? 'TBD'} />
      </div>

      {/* Traveller Info Card */}
      <div className="card p-5 mb-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <Suitcase size={16} weight="fill" className="text-[#007AFF]" />
          Your Trip
        </h3>
        <div className="space-y-3">
          <TravellerRow icon={<IdentificationBadge size={16} />} label="Seat" value={flight.seatNumber ?? 'Not set'} />
          <TravellerRow icon={<FileText size={16} />} label="Check-in" value={flight.checkInDesk ?? 'Not set'} />
          <TravellerRow icon={<Suitcase size={16} />} label="Baggage Reclaim" value={flight.baggageReclaim ?? 'TBD'} />
          <TravellerRow icon={<Tag size={16} />} label="Boarding Group" value={flight.boardingGroup ?? 'N/A'} />
          <TravellerRow icon={<Clock size={16} />} label="Boarding" value={flight.boardingTime ? formatTime(flight.boardingTime) : 'TBD'} />
          <TravellerRow icon={<SealCheck size={16} />} label="Cabin" value={flight.cabinClass ? flight.cabinClass.replace('_', ' ') : 'Not set'} />
          {flight.personalNotes && (
            <TravellerRow icon={<Note size={16} />} label="Notes" value={flight.personalNotes} />
          )}
        </div>
      </div>

      {/* Booking Code & Seat */}
      <BookingCodeCard
        bookingCode={null}
        seatNumber={flight.seatNumber}
      />

      {/* Notifications */}
      <NotificationsSection notificationsEnabled={false} />

      {/* Rules & Baggage */}
      <RulesAndBaggage airline={flight.airlineName} cabinClass={flight.cabinClass ?? 'Economy'} />

      {/* Flight Timetable */}
      <FlightTimetable
        scheduledDeparture={flight.scheduledDeparture}
        scheduledArrival={flight.scheduledArrival}
        estimatedDeparture={flight.predictedDeparture}
        estimatedArrival={flight.predictedArrival}
        gate={flight.gate}
        terminal={flight.terminal}
      />

      {/* Timeline Card */}
      {flight.timeline.length > 0 && (
        <div className="card p-5 mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Info size={16} className="text-[#007AFF]" />
            Timeline
          </h3>
          <div className="space-y-0">
            {flight.timeline.map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: i * 0.06, ease: 'easeOut' }}
                className="flex gap-3 pb-3 relative"
              >
                {i < flight.timeline.length - 1 && (
                  <div className="absolute left-[11px] top-5 bottom-0 w-px bg-[var(--border-color)]" />
                )}
                <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#007AFF]" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    {event.field}: {event.newValue}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {new Date(event.recordedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Delay Reasons */}
      {prediction.delayReasons.length > 0 && (
        <div className="card p-5 mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Clock size={16} className="text-amber-500" />
            Delay Factors
          </h3>
          <div className="space-y-2">
            {prediction.delayReasons.slice(0, seeMore ? undefined : 3).map((reason, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                  reason.severity === 'high' ? 'bg-rose-500' :
                  reason.severity === 'medium' ? 'bg-amber-500' : 'bg-amber-300'
                }`} />
                <div>
                  <span className="text-[var(--text-primary)]">{reason.description}</span>
                  <span className="text-[var(--text-tertiary)] ml-1">+{reason.minutes}m</span>
                </div>
              </div>
            ))}
            {prediction.delayReasons.length > 3 && (
              <button
                onClick={() => setSeeMore(!seeMore)}
                className="text-[#007AFF] text-xs font-semibold"
              >
                {seeMore ? 'Show less' : `Show ${prediction.delayReasons.length - 3} more`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Arrival Weather */}
      {flight.arrivalWeather.length > 0 && (
        <div className="card p-5 mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Cloud size={16} className="text-[#007AFF]" />
            Arrival Weather
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {flight.arrivalWeather.filter((_, i) => i % 2 === 0).slice(0, 6).map((w, i) => (
              <div key={i} className="flex flex-col items-center gap-1 min-w-[60px] p-2 rounded-xl bg-[var(--bg-tertiary)]">
                <WeatherIcon icon={w.icon} />
                <span className="text-xs font-medium text-[var(--text-primary)]">{Math.round(w.tempC)}°</span>
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  {new Date(w.time).getHours()}:00
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pilot Weather (METAR/TAF) */}
      {(originWeather?.metar || destWeather?.metar) ? (
        <div className="card p-5 mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Cloud size={16} weight="fill" className="text-[#007AFF]" />
            Pilot Weather
          </h3>
          <div className="space-y-4">
            {originWeather?.metar && (
              <WeatherAirportBlock code={flight.origin.icao || flight.origin.iata} weather={originWeather} />
            )}
            {destWeather?.metar && (
              <WeatherAirportBlock code={flight.destination.icao || flight.destination.iata} weather={destWeather} />
            )}
          </div>
        </div>
      ) : (originWeather !== null || destWeather !== null) ? (
        <div className="card p-5 mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Cloud size={16} weight="fill" className="text-[#007AFF]" />
            Pilot Weather
          </h3>
          <p className="text-xs text-[var(--text-tertiary)]">Weather unavailable</p>
        </div>
      ) : null}

      {/* Inbound Aircraft */}
      {flight.inbound && (
        <div className="card p-5 mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <WifiHigh size={16} className="text-[#007AFF]" />
            Inbound Aircraft
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="font-medium text-[var(--text-primary)] text-sm">
                {flight.inbound.flightNumber}
              </div>
              <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)] mt-0.5">
                <span>{flight.inbound.origin.iata}</span>
                <ArrowRight size={10} />
                <span>{flight.inbound.destination.iata}</span>
              </div>
            </div>
            <div className="text-right">
              <StatusPill status={flight.inbound.status} />
              <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                Est. {formatTime(flight.inbound.actualArrival ?? flight.inbound.scheduledArrival)}
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--text-tertiary)]">
            Tail: {flight.inbound.tailNumber}
          </div>
        </div>
      )}

      {/* Arrival Forecast */}
      <ArrivalForecast
        flightNumber={flight.flightNumber}
      />

      {/* Aircraft Card */}
      <AircraftCard
        aircraft={flight.aircraft}
        tailNumber={flight.tailNumber}
        airline={flight.airlineName}
        timesFlown={0}
      />

      {/* Disruption Alert */}
      {flight.delayChance > 30 && (
        <DisruptionAlert
          severity={flight.delayChance > 60 ? 'high' : 'medium'}
          message={prediction.delayReasons[0]?.description ?? 'Flight may experience delays due to weather or operational factors.'}
        />
      )}

      {/* Where's My Plane Map */}
      <div className="card p-5 mb-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <MapPin size={16} className="text-[#007AFF]" />
          Where's My Plane
        </h3>
        <div className="rounded-xl overflow-hidden h-48 relative">
          {online ? (
            <FlightMap
              originLat={flight.origin.lat}
              originLon={flight.origin.lon}
              destLat={flight.destination.lat}
              destLon={flight.destination.lon}
              originIata={flight.origin.iata}
              destIata={flight.destination.iata}
              position={flight.livePosition ?? null}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[var(--bg-tertiary)]">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--text-primary)]">{flight.origin.iata}</span>
                <span className="w-8 border-t-2 border-dashed border-[var(--text-tertiary)]" />
                <AirplaneTilt size={20} weight="fill" className="text-[var(--text-tertiary)]" />
                <span className="w-8 border-t-2 border-dashed border-[var(--text-tertiary)]" />
                <span className="text-2xl font-bold text-[var(--text-primary)]">{flight.destination.iata}</span>
              </div>
              <span className="text-xs text-[var(--text-tertiary)]">Map unavailable offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Update info */}
      <div className="text-center mb-8 space-y-1">
        <div className="text-xs text-[var(--text-tertiary)]">
          <LiveUpdateCounter lastUpdatedAt={flight.lastUpdatedAt} />
        </div>
        {flight.isStale && (
          <div className="text-xs text-amber-500">Showing saved data</div>
        )}
        {flight.lastLiveError && !flight.isStale && (
          <div className="text-xs text-[var(--text-tertiary)] opacity-70">Couldn't refresh</div>
        )}
      </div>
    </motion.div>
  );
}

function QuickInfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">{label}</div>
        <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{value}</div>
      </div>
    </div>
  );
}

function TravellerRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
        <div className="text-sm font-medium text-[var(--text-primary)] truncate">{value}</div>
      </div>
    </div>
  );
}

/** Raw METAR/TAF plus wind/vis/temp chips for a single airport. */
function WeatherAirportBlock({ code, weather }: { code: string; weather: ApiWeather }) {
  const chips: { icon: React.ReactNode; label: string }[] = [];
  if (weather.windSpeedKts != null) {
    const gust = weather.windGustKts != null ? `G${Math.round(weather.windGustKts)}` : '';
    chips.push({ icon: <Wind size={12} weight="fill" />, label: `${Math.round(weather.windSpeedKts)}${gust} kt` });
  }
  if (weather.visibilityKm != null) {
    chips.push({ icon: <Eye size={12} weight="fill" />, label: `${weather.visibilityKm} km` });
  }
  if (weather.temperatureC != null) {
    chips.push({ icon: <Thermometer size={12} weight="fill" />, label: `${Math.round(weather.temperatureC)}°C` });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-[var(--text-primary)] tracking-wide">{code}</span>
        {weather.stale && (
          <span className="text-[10px] text-amber-500">saved</span>
        )}
      </div>
      {weather.metar && (
        <pre className="text-[11px] leading-relaxed font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words bg-[var(--bg-tertiary)] rounded-lg p-2">
          {weather.metar}
        </pre>
      )}
      {weather.taf && (
        <details className="mt-1.5">
          <summary className="text-[11px] text-[#007AFF] cursor-pointer select-none">TAF</summary>
          <pre className="text-[11px] leading-relaxed font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words bg-[var(--bg-tertiary)] rounded-lg p-2 mt-1 max-h-40 overflow-y-auto">
            {weather.taf}
          </pre>
        </details>
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {chips.map((chip, i) => (
            <span
              key={i}
              className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] bg-[var(--bg-tertiary)] rounded-full px-2 py-0.5"
            >
              {chip.icon}
              {chip.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Human-friendly observed timestamp for the plane popup. */
function formatObserved(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const seconds = Math.floor((Date.now() - t) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(iso).toLocaleString();
}

/** MapLibre GL map showing the flight route with the real live aircraft position. */
function FlightMap({
  originLat, originLon, destLat, destLon, originIata, destIata, position,
}: {
  originLat: number; originLon: number;
  destLat: number; destLon: number;
  originIata: string; destIata: string;
  position: LivePosition | null;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const planeMarkerRef = useRef<maplibregl.Marker | null>(null);
  const loadedRef = useRef(false);
  const positionRef = useRef<LivePosition | null>(position);
  positionRef.current = position;

  // Create the map once and draw origin/destination markers + dashed route.
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [(originLon + destLon) / 2, (originLat + destLat) / 2],
      zoom: 2.5,
      attributionControl: false,
      interactive: true,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      loadedRef.current = true;

      new maplibregl.Marker({ color: '#007AFF' })
        .setLngLat([originLon, originLat])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setText(originIata))
        .addTo(map);

      new maplibregl.Marker({ color: '#FF3B30' })
        .setLngLat([destLon, destLat])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setText(destIata))
        .addTo(map);

      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [originLon, originLat],
              [destLon, destLat],
            ],
          },
        },
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#007AFF',
          'line-width': 2.5,
          'line-opacity': 0.6,
          'line-dasharray': [4, 3],
        },
      });

      // Draw the live aircraft marker if a position is already available.
      syncPlaneMarker();
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      planeMarkerRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originLat, originLon, destLat, destLon, originIata, destIata]);

  // Create/update/remove the live aircraft marker whenever `position` changes.
  function syncPlaneMarker() {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    const pos = positionRef.current;
    if (!pos) {
      if (planeMarkerRef.current) {
        planeMarkerRef.current.remove();
        planeMarkerRef.current = null;
      }
      return;
    }

    const color = pos.stale ? '#8E8E93' : '#34C759';
    const lngLat: [number, number] = [pos.longitude, pos.latitude];
    const heading = pos.heading ?? 0;

    const observed = formatObserved(pos.observedAt);
    const statusLabel = pos.stale ? `Last seen ${observed}` : 'Live';
    const alt = pos.altitudeFt != null ? `${Math.round(pos.altitudeFt).toLocaleString()} ft` : '—';
    const spd = pos.groundSpeedKt != null ? `${Math.round(pos.groundSpeedKt)} kt` : '—';
    const popupHtml = `<b>${statusLabel}</b><br/>Alt ${alt} · ${spd}<br/>Observed ${observed}`;

    if (planeMarkerRef.current) {
      planeMarkerRef.current.setLngLat(lngLat);
      planeMarkerRef.current.setRotation(heading);
      planeMarkerRef.current.getPopup()?.setHTML(popupHtml);
      const el = planeMarkerRef.current.getElement();
      const path = el.querySelector('svg path');
      if (path) path.setAttribute('fill', color);
    } else {
      planeMarkerRef.current = new maplibregl.Marker({ color, scale: 0.85, rotation: heading })
        .setLngLat(lngLat)
        .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(popupHtml))
        .addTo(map);
    }
  }

  useEffect(() => {
    syncPlaneMarker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  return (
    <>
      <div ref={mapContainer} className="w-full h-full" />
      {!position && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-primary)]/80 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm">
            Live position unavailable
          </span>
        </div>
      )}
    </>
  );
}
