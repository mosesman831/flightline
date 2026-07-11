import { AirplaneTilt } from '@phosphor-icons/react';
import { motion } from 'motion/react';

interface EmptyStateProps {
  title: string;
  subtitle: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ title, subtitle, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-col items-center justify-center py-20 px-8 text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1, ease: 'easeOut' }}
        className="w-16 h-16 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-5"
      >
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <AirplaneTilt size={28} className="text-[var(--text-tertiary)]" />
        </motion.div>
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="text-xl font-semibold text-[var(--text-primary)] mb-2"
      >
        {title}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="text-sm text-[var(--text-secondary)] max-w-xs mb-6 leading-relaxed"
      >
        {subtitle}
      </motion.p>
      {action && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          onClick={action.onClick}
          className="px-6 py-3 bg-[#007AFF] text-white rounded-full text-sm font-semibold hover:bg-[#0066D6] active:scale-95 transition-all duration-200"
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  );
}
