import { useNavigate, useLocation } from 'react-router-dom';
import { AirplaneTilt, Plus, Gear, Archive } from '@phosphor-icons/react';
import { cn } from '../utils/format';

interface LayoutProps {
  children: React.ReactNode;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { path: '/', icon: AirplaneTilt, label: 'Flights' },
    { path: '/add', icon: Plus, label: 'Add' },
    { path: '/archive', icon: Archive, label: 'Archive' },
    { path: '/settings', icon: Gear, label: 'Settings' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="h-dvh flex flex-col bg-[var(--bg-primary)]">
      {/* Scrollable content area */}
      <main className="flex-1 overflow-y-auto px-4 pt-2 safe-top scroll-smooth overscroll-contain"
        style={{ paddingBottom: 'calc(72px + var(--safe-bottom))' }}
      >
        {children}
      </main>

      {/* Fixed liquid glass tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom"
        style={{
          background: 'rgba(var(--bg-secondary-rgb, 255,255,255), 0.75)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderTop: '0.5px solid rgba(var(--border-color-rgb, 229,229,224), 0.5)',
        }}
      >
        <div className="flex items-center justify-around py-1.5 max-w-lg mx-auto">
          {tabs.map((tab) => (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-xl transition-all duration-200',
                isActive(tab.path)
                  ? 'text-[#007AFF]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              )}
              aria-label={tab.label}
              role="tab"
              aria-current={isActive(tab.path) ? 'page' : undefined}
            >
              <tab.icon
                size={24}
                weight={isActive(tab.path) ? 'fill' : 'regular'}
                className="transition-all duration-200"
                style={isActive(tab.path) ? { filter: 'drop-shadow(0 0 6px rgba(0,122,255,0.3))' } : undefined}
              />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
