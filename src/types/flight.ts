export type FlightStatus =
  | 'scheduled'
  | 'boarding'
  | 'active'
  | 'landed'
  | 'delayed'
  | 'cancelled'
  | 'diverted';

export type DelaySeverity = 'low' | 'medium' | 'high';
export type DelayType = 'inbound' | 'weather' | 'wind' | 'traffic' | 'airline' | 'atc' | 'crew' | 'maintenance';
export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

export interface Airport {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  lat: number;
  lon: number;
}

export interface DelayReason {
  type: DelayType;
  severity: DelaySeverity;
  description: string;
  minutes: number;
}

export interface StatusEvent {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  recordedAt: string;
}

export interface InboundLeg {
  flightNumber: string;
  origin: Airport;
  destination: Airport;
  scheduledArrival: string;
  actualArrival: string | null;
  tailNumber: string;
  status: FlightStatus;
}

export interface PilotData {
  metar: string | null;
  taf: string | null;
  windSpeedKts: number | null;
  windGustKts: number | null;
  visibilityKm: number | null;
  temperature: number | null;
}

export interface WeatherForecast {
  time: string;
  tempC: number;
  precipChance: number;
  windSpeedKmh: number;
  conditionCode: string;
  conditionText: string;
  icon: string;
}

export interface Flight {
  id: string;
  airlineIata: string;
  airlineName: string;
  flightNumber: string;
  date: string;
  scheduledDeparture: string;
  scheduledArrival: string;
  predictedDeparture: string | null;
  predictedArrival: string | null;
  actualDeparture: string | null;
  actualArrival: string | null;
  origin: Airport;
  destination: Airport;
  status: FlightStatus;
  delayMinutes: number | null;
  delayChance: number;
  delayReasons: DelayReason[];
  gate: string | null;
  terminal: string | null;
  aircraft: string | null;
  tailNumber: string | null;
  // Traveller info
  seatNumber: string | null;
  checkInDesk: string | null;
  baggageReclaim: string | null;
  personalNotes: string | null;
  boardingGroup: string | null;
  boardingTime: string | null;
  cabinClass: CabinClass | null;
  // Meta
  timeline: StatusEvent[];
  inbound: InboundLeg | null;
  pilotData: PilotData | null;
  departureWeather: WeatherForecast[];
  arrivalWeather: WeatherForecast[];
  addedAt: string;
  lastUpdatedAt: string;
  isDemo: boolean;
  archived: boolean;
  starred: boolean;
}

export interface Trip {
  id: string;
  name: string;
  flights: string[];
  startDate: string;
  endDate: string;
  origin: Airport;
  destination: Airport;
}
