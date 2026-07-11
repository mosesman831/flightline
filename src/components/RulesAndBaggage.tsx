import { Suitcase, CaretRight } from '@phosphor-icons/react';

interface RulesAndBaggageProps {
  airline?: string;
  cabinClass?: string;
}

export default function RulesAndBaggage({ airline, cabinClass }: RulesAndBaggageProps) {
  return (
    <button className="w-full card p-4 mb-4 flex items-center gap-3 active:scale-[0.98] transition-transform text-left">
      <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0">
        <Suitcase size={20} className="text-[var(--text-secondary)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[var(--text-primary)]">
          Rules and Baggage
        </div>
        <div className="text-xs text-[var(--text-tertiary)]">
          {airline ?? 'Airline'} · {cabinClass ?? 'Economy'} cabin policies
        </div>
      </div>
      <CaretRight size={16} className="text-[var(--text-tertiary)]" />
    </button>
  );
}
