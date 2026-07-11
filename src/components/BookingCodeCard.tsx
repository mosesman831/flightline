import { useState } from 'react';
import { IdentificationCard, Copy, Check, Seat } from '@phosphor-icons/react';
import { hapticSuccess } from '../utils/haptic';

interface BookingCodeCardProps {
  bookingCode?: string | null;
  seatNumber?: string | null;
  onBookingCodeChange?: (code: string) => void;
  onSeatChange?: (seat: string) => void;
}

export default function BookingCodeCard({
  bookingCode,
  seatNumber,
  onBookingCodeChange,
  onSeatChange,
}: BookingCodeCardProps) {
  const [code, setCode] = useState(bookingCode ?? '');
  const [seat, setSeat] = useState(seatNumber ?? '');
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      hapticSuccess();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCodeChange = (value: string) => {
    setCode(value.toUpperCase());
    onBookingCodeChange?.(value.toUpperCase());
  };

  const handleSeatChange = (value: string) => {
    setSeat(value.toUpperCase());
    onSeatChange?.(value.toUpperCase());
  };

  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      {/* Booking Code */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <IdentificationCard size={18} className="text-[var(--text-tertiary)]" />
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Booking Code
          </span>
        </div>
        <input
          type="text"
          placeholder="Paste PNR"
          className="search-field w-full text-center text-lg font-bold tracking-widest uppercase mb-2"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          maxLength={6}
        />
        <button
          onClick={handleCopyCode}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--border-color)] transition-colors"
        >
          {copied ? (
            <>
              <Check size={14} className="text-emerald-500" />
              <span className="text-emerald-500">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>PASTE</span>
            </>
          )}
        </button>
      </div>

      {/* Seat Number */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Seat size={18} className="text-[var(--text-tertiary)]" />
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Seat
          </span>
        </div>
        <input
          type="text"
          placeholder="e.g. 22A"
          className="search-field w-full text-center text-lg font-bold tracking-wider uppercase"
          value={seat}
          onChange={(e) => handleSeatChange(e.target.value)}
          maxLength={5}
        />
        <div className="mt-2 text-center text-[10px] text-[var(--text-tertiary)]">
          Window · Aisle · Middle
        </div>
      </div>
    </div>
  );
}
