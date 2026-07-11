import { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowsDownUp } from '@phosphor-icons/react';
import FlightCard from '../components/FlightCard';
import EmptyState from '../components/EmptyState';
import { formatDate, cn } from '../utils/format';
import { groupIntoTrips, computeConnection } from '../utils/trips';
import type { ConnectionStatus } from '../utils/trips';
import { hapticMedium } from '../utils/haptic';
import type { Flight } from '../types/flight';

const CONNECTION_STYLES: Record<ConnectionStatus, string> = {
  comfortable: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  close: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  tight: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  impossible: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

interface FlightsListProps {
  flights: Flight[];
  loading: boolean;
  refresh: () => void;
}

const PULL_THRESHOLD = 60;
const MAX_PULL_DISTANCE = 120;

export default function FlightsList({ flights, loading, refresh }: FlightsListProps) {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const refreshingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRefreshRef = useRef<() => Promise<void>>(async () => {});
  const mouseDragRef = useRef({ startY: 0, isDragging: false });

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const trips = groupIntoTrips(flights);

  const handleRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    hapticMedium();
    await refresh();
    await new Promise((r) => setTimeout(r, 400));
    refreshingRef.current = false;
    setRefreshing(false);
    setPullDistance(0);
  }, [refresh]);

  // Keep the ref updated with the latest handler
  handleRefreshRef.current = handleRefresh;

  // Non-passive touch event listeners for reliable pull-to-refresh on iOS
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const dragState = { startY: 0, isDragging: false };

    function handleTouchStart(e: TouchEvent) {
      if (window.scrollY > 0 || refreshingRef.current) return;
      dragState.startY = e.touches[0].clientY;
      dragState.isDragging = true;
    }

    function handleTouchMove(e: TouchEvent) {
      if (!dragState.isDragging || refreshingRef.current) return;
      const dist = (e.touches[0].clientY - dragState.startY) * 0.5;
      if (dist > 0) {
        e.preventDefault(); // Prevent page scroll while pulling
        const rubberBanded = dist * (1 - Math.min(dist / 500, 0.5));
        setPullDistance(Math.min(rubberBanded, MAX_PULL_DISTANCE));
      }
    }

    function handleTouchEnd() {
      if (!dragState.isDragging) return;
      dragState.isDragging = false;
      setPullDistance((current) => {
        if (current > PULL_THRESHOLD) {
          handleRefreshRef.current();
        }
        return 0;
      });
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []); // Only mount once — refs keep handlers fresh

  // Mouse events for desktop pull-to-refresh
  function handleMouseDown(e: React.MouseEvent) {
    if (window.scrollY > 0 || refreshingRef.current) return;
    mouseDragRef.current = { startY: e.clientY, isDragging: true };
  }

  function handleMouseMove(e: React.MouseEvent) {
    const ds = mouseDragRef.current;
    if (!ds.isDragging || refreshingRef.current) return;
    const dist = (e.clientY - ds.startY) * 0.5;
    if (dist > 0) {
      const rubberBanded = dist * (1 - Math.min(dist / 500, 0.5));
      setPullDistance(Math.min(rubberBanded, MAX_PULL_DISTANCE));
    }
  }

  function handleMouseEnd() {
    const ds = mouseDragRef.current;
    if (!ds.isDragging) return;
    ds.isDragging = false;
    if (pullDistance > PULL_THRESHOLD) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
  }

  function handleMouseLeave() {
    if (mouseDragRef.current.isDragging) {
      setPullDistance(0);
      mouseDragRef.current = { startY: 0, isDragging: false };
    }
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="max-w-lg mx-auto pt-2">
        <div className="mb-5">
          <div className="h-7 w-32 skeleton rounded-md mb-1" />
          <div className="h-4 w-24 skeleton rounded-md" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full skeleton" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 skeleton rounded-md" />
                  <div className="h-5 w-24 skeleton rounded-md" />
                  <div className="h-3 w-40 skeleton rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (flights.length === 0) {
    return (
      <div className="max-w-lg mx-auto pt-2">
        <EmptyState
          title="No flights yet"
          subtitle="Add your first flight to start tracking delays, gates, baggage reclaim, and more."
          action={{ label: 'Track Your First Flight', onClick: () => navigate('/add') }}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseEnd}
      onMouseLeave={handleMouseLeave}
      className="max-w-lg mx-auto select-none"
    >
      {/* Pull-to-refresh indicator with spring physics */}
      <AnimatePresence>
        {pullDistance > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: pullDistance, opacity: pullDistance / MAX_PULL_DISTANCE }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
            className="flex items-center justify-center overflow-hidden"
          >
            {refreshing ? (
              <div className="w-6 h-6 rounded-full border-2 border-[#007AFF] border-t-transparent animate-spin" />
            ) : (
              <motion.span
                key={pullDistance > PULL_THRESHOLD ? 'release' : 'pull'}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="text-xs text-[var(--text-secondary)]"
              >
                {pullDistance > PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
              </motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-5 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">My Flights</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {dateStr} &middot; {flights.length} flight{flights.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
      </div>

      {/* Flight groups by trip with staggered animations */}
      <AnimatePresence mode="popLayout">
        {(() => {
          let cardIndex = 0;
          return trips.map((trip) => {
            const isMulti = trip.flights.length > 1;
            return (
              <div key={trip.id} className="mb-4">
                {isMulti ? (
                  <div className="flex items-baseline gap-2 mb-2 px-1">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {trip.label}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      Trip &middot; {trip.flights.length} flights
                    </span>
                  </div>
                ) : (
                  <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 px-1">
                    {formatDate(trip.flights[0].date)}
                  </h2>
                )}
                {trip.flights.map((flight, legIndex) => {
                  const delay = cardIndex * 0.03;
                  cardIndex += 1;
                  const prevLeg = legIndex > 0 ? trip.flights[legIndex - 1] : null;
                  const connection = prevLeg ? computeConnection(prevLeg, flight) : null;
                  return (
                    <Fragment key={flight.id}>
                      {connection && (
                        <div className="flex items-center justify-center -mt-1 mb-3 px-1">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                              CONNECTION_STYLES[connection.status],
                            )}
                          >
                            <ArrowsDownUp size={13} weight="bold" />
                            {connection.label}
                          </span>
                        </div>
                      )}
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, delay }}
                      >
                        <FlightCard
                          flight={flight}
                          onClick={() => navigate(`/flight/${flight.id}`)}
                        />
                      </motion.div>
                    </Fragment>
                  );
                })}
              </div>
            );
          });
        })()}
      </AnimatePresence>
    </div>
  );
}
