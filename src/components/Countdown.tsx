import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getCountdownMs, getCountdown } from '../utils/format';

interface CountdownProps {
  targetTime: string;
  label?: string;
  onZero?: () => void;
}

export default function Countdown({ targetTime, label, onZero }: CountdownProps) {
  const [segments, setSegments] = useState<{ text: string; key: number }[]>([]);
  const [past, setPast] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null as any);
  const keyRef = useRef(0);

  useEffect(() => {
    function tick() {
      const ms = getCountdownMs(targetTime);
      if (ms <= 0) {
        setPast(true);
        setSegments([]);
        if (intervalRef.current) clearInterval(intervalRef.current);
        onZero?.();
        return;
      }
      const text = getCountdown(targetTime);
      const chars = text.split('');
      // Build segments from groups of same-type characters (digits vs non-digits)
      const newSegments: { text: string; key: number }[] = [];
      let i = 0;
      while (i < chars.length) {
        const current = chars[i];
        const isDigit = /\d/.test(current);
        let group = current;
        i++;
        while (i < chars.length && /\d/.test(chars[i]) === isDigit) {
          group += chars[i];
          i++;
        }
        newSegments.push({ text: group, key: keyRef.current++ });
      }
      setSegments(newSegments);
    }
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [targetTime]);

  if (past) return null;

  return (
    <div className="flex flex-col items-center">
      {label && <span className="text-xs text-[var(--text-tertiary)] mb-0.5">{label}</span>}
      <div className="text-3xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums flex">
        <AnimatePresence mode="popLayout">
          {segments.map((seg) => (
            <motion.span
              key={seg.key}
              layout
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="countdown-digit"
            >
              {seg.text}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
