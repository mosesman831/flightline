import { motion } from 'motion/react';
import { getDelayColor } from '../utils/format';

interface DelayRingProps {
  chance: number;
  size?: number;
  strokeWidth?: number;
}

export default function DelayRing({ chance, size = 72, strokeWidth = 5 }: DelayRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (chance / 100) * circumference;
  const color = getDelayColor(chance);

  return (
    <div className="relative inline-flex items-center justify-center" role="img" aria-label={`${chance} percent chance of delay`}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--bg-tertiary)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Animated foreground ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          className="delay-ring"
        />
      </svg>
      <motion.span
        key={chance}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="absolute text-lg font-bold tracking-tight"
        style={{ color }}
      >
        {chance}%
      </motion.span>
    </div>
  );
}
