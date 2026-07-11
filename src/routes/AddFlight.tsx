import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Airplane,
  CalendarBlank,
  Seat,
  FileText,
  CheckCircle,
  CaretDown,
  Lightning,
} from '@phosphor-icons/react';
import { AIRLINE_NAMES } from '../data/airlines';
import { searchAirports } from '../data/airports';
import { saveFlight } from '../store/flightStore';
import { generateId } from '../utils/format';
import { hapticSuccess, hapticError } from '../utils/haptic';
import type { Flight, CabinClass } from '../types/flight';
import { getAirport } from '../data/airports';
import { getAirline } from '../data/airlines';

interface AddFlightProps {
  onAdded: () => void;
}

const CABIN_CLASSES: { value: CabinClass; label: string }[] = [
  { value: 'economy', label: 'Economy' },
  { value: 'premium_economy', label: 'Premium Economy' },
  { value: 'business', label: 'Business' },
  { value: 'first', label: 'First' },
];

const RECENT_ROUTES_KEY = 'flightline-recent-routes';

function getRecentRoutes(): { origin: string; dest: string }[] {
  try {
    const stored = localStorage.getItem(RECENT_ROUTES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentRoute(origin: string, dest: string) {
  try {
    const routes = getRecentRoutes().filter((r) => !(r.origin === origin && r.dest === dest));
    routes.unshift({ origin, dest });
    localStorage.setItem(RECENT_ROUTES_KEY, JSON.stringify(routes.slice(0, 5)));
  } catch {
    // Silently fail
  }
}

/** Parse natural language input like "AA123 July 9" or "BA178 tomorrow" */
function parseNaturalLanguage(input: string): { airlineCode: string | null; flightNumber: string | null; date: string | null } {
  const result = { airlineCode: null as string | null, flightNumber: null as string | null, date: null as string | null };
  const trimmed = input.trim();

  // Match pattern: airline code (2-3 letters) followed by flight number (1-4 digits)
  const flightMatch = trimmed.match(/^([A-Z]{2}[A-Z]?)\s*(\d{1,4})\b/i);
  if (flightMatch) {
    const code = flightMatch[1].toUpperCase();
    // Check if it's a known airline code
    const airline = getAirline(code);
    if (airline && airline.name !== code) {
      result.airlineCode = code;
      result.flightNumber = flightMatch[2];
    }
  }

  // Try to extract a date from the remaining text
  const dateStr = trimmed.replace(flightMatch?.[0] ?? '', '').trim();

  if (dateStr) {
    const lower = dateStr.toLowerCase();
    const today = new Date();
    let targetDate: Date | null = null;

    // "tomorrow"
    if (/tomorrow|tmr/.test(lower)) {
      targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + 1);
    }
    // "today"
    else if (/today/.test(lower)) {
      targetDate = new Date(today);
    }
    // "next week" — set to 7 days from now
    else if (/next week/.test(lower)) {
      targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + 7);
    }
    // Try "July 9" or "Jul 9" or "July 9 2026"
    else {
      // Match patterns like "July 9", "Jul 9", "July 9 2026", "7/9", "7/9/2026"
      const datePatterns = [
        /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,           // 7/9 or 7/9/2026
        /([A-Za-z]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?/,        // July 9 or July 9, 2026
      ];
      for (const pattern of datePatterns) {
        const m = dateStr.match(pattern);
        if (m) {
          if (pattern === datePatterns[0]) {
            // MM/DD format
            const month = parseInt(m[1]) - 1;
            const day = parseInt(m[2]);
            const year = m[3] ? parseInt(m[3]) : today.getFullYear();
            const fullYear = year < 100 ? year + 2000 : year;
            targetDate = new Date(fullYear, month, day);
          } else {
            // "Month Day" format
            const months: Record<string, number> = {
              jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
              jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
            };
            const monthStr = m[1].slice(0, 3).toLowerCase();
            const month = months[monthStr];
            if (month !== undefined) {
              const day = parseInt(m[2]);
              const year = m[3] ? parseInt(m[3]) : (month < today.getMonth() ? today.getFullYear() + 1 : today.getFullYear());
              targetDate = new Date(year, month, day);
            }
          }
          break;
        }
      }
    }

    if (targetDate && !isNaN(targetDate.getTime())) {
      result.date = targetDate.toISOString().slice(0, 10);
    }
  }

  return result;
}

export default function AddFlight({ onAdded }: AddFlightProps) {
  const navigate = useNavigate();
  const params = useParams();

  const [quickText, setQuickText] = useState('');
  const [showQuickParse, setShowQuickParse] = useState(false);

  const [airlineQuery, setAirlineQuery] = useState('');
  const [selectedAirlineCode, setSelectedAirlineCode] = useState<string | null>(() => {
    // Smart default: remember last airline
    return localStorage.getItem('flightline-last-airline');
  });
  const [flightNumber, setFlightNumber] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [seatNumber, setSeatNumber] = useState('');
  const [checkInDesk, setCheckInDesk] = useState('');
  const [cabinClass, setCabinClass] = useState<CabinClass>('economy');
  const [personalNotes, setPersonalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [airlineOpen, setAirlineOpen] = useState(false);
  const [originQuery, setOriginQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState<string>('JFK');
  const [selectedDest, setSelectedDest] = useState<string>('LHR');
  const [originOpen, setOriginOpen] = useState(false);
  const [destOpen, setDestOpen] = useState(false);

  const airlineRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<HTMLDivElement>(null);
  const destRef = useRef<HTMLDivElement>(null);

  const filteredAirlines = useMemo(() => {
    if (!airlineQuery) return AIRLINE_NAMES;
    const q = airlineQuery.toLowerCase();
    return AIRLINE_NAMES.filter(
      ([name, code]) =>
        name.toLowerCase().includes(q) || code.toLowerCase().includes(q)
    );
  }, [airlineQuery]);

  const originResults = useMemo(() => {
    if (!originQuery) return [];
    return searchAirports(originQuery);
  }, [originQuery]);

  const destResults = useMemo(() => {
    if (!destQuery) return [];
    return searchAirports(destQuery);
  }, [destQuery]);

  const selectedAirlineName = selectedAirlineCode
    ? getAirline(selectedAirlineCode).name
    : null;

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (airlineRef.current && !airlineRef.current.contains(e.target as Node)) {
        setAirlineOpen(false);
      }
      if (originRef.current && !originRef.current.contains(e.target as Node)) {
        setOriginOpen(false);
      }
      if (destRef.current && !destRef.current.contains(e.target as Node)) {
        setDestOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Pre-fill from deep link params
  useEffect(() => {
    const { airline, flightNumber: fn, date: d } = params;
    if (airline) {
      const info = getAirline(airline.toUpperCase());
      if (info && info.name !== airline.toUpperCase()) {
        setSelectedAirlineCode(airline.toUpperCase());
      }
    }
    if (fn) setFlightNumber(fn);
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setDate(d);
  }, []);

  const canSubmit = selectedAirlineCode && flightNumber.trim().length > 0 && date;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const airlineInfo = getAirline(selectedAirlineCode!);
      const departureDate = new Date(date);
      departureDate.setHours(12, 0, 0, 0);
      const arrivalDate = new Date(departureDate);
      arrivalDate.setHours(departureDate.getHours() + 4);

      const newFlight: Flight = {
        id: generateId(),
        airlineIata: airlineInfo.iata,
        airlineName: airlineInfo.name,
        flightNumber: flightNumber.trim().toUpperCase(),
        date,
        scheduledDeparture: departureDate.toISOString(),
        scheduledArrival: arrivalDate.toISOString(),
        predictedDeparture: null,
        predictedArrival: null,
        actualDeparture: null,
        actualArrival: null,
        origin: getAirport(selectedOrigin),
        destination: getAirport(selectedDest),
        status: 'scheduled',
        delayMinutes: null,
        delayChance: 0,
        delayReasons: [],
        gate: null,
        terminal: null,
        aircraft: null,
        tailNumber: null,
        seatNumber: seatNumber.trim() || null,
        checkInDesk: checkInDesk.trim() || null,
        baggageReclaim: null,
        personalNotes: personalNotes.trim() || null,
        boardingGroup: null,
        boardingTime: null,
        cabinClass,
        timeline: [],
        inbound: null,
        pilotData: null,
        departureWeather: [],
        arrivalWeather: [],
        addedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        isDemo: false,
        archived: false,
        starred: false,
      };

      await saveFlight(newFlight);
      hapticSuccess();
      // Save last airline for smart defaults
      if (selectedAirlineCode) {
        localStorage.setItem('flightline-last-airline', selectedAirlineCode);
      }
      // Save recent route for smart suggestions
      addRecentRoute(selectedOrigin, selectedDest);
      onAdded();
      navigate('/');
    } catch {
      hapticError();
    } finally {
      setSubmitting(false);
    }
  }

  function handleQuickParse() {
    if (!quickText.trim()) return;
    const parsed = parseNaturalLanguage(quickText);
    if (parsed.airlineCode) {
      setSelectedAirlineCode(parsed.airlineCode);
    }
    if (parsed.flightNumber) {
      setFlightNumber(parsed.flightNumber);
    }
    if (parsed.date) {
      setDate(parsed.date);
    }
    if (parsed.airlineCode || parsed.flightNumber || parsed.date) {
      setShowQuickParse(true);
      hapticSuccess();
      setTimeout(() => setShowQuickParse(false), 2000);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="max-w-lg mx-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center active:scale-90 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft size={20} className="text-[var(--text-primary)]" />
        </button>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">Add Flight</h1>
      </div>

      {/* Quick Add: Natural language input */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Lightning size={16} className="text-amber-500" weight="fill" />
          <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
            Quick Add
          </span>
        </div>
        <div className="flex gap-2">
          <input
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleQuickParse();
              }
            }}
            placeholder='e.g. "AA123 July 9" or "BA178 tomorrow"'
            className="flex-1 px-4 py-3 rounded-2xl bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-base outline-none placeholder:text-[var(--text-tertiary)] focus:ring-2 focus:ring-[#007AFF]/30 transition-shadow"
          />
          <button
            type="button"
            onClick={handleQuickParse}
            className="px-4 py-3 rounded-2xl bg-[#007AFF] text-white font-semibold text-sm active:scale-95 transition-transform"
            aria-label="Parse flight number from text"
          >
            Parse
          </button>
        </div>
        {showQuickParse && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-emerald-500 font-medium mt-1.5"
          >
            Fields filled from quick entry! ✈️
          </motion.p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Airline */}
        <div className="card p-5 space-y-4">
          <SectionLabel icon={<Airplane size={16} />} label="Airline" />

          <div ref={airlineRef} className="relative">
            <button
              type="button"
              onClick={() => setAirlineOpen(!airlineOpen)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[var(--bg-tertiary)] text-left"
              aria-label={`Selected airline: ${selectedAirlineName ?? 'None'}`}
            >
              <span className={selectedAirlineCode ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-tertiary)]'}>
                {selectedAirlineName ?? 'Select airline'}
              </span>
              <CaretDown size={16} className="text-[var(--text-tertiary)]" weight="bold" />
            </button>

            {airlineOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden">
                <div className="p-2">
                  <input
                    value={airlineQuery}
                    onChange={(e) => setAirlineQuery(e.target.value)}
                    placeholder="Search airlines..."
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
                    autoFocus
                  />
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {filteredAirlines.map(([name, code]) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setSelectedAirlineCode(code);
                        setAirlineQuery('');
                        setAirlineOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-[var(--bg-tertiary)] transition-colors ${
                        selectedAirlineCode === code ? 'bg-[var(--bg-tertiary)]' : ''
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: getAirline(code).color }}
                      />
                      <span className="text-[var(--text-primary)] font-medium">{name}</span>
                      <span className="text-[var(--text-tertiary)] text-xs ml-auto">{code}</span>
                    </button>
                  ))}
                  {filteredAirlines.length === 0 && (
                    <p className="px-4 py-3 text-sm text-[var(--text-tertiary)]">No airlines found</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Flight Number */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">
              Flight Number
            </label>
            <input
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
              placeholder="e.g. BA178"
              className="w-full px-4 py-3.5 rounded-2xl bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium text-base outline-none placeholder:text-[var(--text-tertiary)] focus:ring-2 focus:ring-[#007AFF]/30 transition-shadow"
            />
          </div>
        </div>

        {/* Origin & Destination */}
        <div className="card p-5 space-y-4">
          <SectionLabel icon={<Airplane size={16} />} label="Route" />

          <div ref={originRef} className="relative">
            <label className="block text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">
              Origin
            </label>
            <button
              type="button"
              onClick={() => setOriginOpen(!originOpen)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[var(--bg-tertiary)] text-left"
              aria-label={`Origin: ${getAirport(selectedOrigin).city} (${selectedOrigin})`}
            >
              <span className="text-[var(--text-primary)] font-medium">
                {getAirport(selectedOrigin).city} ({selectedOrigin})
              </span>
              <CaretDown size={16} className="text-[var(--text-tertiary)]" weight="bold" />
            </button>

            {originOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden">
                <div className="p-2">
                  <input
                    value={originQuery}
                    onChange={(e) => setOriginQuery(e.target.value)}
                    placeholder="Search airports..."
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
                    autoFocus
                  />
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {originResults.map((ap) => (
                    <button
                      key={ap.iata}
                      type="button"
                      onClick={() => {
                        setSelectedOrigin(ap.iata);
                        setOriginQuery('');
                        setOriginOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-[var(--bg-tertiary)] transition-colors ${
                        selectedOrigin === ap.iata ? 'bg-[var(--bg-tertiary)]' : ''
                      }`}
                    >
                      <span className="text-[var(--text-primary)] font-medium">{ap.city}</span>
                      <span className="text-[var(--text-secondary)]">{ap.iata}</span>
                      <span className="text-[var(--text-tertiary)] text-xs ml-auto truncate">{ap.name}</span>
                    </button>
                  ))}
                  {originResults.length === 0 && originQuery && (
                    <p className="px-4 py-3 text-sm text-[var(--text-tertiary)]">No airports found</p>
                  )}
                  {!originQuery && (
                    <p className="px-4 py-3 text-sm text-[var(--text-tertiary)]">Type to search airports</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div ref={destRef} className="relative">
            <label className="block text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">
              Destination
            </label>
            <button
              type="button"
              onClick={() => setDestOpen(!destOpen)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[var(--bg-tertiary)] text-left"
              aria-label={`Destination: ${getAirport(selectedDest).city} (${selectedDest})`}
            >
              <span className="text-[var(--text-primary)] font-medium">
                {getAirport(selectedDest).city} ({selectedDest})
              </span>
              <CaretDown size={16} className="text-[var(--text-tertiary)]" weight="bold" />
            </button>

            {destOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden">
                <div className="p-2">
                  <input
                    value={destQuery}
                    onChange={(e) => setDestQuery(e.target.value)}
                    placeholder="Search airports..."
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
                    autoFocus
                  />
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {destResults.map((ap) => (
                    <button
                      key={ap.iata}
                      type="button"
                      onClick={() => {
                        setSelectedDest(ap.iata);
                        setDestQuery('');
                        setDestOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-[var(--bg-tertiary)] transition-colors ${
                        selectedDest === ap.iata ? 'bg-[var(--bg-tertiary)]' : ''
                      }`}
                    >
                      <span className="text-[var(--text-primary)] font-medium">{ap.city}</span>
                      <span className="text-[var(--text-secondary)]">{ap.iata}</span>
                      <span className="text-[var(--text-tertiary)] text-xs ml-auto truncate">{ap.name}</span>
                    </button>
                  ))}
                  {destResults.length === 0 && destQuery && (
                    <p className="px-4 py-3 text-sm text-[var(--text-tertiary)]">No airports found</p>
                  )}
                  {!destQuery && (
                    <p className="px-4 py-3 text-sm text-[var(--text-tertiary)]">Type to search airports</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Routes */}
        {getRecentRoutes().length > 0 && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                Recent Routes
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {getRecentRoutes().map((route) => (
                <button
                  key={`${route.origin}-${route.dest}`}
                  type="button"
                  onClick={() => {
                    setSelectedOrigin(route.origin);
                    setSelectedDest(route.dest);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${
                    selectedOrigin === route.origin && selectedDest === route.dest
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-color)]'
                  }`}
                >
                  <span>{route.origin}</span>
                  <ArrowRight size={12} weight="bold" />
                  <span>{route.dest}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date */}
        <div className="card p-5 space-y-4">
          <SectionLabel icon={<CalendarBlank size={16} />} label="Date" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium text-base outline-none focus:ring-2 focus:ring-[#007AFF]/30 transition-shadow"
          />
        </div>

        {/* Cabin Class */}
        <div className="card p-5 space-y-3">
          <SectionLabel icon={<Seat size={16} />} label="Cabin Class" />
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cabin class">
            {CABIN_CLASSES.map((cabin) => (
              <button
                key={cabin.value}
                type="button"
                role="radio"
                aria-checked={cabinClass === cabin.value}
                onClick={() => setCabinClass(cabin.value)}
                className={`px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 ${
                  cabinClass === cabin.value
                    ? 'bg-[#007AFF] text-white shadow-md'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] active:scale-95'
                }`}
              >
                {cabin.label}
              </button>
            ))}
          </div>
        </div>

        {/* Optional Fields */}
        <div className="card p-5 space-y-4">
          <SectionLabel icon={<FileText size={16} />} label="Trip Details (Optional)" />

          <div>
            <label className="block text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">
              Seat Number
            </label>
            <input
              value={seatNumber}
              onChange={(e) => setSeatNumber(e.target.value)}
              placeholder="e.g. 22A"
              className="w-full px-4 py-3.5 rounded-2xl bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium text-base outline-none placeholder:text-[var(--text-tertiary)] focus:ring-2 focus:ring-[#007AFF]/30 transition-shadow"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">
              Check-in Desk
            </label>
            <input
              value={checkInDesk}
              onChange={(e) => setCheckInDesk(e.target.value)}
              placeholder="e.g. Zone C, Desks 12-18"
              className="w-full px-4 py-3.5 rounded-2xl bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium text-base outline-none placeholder:text-[var(--text-tertiary)] focus:ring-2 focus:ring-[#007AFF]/30 transition-shadow"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">
              Personal Notes
            </label>
            <textarea
              value={personalNotes}
              onChange={(e) => setPersonalNotes(e.target.value)}
              placeholder="Any reminders about this trip..."
              rows={3}
              className="w-full px-4 py-3.5 rounded-2xl bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium text-base outline-none placeholder:text-[var(--text-tertiary)] focus:ring-2 focus:ring-[#007AFF]/30 transition-shadow resize-none"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:scale-100
            bg-[#007AFF] text-white shadow-lg shadow-[#007AFF]/25 hover:bg-[#0066D6]"
        >
          {submitting ? (
            <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle size={20} weight="fill" />
              Track Flight
            </>
          )}
        </button>

        <div className="h-4" />
      </form>
    </motion.div>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
    </div>
  );
}
