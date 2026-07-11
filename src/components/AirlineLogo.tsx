import { useState } from 'react';
import { getAirline } from '../data/airlines';
import { cn } from '../utils/format';

interface AirlineLogoProps {
  iata: string;
  name: string;
  size?: number;
  className?: string;
}

const LOGO_CDN = 'https://www.gstatic.com/flights/airline_logos/70px';

export default function AirlineLogo({ iata, name, size = 32, className }: AirlineLogoProps) {
  const airline = getAirline(iata);
  const color = airline.color;
  const initial = name.charAt(0);
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold text-white shrink-0 overflow-hidden',
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.4,
      }}
      title={name}
      role="img"
      aria-label={`${name} logo`}
    >
      {!imgError ? (
        <img
          src={`${LOGO_CDN}/${iata}.png`}
          alt={name}
          width={size}
          height={size}
          loading="lazy"
          className="w-full h-full object-contain"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="select-none">{initial}</span>
      )}
    </div>
  );
}
