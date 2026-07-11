import { useNavigate, useLocation } from 'react-router-dom';
import { AirplaneTilt, Plus, Gear, Archive } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
}

const TABS = [
  { path: '/', icon: AirplaneTilt, label: 'Flights' },
  { path: '/add', icon: Plus, label: 'Add' },
  { path: '/archive', icon: Archive, label: 'Archive' },
  { path: '/settings', icon: Gear, label: 'Settings' },
];

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="h-dvh flex flex-col">
      {/* Ambient refractive background behind all glass */}
      <div className="ambient-bg" aria-hidden="true" />

      {/* Scrollable content area with springy page transitions */}
      <main
        className="flex-1 overflow-y-auto px-4 pt-2 safe-top scroll-smooth overscroll-contain"
        style={{ paddingBottom: 'calc(96px + var(--safe-bottom))' }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating liquid-glass tab bar */}
      <nav
        className="fixed left-1/2 -translate-x-1/2 z-50"
        style={{ bottom: 'calc(12px + var(--safe-bottom))' }}
        aria-label="Primary"
      >
        <div
          className="flex items-center gap-1 px-2 py-2 rounded-[26px] glass glass-strong"
          style={{ boxShadow: 'var(--glass-shadow-hover), inset 0 1px 0 var(--glass-highlight)' }}
        >
          {TABS.map((tab) => {
            const active = isActive(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="relative flex flex-col items-center justify-center gap-0.5 px-4 py-1.5 rounded-[20px] press"
                aria-label={tab.label}
                role="tab"
                aria-current={active ? 'page' : undefined}
              >
                {active && (
                  <motion.span
                    layoutId="tab-active-pill"
                    className="absolute inset-0 rounded-[20px]"
                    style={{
                      background: 'rgba(0,122,255,0.14)',
                      border: '1px solid rgba(0,122,255,0.28)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
                    }}
                    transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }}
                  />
                )}
                <tab.icon
                  size={23}
                  weight={active ? 'fill' : 'regular'}
                  className={`relative z-10 transition-colors duration-200 ${
                    active ? 'text-[#007AFF]' : 'text-[var(--text-tertiary)]'
                  }`}
                />
                <span
                  className={`relative z-10 text-[10px] font-semibold transition-colors duration-200 ${
                    active ? 'text-[#007AFF]' : 'text-[var(--text-tertiary)]'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
