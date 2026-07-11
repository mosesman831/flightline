import { useEffect, useRef, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { addDemoFlightsIfEmpty, getAllFlights, subscribeFlights } from './store/flightStore';
import { useFlightPolling } from './utils/useFlightPolling';
import { refreshAllDue } from './utils/refresh';
import { useOnlineStatus } from './utils/useOnlineStatus';
import { rebuildNotificationTimers, clearAllTimers } from './utils/notificationScheduler';
import { loadPrefs } from './utils/notificationPrefs';
import type { Flight } from './types/flight';
import OfflineBanner from './components/OfflineBanner';
import Layout from './components/Layout';
import FlightsList from './routes/FlightsList';
import FlightDetail from './routes/FlightDetail';
import AddFlight from './routes/AddFlight';
import Settings from './routes/Settings';
import Archive from './routes/Archive';

export default function App() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('flightline-theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    // No stored preference — check system preference
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return true;
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Listen for system theme changes when using 'system' mode
  useEffect(() => {
    const mode = localStorage.getItem('flightline-theme-mode');
    if (mode !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setDarkMode(e.matches);
      localStorage.setItem('flightline-theme', e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    loadFlights();
    return subscribeFlights(loadFlights);
  }, []);

  async function loadFlights() {
    await addDemoFlightsIfEmpty();
    const all = await getAllFlights();
    setFlights(all);
    setLoading(false);
  }

  function refresh() {
    loadFlights();
  }

  const activeFlights = flights.filter((f) => !f.archived);
  const archivedFlights = flights.filter((f) => f.archived);

  // Visibility-aware live polling (per-flight cadence handled internally)
  useFlightPolling(activeFlights);

  // Rebuild smart-notification timers whenever flights or preferences change.
  useEffect(() => {
    rebuildNotificationTimers({ flights: activeFlights, prefs: loadPrefs() });
    const onPrefs = () => rebuildNotificationTimers({ flights: activeFlights, prefs: loadPrefs() });
    window.addEventListener('flightline-prefs-changed', onPrefs);
    return () => window.removeEventListener('flightline-prefs-changed', onPrefs);
  }, [activeFlights]);

  useEffect(() => () => clearAllTimers(), []);

  // Offline / reconnect handling.
  const online = useOnlineStatus();
  const [justReconnected, setJustReconnected] = useState(false);
  const [recoveredFresh, setRecoveredFresh] = useState(false);
  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) {
      // Just came back online: run one bounded refresh and surface the outcome.
      setJustReconnected(true);
      setRecoveredFresh(false);
      void refreshAllDue({ force: true }).then(() => {
        setRecoveredFresh(true);
        loadFlights();
      });
      const t = setTimeout(() => setJustReconnected(false), 4000);
      wasOnline.current = online;
      return () => clearTimeout(t);
    }
    wasOnline.current = online;
  }, [online]);

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger shortcuts when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key.toLowerCase()) {
        case 'r':
          e.preventDefault();
          // Force a real network refresh, then reload from the store.
          void refreshAllDue({ force: true }).then(refresh);
          break;
        case 'n':
          e.preventDefault();
          window.location.hash = '#/add';
          break;
        case 'escape':
          e.preventDefault();
          // Navigate back using history
          if (window.location.hash !== '#/') {
            window.history.back();
          }
          break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <OfflineBanner online={online} justReconnected={justReconnected} recoveredFresh={recoveredFresh} />
      <Routes>
        <Route
          path="/"
          element={
            <Layout darkMode={darkMode} setDarkMode={setDarkMode}>
              <FlightsList
                flights={activeFlights}
                loading={loading}
                refresh={refresh}
              />
            </Layout>
          }
        />
        <Route
          path="/flight/:id"
          element={
            <Layout darkMode={darkMode} setDarkMode={setDarkMode}>
              <FlightDetail flights={flights} />
            </Layout>
          }
        />
        <Route
          path="/add"
          element={
            <Layout darkMode={darkMode} setDarkMode={setDarkMode}>
              <AddFlight onAdded={refresh} />
            </Layout>
          }
        />
        <Route
          path="/add/:airline/:flightNumber/:date"
          element={
            <Layout darkMode={darkMode} setDarkMode={setDarkMode}>
              <AddFlight onAdded={refresh} />
            </Layout>
          }
        />
        <Route
          path="/settings"
          element={
            <Layout darkMode={darkMode} setDarkMode={setDarkMode}>
              <Settings
                darkMode={darkMode}
                setDarkMode={setDarkMode}
                flights={flights}
                refresh={refresh}
              />
            </Layout>
          }
        />
        <Route
          path="/archive"
          element={
            <Layout darkMode={darkMode} setDarkMode={setDarkMode}>
              <Archive
                flights={archivedFlights}
                refresh={refresh}
              />
            </Layout>
          }
        />
      </Routes>
    </div>
  );
}
