import React from 'react';
import type { Flight } from '../types/flight';
import { getAirline } from '../data/airlines';
import {
  formatTime,
  getStatusText,
  getCountdown,
  getDelayColor,
} from '../utils/format';

/**
 * Literal palette for the share card. We intentionally avoid CSS custom
 * properties (e.g. `var(--text-primary)`) here: `html-to-image` snapshots the
 * computed DOM, and CSS vars can resolve to dark-mode values or be dropped
 * during capture. Hard-coding hex keeps the exported PNG deterministic and
 * always renders as a light card, regardless of the user's theme.
 */
const COLORS = {
  bg: '#FAFAF8',
  card: '#FFFFFF',
  border: '#ECEBE6',
  textPrimary: '#1C1C1E',
  textSecondary: '#6E6E73',
  textTertiary: '#A1A1A6',
  accent: '#007AFF',
} as const;

/**
 * A deterministic, capture-optimised flight status card (SPEC §12.4e).
 *
 * The forwarded ref is placed on the root capturable `<div>` so a parent can
 * render this off-screen and feed it straight into `toPng`. Every colour is a
 * literal hex value (never a CSS var) and the airline mark is a local monogram
 * rather than a remote logo, so the PNG capture is fully deterministic and free
 * of CORS/transparency issues.
 */
const ShareCard = React.forwardRef<HTMLDivElement, { flight: Flight }>(
  ({ flight }, ref) => {
    const airline = getAirline(flight.airlineIata);
    const monogramColor = airline.color || COLORS.accent;
    const monogram = (flight.airlineIata || flight.airlineName || '?')
      .charAt(0)
      .toUpperCase();

    const statusLabel = getStatusText(flight.status);
    const countdown = getCountdown(flight.scheduledDeparture);
    const delayColor = getDelayColor(flight.delayChance);

    const predictedDep = flight.predictedDeparture ?? flight.scheduledDeparture;
    const predictedArr = flight.predictedArrival ?? flight.scheduledArrival;

    return (
      <div
        ref={ref}
        style={{
          width: 400,
          boxSizing: 'border-box',
          background: COLORS.bg,
          color: COLORS.textPrimary,
          padding: 24,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        {/* Header: airline monogram + name + flight number */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: monogramColor,
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 700,
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            {monogram}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: COLORS.textPrimary,
              }}
            >
              {flight.airlineIata} {flight.flightNumber}
            </div>
            <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
              {flight.airlineName}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.accent,
              whiteSpace: 'nowrap',
            }}
          >
            {statusLabel}
          </div>
        </div>

        {/* Route: ORIGIN → DEST with city names */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 24,
          }}
        >
          <div style={{ textAlign: 'left', minWidth: 0 }}>
            <div
              style={{
                fontSize: 34,
                fontWeight: 700,
                letterSpacing: -0.5,
                color: COLORS.textPrimary,
                lineHeight: 1,
              }}
            >
              {flight.origin.iata}
            </div>
            <div
              style={{
                fontSize: 12,
                color: COLORS.textSecondary,
                marginTop: 4,
              }}
            >
              {flight.origin.city}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 12px',
              color: COLORS.textTertiary,
            }}
          >
            <div
              style={{
                height: 2,
                flex: 1,
                background: COLORS.border,
                borderRadius: 1,
              }}
            />
            <span style={{ margin: '0 8px', fontSize: 16 }}>✈</span>
            <div
              style={{
                height: 2,
                flex: 1,
                background: COLORS.border,
                borderRadius: 1,
              }}
            />
          </div>

          <div style={{ textAlign: 'right', minWidth: 0 }}>
            <div
              style={{
                fontSize: 34,
                fontWeight: 700,
                letterSpacing: -0.5,
                color: COLORS.textPrimary,
                lineHeight: 1,
              }}
            >
              {flight.destination.iata}
            </div>
            <div
              style={{
                fontSize: 12,
                color: COLORS.textSecondary,
                marginTop: 4,
              }}
            >
              {flight.destination.city}
            </div>
          </div>
        </div>

        {/* Countdown / time-to-departure */}
        <div
          style={{
            marginTop: 24,
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: COLORS.textTertiary,
              }}
            >
              {countdown ? 'Departs in' : 'Scheduled'}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: COLORS.textPrimary,
                marginTop: 2,
              }}
            >
              {countdown ||
                formatTime(flight.scheduledDeparture, flight.origin.timezone)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: COLORS.textTertiary,
              }}
            >
              Delay risk
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: delayColor,
                marginTop: 2,
              }}
            >
              {Math.round(flight.delayChance)}%
            </div>
          </div>
        </div>

        {/* Predicted departure & arrival + gate */}
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            gap: 12,
          }}
        >
          <PredictedCell
            label="Predicted dep"
            value={formatTime(predictedDep, flight.origin.timezone)}
          />
          <PredictedCell
            label="Predicted arr"
            value={formatTime(predictedArr, flight.destination.timezone)}
          />
          <PredictedCell label="Gate" value={flight.gate ?? 'TBD'} />
        </div>

        {/* Wordmark footer */}
        <div
          style={{
            marginTop: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: COLORS.accent,
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.5,
              color: COLORS.textTertiary,
            }}
          >
            Flightline
          </span>
        </div>
      </div>
    );
  },
);

ShareCard.displayName = 'ShareCard';

/** A small labelled value cell used for the predicted times / gate row. */
function PredictedCell({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: '10px 12px',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: COLORS.textTertiary,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: COLORS.textPrimary,
          marginTop: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default ShareCard;
