import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle, WifiSlash } from '@phosphor-icons/react';

interface OfflineBannerProps {
  /** Current connectivity status. When `false`, the offline banner is shown. */
  online: boolean;
  /**
   * Set by the parent immediately after reconnecting to briefly surface a
   * "Back online" confirmation. The parent controls dismissal (no internal
   * timers). Ignored while `online` is `false`.
   */
  justReconnected?: boolean;
  /**
   * When reconnecting, indicates fresh flight data was successfully fetched,
   * switching the confirmation copy to "Back online — flights updated."
   */
  recoveredFresh?: boolean;
}

/**
 * Presentational connectivity banner for the Flightline PWA.
 *
 * - Offline: a fixed amber banner pinned to the top of the viewport noting that
 *   last-saved flight data is being shown.
 * - Reconnected: a transient green confirmation banner (parent-controlled via
 *   `justReconnected`), animated in/out with `AnimatePresence`.
 * - Otherwise renders nothing.
 *
 * Accessible via `role="status"` and `aria-live="polite"`.
 */
export default function OfflineBanner({
  online,
  justReconnected = false,
  recoveredFresh = false,
}: OfflineBannerProps) {
  const showOffline = !online;
  const showReconnected = online && justReconnected;

  return (
    <AnimatePresence mode="wait">
      {showOffline ? (
        <motion.div
          key="offline"
          role="status"
          aria-live="polite"
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/95 backdrop-blur-sm text-white text-sm font-medium shadow-sm"
        >
          <WifiSlash size={18} weight="fill" className="shrink-0" />
          <span>You're offline — showing last saved flight data.</span>
        </motion.div>
      ) : showReconnected ? (
        <motion.div
          key="reconnected"
          role="status"
          aria-live="polite"
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/95 backdrop-blur-sm text-white text-sm font-medium shadow-sm"
        >
          <CheckCircle size={18} weight="fill" className="shrink-0" />
          <span>{recoveredFresh ? 'Back online — flights updated.' : 'Back online.'}</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
