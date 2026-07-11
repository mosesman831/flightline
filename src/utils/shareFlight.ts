import { toPng } from 'html-to-image';
import type { Flight } from '../types/flight';

/** Options passed to every `toPng` call so captures stay deterministic. */
const CAPTURE_OPTIONS = {
  pixelRatio: 2,
  backgroundColor: '#FAFAF8',
  cacheBust: true,
} as const;

/**
 * Render a capturable node to a PNG data URL.
 *
 * Used by {@link shareFlightCard} and exposed directly for previews / tests.
 *
 * @param node - The DOM node to snapshot (typically the `ShareCard` root).
 * @returns A `data:image/png;base64,...` URL.
 */
export async function flightCardToPng(node: HTMLElement): Promise<string> {
  return toPng(node, CAPTURE_OPTIONS);
}

/** Derive a `YYYY-MM-DD` date string from an ISO timestamp. */
function toDateString(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Build the hash deep link to the ADD route for a flight.
 *
 * This intentionally targets the shareable add route (airline / number / date)
 * rather than the local IndexedDB id, so recipients can add the same flight to
 * their own copy of the app.
 */
function buildAddLink(flight: Flight): string {
  const date = flight.date || toDateString(flight.scheduledDeparture);
  return `${location.origin}/#/add/${flight.airlineIata}/${flight.flightNumber}/${date}`;
}

/** Outcome of the share pipeline. */
export type ShareResult = 'shared-file' | 'shared-text' | 'downloaded' | 'cancelled';

/**
 * Share a rendered flight card following the platform-aware pipeline
 * (SPEC §12.4e): file share → text share → download fallback.
 *
 * 1. Snapshot `node` to a PNG.
 * 2. If the platform can share files, share the image + text and return
 *    `'shared-file'`.
 * 3. Otherwise, if `navigator.share` exists, share text/URL only and return
 *    `'shared-text'`.
 * 4. Otherwise, download the PNG via a temporary anchor and return
 *    `'downloaded'`.
 * 5. If the user cancels a share (`AbortError`) return `'cancelled'`; any other
 *    share failure falls through to a download and returns `'downloaded'`.
 *
 * @param node - The DOM node to capture (the `ShareCard` root).
 * @param flight - The flight backing the card (used for filename + share text).
 */
export async function shareFlightCard(
  node: HTMLElement,
  flight: Flight,
): Promise<ShareResult> {
  const dataUrl = await flightCardToPng(node);
  const blob = await (await fetch(dataUrl)).blob();

  const fileName = `flightline-${flight.airlineIata}${flight.flightNumber}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });

  const title = `${flight.airlineIata} ${flight.flightNumber} — Flightline`;
  const link = buildAddLink(flight);
  const text = `${flight.airlineName} ${flight.airlineIata}${flight.flightNumber} — ${flight.origin.iata} → ${flight.destination.iata}\n${link}`;

  const canShareFiles =
    typeof navigator !== 'undefined' &&
    !!navigator.canShare?.({ files: [file] });

  if (canShareFiles) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared-file';
    } catch (err) {
      if (isAbort(err)) return 'cancelled';
      return downloadPng(dataUrl, fileName);
    }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text });
      return 'shared-text';
    } catch (err) {
      if (isAbort(err)) return 'cancelled';
      return downloadPng(dataUrl, fileName);
    }
  }

  return downloadPng(dataUrl, fileName);
}

/** Whether an error represents a user-cancelled share. */
function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

/** Download a data URL as a file via a temporary anchor element. */
function downloadPng(dataUrl: string, fileName: string): 'downloaded' {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return 'downloaded';
}
