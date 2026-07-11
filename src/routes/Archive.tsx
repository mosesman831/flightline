import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowCounterClockwise,
  CalendarBlank,
} from '@phosphor-icons/react';
import FlightCard from '../components/FlightCard';
import EmptyState from '../components/EmptyState';
import type { Flight } from '../types/flight';
import { unarchiveFlight } from '../store/flightStore';
import { hapticSuccess } from '../utils/haptic';
import { downloadIcs } from '../utils/ics';

interface ArchiveProps {
  flights: Flight[];
  refresh: () => void;
}

export default function Archive({ flights, refresh }: ArchiveProps) {
  const navigate = useNavigate();
  const [unarchiving, setUnarchiving] = useState<string | null>(null);

  async function handleUnarchive(id: string) {
    setUnarchiving(id);
    try {
      await unarchiveFlight(id);
      hapticSuccess();
      // Dispatch custom event so listeners update
      window.dispatchEvent(new CustomEvent('flights-changed'));
      refresh();
    } catch {
      // silent
    } finally {
      setUnarchiving(null);
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
          aria-label="Back to flights"
        >
          <ArrowLeft size={20} className="text-[var(--text-primary)]" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Flight Archive</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            {flights.length} archived flight{flights.length !== 1 ? 's' : ''}
          </p>
        </div>
        {flights.length > 0 && (
          <button
            onClick={() => downloadIcs(flights, 'flightline-archive.ics')}
            className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center active:scale-90 transition-transform"
            aria-label="Export as calendar file"
            title="Export as .ics"
          >
            <CalendarBlank size={20} className="text-[var(--text-primary)]" />
          </button>
        )}
      </div>

      {/* List */}
      <div className="space-y-1">
        {flights.length === 0 ? (
          <EmptyState
            title="No archived flights"
            subtitle="When you archive a flight it will appear here. You can unarchive it anytime to bring it back."
            action={{
              label: 'Back to Flights',
              onClick: () => navigate('/'),
            }}
          />
        ) : (
          flights.map((flight) => (
            <div key={flight.id} className="relative group">
              <FlightCard
                flight={flight}
                onClick={() => navigate(`/flight/${flight.id}`)}
              />
              {/* Unarchive action overlay row */}
              <button
                onClick={() => handleUnarchive(flight.id)}
                disabled={unarchiving === flight.id}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-[var(--bg-secondary)] shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 active:scale-90 disabled:opacity-40"
                aria-label="Unarchive flight"
                title="Unarchive"
              >
                {unarchiving === flight.id ? (
                  <span className="inline-block w-4 h-4 border-2 border-[var(--text-tertiary)] border-t-[#007AFF] rounded-full animate-spin" />
                ) : (
                  <ArrowCounterClockwise size={16} className="text-[#007AFF]" />
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
