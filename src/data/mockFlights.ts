import type { Flight, WeatherForecast } from '../types/flight';
import { getAirport } from './airports';

function addMinutes(date: Date, mins = 0): string {
  return new Date(date.getTime() + mins * 60000).toISOString();
}

function h(date: Date, hours: number, mins = 0): Date {
  const d = new Date(date);
  d.setHours(hours, mins, 0, 0);
  return d;
}

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

export function createMockFlights(): Flight[] {
  const now = new Date();
  
  return [
    {
      id: 'demo-1',
      airlineIata: 'BA',
      airlineName: 'British Airways',
      flightNumber: 'BA178',
      date: tomorrow.toISOString().slice(0, 10),
      scheduledDeparture: addMinutes(h(tomorrow, 10, 30), 0),
      scheduledArrival: addMinutes(h(tomorrow, 14, 15), 0),
      predictedDeparture: addMinutes(h(tomorrow, 10, 45), 0),
      predictedArrival: addMinutes(h(tomorrow, 14, 30), 0),
      actualDeparture: null,
      actualArrival: null,
      origin: getAirport('LHR'),
      destination: getAirport('JFK'),
      status: 'scheduled',
      delayMinutes: 15,
      delayChance: 38,
      delayReasons: [
        { type: 'weather', severity: 'low', description: 'Low visibility forecast at JFK', minutes: 10 },
        { type: 'inbound', severity: 'medium', description: 'Inbound aircraft arriving 15 min late from BOS', minutes: 15 },
      ],
      gate: 'B27',
      terminal: '5',
      aircraft: 'A380-800',
      tailNumber: 'G-XLEA',
      seatNumber: '22A',
      checkInDesk: 'Zone C, Desks 12-18',
      baggageReclaim: 'Carousel 4',
      personalNotes: 'Booked window seat, prepaid meal',
      boardingGroup: 'Group 2',
      boardingTime: addMinutes(h(tomorrow, 9, 50), 0),
      cabinClass: 'economy',
      timeline: [
        { id: 't1', field: 'Gate', oldValue: '-', newValue: 'B27', recordedAt: addMinutes(h(tomorrow, 8, 0), 0) },
        { id: 't2', field: 'Status', oldValue: 'Scheduled', newValue: 'On Time', recordedAt: addMinutes(h(tomorrow, 8, 30), 0) },
        { id: 't3', field: 'Predicted Delay', oldValue: '0', newValue: '15 min', recordedAt: addMinutes(h(tomorrow, 9, 15), 0) },
      ],
      inbound: {
        flightNumber: 'BA213',
        origin: getAirport('BOS'),
        destination: getAirport('LHR'),
        scheduledArrival: addMinutes(h(tomorrow, 9, 45), 0),
        actualArrival: addMinutes(h(tomorrow, 10, 0), 0),
        tailNumber: 'G-XLEA',
        status: 'active',
      },
      pilotData: {
        metar: 'EGLL 081050Z 25008KT 9999 FEW025 SCT045 15/09 Q1020 NOSIG',
        taf: 'EGLL 080500Z 0806/0912 24010KT 9999 SCT030 PROB30 TEMPO 0812/0819 7000 SHRA',
        windSpeedKts: 8,
        windGustKts: 16,
        visibilityKm: 10,
        temperature: 15,
      },
      departureWeather: generateForecast(getAirport('LHR'), 10, 30, 14),
      arrivalWeather: generateForecast(getAirport('JFK'), 14, 15, 18),
      addedAt: now.toISOString(),
      lastUpdatedAt: now.toISOString(),
      isDemo: true,
      archived: false,
      starred: true,
    },
    {
      id: 'demo-2',
      airlineIata: 'EK',
      airlineName: 'Emirates',
      flightNumber: 'EK501',
      date: tomorrow.toISOString().slice(0, 10),
      scheduledDeparture: addMinutes(h(tomorrow, 21, 0)),
      scheduledArrival: addMinutes(h(addDaysObj(tomorrow, 1), 6, 15)),
      predictedDeparture: addMinutes(h(tomorrow, 21, 30)),
      predictedArrival: addMinutes(h(addDaysObj(tomorrow, 1), 6, 45)),
      actualDeparture: null,
      actualArrival: null,
      origin: getAirport('DXB'),
      destination: getAirport('LHR'),
      status: 'scheduled',
      delayMinutes: 30,
      delayChance: 65,
      delayReasons: [
        { type: 'airline', severity: 'high', description: 'Crew rest period extension due to previous delay', minutes: 30 },
        { type: 'weather', severity: 'low', description: 'Crosswinds forecast at LHR arrival', minutes: 5 },
      ],
      gate: 'A1',
      terminal: '3',
      aircraft: 'B777-300ER',
      tailNumber: 'A6-EGV',
      seatNumber: '14K',
      checkInDesk: 'First/Business Row, Desk 2',
      baggageReclaim: 'Carousel 3',
      personalNotes: 'Business class, lounge access with shower',
      boardingGroup: 'Priority',
      boardingTime: addMinutes(h(tomorrow, 20, 15), 0),
      cabinClass: 'business',
      timeline: [
        { id: 't4', field: 'Gate', oldValue: '-', newValue: 'A1', recordedAt: addMinutes(h(tomorrow, 18, 0), 0) },
      ],
      inbound: null,
      pilotData: null,
      departureWeather: generateForecast(getAirport('DXB'), 21, 0, 23),
      arrivalWeather: generateForecast(getAirport('LHR'), 6, 15, 8),
      addedAt: now.toISOString(),
      lastUpdatedAt: now.toISOString(),
      isDemo: true,
      archived: false,
      starred: false,
    },
    {
      id: 'demo-3',
      airlineIata: 'WN',
      airlineName: 'Southwest Airlines',
      flightNumber: 'WN1427',
      date: today.toISOString().slice(0, 10),
      scheduledDeparture: addMinutes(h(today, 7, 10), 0),
      scheduledArrival: addMinutes(h(today, 9, 55), 0),
      predictedDeparture: addMinutes(h(today, 7, 15), 0),
      predictedArrival: addMinutes(h(today, 10, 5), 0),
      actualDeparture: addMinutes(h(today, 7, 18), 0),
      actualArrival: addMinutes(h(today, 10, 2), 0),
      origin: getAirport('DEN'),
      destination: getAirport('AUS'),
      status: 'landed',
      delayMinutes: 8,
      delayChance: 12,
      delayReasons: [
        { type: 'traffic', severity: 'low', description: 'DEN departure flow', minutes: 5 },
      ],
      gate: 'C38',
      terminal: '1',
      aircraft: 'B737-800',
      tailNumber: 'N8540Q',
      seatNumber: '12F',
      checkInDesk: 'Self check-in Kiosk C',
      baggageReclaim: 'Carousel 2',
      personalNotes: 'Nonstop, nice views over Kansas',
      boardingGroup: 'B',
      boardingTime: addMinutes(h(today, 6, 40), 0),
      cabinClass: 'economy',
      timeline: [
        { id: 't5', field: 'Status', oldValue: 'Scheduled', newValue: 'On Time', recordedAt: addMinutes(h(today, 6, 0), 0) },
        { id: 't6', field: 'Gate', oldValue: 'C34', newValue: 'C38', recordedAt: addMinutes(h(today, 6, 30), 0) },
        { id: 't7', field: 'Status', oldValue: 'On Time', newValue: 'Boarding', recordedAt: addMinutes(h(today, 6, 35), 0) },
        { id: 't8', field: 'Status', oldValue: 'Boarding', newValue: 'Departed', recordedAt: addMinutes(h(today, 7, 18), 0) },
        { id: 't9', field: 'Status', oldValue: 'Departed', newValue: 'Landed', recordedAt: addMinutes(h(today, 10, 2), 0) },
        { id: 't10', field: 'Baggage', oldValue: '-', newValue: 'Carousel 2', recordedAt: addMinutes(h(today, 10, 5), 0) },
      ],
      inbound: null,
      pilotData: {
        metar: 'KDEN 081053Z 18006KT 10SM FEW110 16/08 A3012 RMK AO2 SLP151',
        taf: null,
        windSpeedKts: 6,
        windGustKts: 12,
        visibilityKm: 16,
        temperature: 16,
      },
      departureWeather: generateForecast(getAirport('DEN'), 7, 10, 10),
      arrivalWeather: generateForecast(getAirport('AUS'), 9, 55, 12),
      addedAt: now.toISOString(),
      lastUpdatedAt: now.toISOString(),
      isDemo: true,
      archived: false,
      starred: false,
    },
    {
      id: 'demo-4',
      airlineIata: 'DL',
      airlineName: 'Delta Air Lines',
      flightNumber: 'DL404',
      date: today.toISOString().slice(0, 10),
      scheduledDeparture: addMinutes(h(today, 16, 45), 0),
      scheduledArrival: addMinutes(h(today, 20, 30), 0),
      predictedDeparture: addMinutes(h(today, 17, 30), 0),
      predictedArrival: addMinutes(h(today, 21, 15), 0),
      actualDeparture: null,
      actualArrival: null,
      origin: getAirport('JFK'),
      destination: getAirport('SFO'),
      status: 'delayed',
      delayMinutes: 45,
      delayChance: 82,
      delayReasons: [
        { type: 'weather', severity: 'high', description: 'Thunderstorms along route', minutes: 30 },
        { type: 'inbound', severity: 'medium', description: 'Inbound aircraft delayed from ATL', minutes: 20 },
        { type: 'atc', severity: 'low', description: 'ATC ground stop due to weather', minutes: 15 },
      ],
      gate: 'B4',
      terminal: '4',
      aircraft: 'A321neo',
      tailNumber: 'N501DN',
      seatNumber: '8A',
      checkInDesk: 'Delta Check-in, Row 3',
      baggageReclaim: null,
      personalNotes: 'First class upgrade waitlisted',
      boardingGroup: 'Sky Priority',
      boardingTime: addMinutes(h(today, 16, 15), 0),
      cabinClass: 'premium_economy',
      timeline: [
        { id: 't11', field: 'Status', oldValue: 'Scheduled', newValue: 'Delayed 45 min', recordedAt: addMinutes(h(today, 14, 30), 0) },
        { id: 't12', field: 'Gate', oldValue: 'B2', newValue: 'B4', recordedAt: addMinutes(h(today, 15, 0), 0) },
        { id: 't13', field: 'Delay Reason', oldValue: '-', newValue: 'Thunderstorms along route', recordedAt: addMinutes(h(today, 14, 30), 0) },
      ],
      inbound: {
        flightNumber: 'DL2103',
        origin: getAirport('ATL'),
        destination: getAirport('JFK'),
        scheduledArrival: addMinutes(h(today, 15, 30), 0),
        actualArrival: addMinutes(h(today, 16, 0), 0),
        tailNumber: 'N501DN',
        status: 'active',
      },
      pilotData: {
        metar: 'KJFK 081451Z 22012KT 10SM -TSRA BKN035CB OVC060 22/18 A2985 RMK AO2 LTG DSNT SW',
        taf: 'KJFK 081139Z 0812/0918 20010KT P6SM SCT050',
        windSpeedKts: 12,
        windGustKts: 24,
        visibilityKm: 8,
        temperature: 22,
      },
      departureWeather: generateForecast(getAirport('JFK'), 16, 45, 21),
      arrivalWeather: generateForecast(getAirport('SFO'), 20, 30, 22),
      addedAt: now.toISOString(),
      lastUpdatedAt: now.toISOString(),
      isDemo: true,
      archived: false,
      starred: true,
    },
    {
      id: 'demo-5',
      airlineIata: 'SQ',
      airlineName: 'Singapore Airlines',
      flightNumber: 'SQ25',
      date: addDays(today, 3).slice(0, 10),
      scheduledDeparture: addMinutes(h(addDaysObj(today, 3), 0, 30), 0),
      scheduledArrival: addMinutes(h(addDaysObj(today, 4), 16, 10), 0),
      predictedDeparture: null,
      predictedArrival: null,
      actualDeparture: null,
      actualArrival: null,
      origin: getAirport('SIN'),
      destination: getAirport('FRA'),
      status: 'scheduled',
      delayMinutes: null,
      delayChance: 22,
      delayReasons: [],
      gate: null,
      terminal: '3',
      aircraft: 'A350-900',
      tailNumber: null,
      seatNumber: '31H',
      checkInDesk: null,
      baggageReclaim: null,
      personalNotes: 'Long haul! Bring neck pillow',
      boardingGroup: null,
      boardingTime: addMinutes(h(addDaysObj(today, 3), 23, 30), 0),
      cabinClass: 'economy',
      timeline: [],
      inbound: null,
      pilotData: null,
      departureWeather: generateForecast(getAirport('SIN'), 0, 30, 6),
      arrivalWeather: generateForecast(getAirport('FRA'), 16, 10, 20),
      addedAt: now.toISOString(),
      lastUpdatedAt: now.toISOString(),
      isDemo: true,
      archived: false,
      starred: false,
    },
  ];
}

function addDays(date: Date, n: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function addDaysObj(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function generateForecast(
  _airport: ReturnType<typeof getAirport>,
  startHour: number,
  startMinute: number,
  untilHour: number
): WeatherForecast[] {
  const forecasts: WeatherForecast[] = [];
  const base = new Date(today);
  base.setHours(startHour, startMinute, 0, 0);
  const end = new Date(today);
  end.setHours(untilHour, 0, 0, 0);

  let current = new Date(base);
  const conditions = [
    { code: 'sunny', text: 'Clear', icon: 'sun' },
    { code: 'partly_cloudy', text: 'Partly Cloudy', icon: 'partly-cloudy' },
    { code: 'cloudy', text: 'Cloudy', icon: 'cloudy' },
    { code: 'rain', text: 'Light Rain', icon: 'rain' },
  ];

  while (current <= end) {
    const cond = conditions[current.getHours() % conditions.length];
    forecasts.push({
      time: current.toISOString(),
      tempC: 15 + Math.round(Math.sin((current.getHours() - 6) * 0.2) * 8),
      precipChance: cond.code === 'rain' ? 60 : cond.code === 'cloudy' ? 20 : 5,
      windSpeedKmh: 10 + Math.round(Math.random() * 20),
      conditionCode: cond.code,
      conditionText: cond.text,
      icon: cond.icon,
    });
    current = new Date(current.getTime() + 3600000);
  }
  return forecasts;
}
