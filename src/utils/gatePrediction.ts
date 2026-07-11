import type { Flight } from '../types/flight';

// ─────────────────────────────────────────────────────────────────────────────
// Honest gate hinting.
//
// This NEVER invents a specific gate number. It only reports what is actually
// known: a confirmed gate, a likely terminal (with a hint that the gate is
// assigned closer to departure), or nothing at all.
//
// Pure and deterministic.
// ─────────────────────────────────────────────────────────────────────────────

export interface GatePrediction {
  confidence: 'confirmed' | 'likely' | 'unknown';
  gate: string | null;
  terminal: string | null;
  hint: string | null;
}

export function predictGate(flight: Flight): GatePrediction {
  if (flight.gate) {
    return {
      confidence: 'confirmed',
      gate: flight.gate,
      terminal: flight.terminal ?? null,
      hint: null,
    };
  }

  if (flight.terminal) {
    return {
      confidence: 'likely',
      gate: null,
      terminal: flight.terminal,
      hint: `Gate expected in Terminal ${flight.terminal} — assigned closer to departure`,
    };
  }

  return {
    confidence: 'unknown',
    gate: null,
    terminal: null,
    hint: 'Gate not yet assigned',
  };
}
