import type { Flight } from '../types/flight';

/**
 * Generate an .ics calendar file for a list of flights.
 * Each flight becomes a VEVENT with departure/arrival times.
 */
export function generateIcs(flights: Flight[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Flightline//Flight Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const flight of flights) {
    const uid = `flight-${flight.id}@flightline.app`;
    const depDate = new Date(flight.scheduledDeparture);
    const arrDate = new Date(flight.scheduledArrival);
    const now = new Date();

    const fmt = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

    const summary = `${flight.airlineIata} ${flight.flightNumber}: ${flight.origin.iata} → ${flight.destination.iata}`;
    const description = `${flight.airlineName} ${flight.flightNumber} | ${flight.origin.city} (${flight.origin.iata}) → ${flight.destination.city} (${flight.destination.iata})${flight.gate ? ` | Gate ${flight.gate}` : ''}${flight.terminal ? ` | Terminal ${flight.terminal}` : ''}${flight.seatNumber ? ` | Seat ${flight.seatNumber}` : ''}`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${fmt(now)}`);
    lines.push(`DTSTART:${fmt(depDate)}`);
    lines.push(`DTEND:${fmt(arrDate)}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push(`LOCATION:${flight.origin.iata} - ${flight.origin.name}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcs(flights: Flight[], filename = 'flightline-flights.ics'): void {
  const content = generateIcs(flights);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
