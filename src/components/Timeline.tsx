import { motion } from "motion/react";
import { type Flight } from "../data/flights";
import { format, differenceInMinutes } from "date-fns";

interface TimelineProps {
  flight: Flight;
  now: Date;
}

export function Timeline({ flight, now }: TimelineProps) {
  const events = [
    {
      time: flight.departure.scheduled,
      label: "Scheduled departure",
      sub: `${flight.departure.airport.code} · Gate ${flight.departure.gate}`,
      done: now > flight.departure.scheduled,
    },
    {
      time: flight.departure.estimated ?? new Date(flight.departure.scheduled.getTime() + 5 * 60000),
      label: "Estimated boarding",
      sub: `Terminal ${flight.departure.terminal}`,
      done: now > (flight.departure.estimated ?? flight.departure.scheduled),
    },
    {
      time: flight.arrival.estimated ?? flight.arrival.scheduled,
      label: "Estimated arrival",
      sub: `${flight.arrival.airport.city} (${flight.arrival.airport.code})`,
      done: false,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1], delay: 0.1 }}
      className="rounded-ios bg-white dark:bg-ios-darkcard shadow-soft p-5"
    >
      <div className="relative space-y-0">
        {events.map((ev, i) => {
          const isNext = !ev.done && (i === 0 || events[i - 1].done);
          const mins = differenceInMinutes(ev.time, now);
          return (
            <div key={i} className="relative flex gap-4 pb-6 last:pb-0">
              {i !== events.length - 1 && (
                <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-black/5 dark:bg-white/10" />
              )}
              <div
                className={`relative z-10 mt-1 h-6 w-6 shrink-0 rounded-full border-[3px] ${
                  ev.done
                    ? "border-ios-green bg-ios-green"
                    : isNext
                    ? "border-ios-blue bg-white dark:bg-ios-darkcard"
                    : "border-black/10 dark:border-white/10 bg-transparent"
                }`}
              >
                {ev.done && (
                  <svg className="absolute inset-0 m-auto w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {isNext && <span className="absolute inset-0 m-auto h-2.5 w-2.5 rounded-full bg-ios-blue" />}
              </div>
              <div className="flex-1 -mt-0.5">
                <div className="flex items-start justify-between">
                  <p className={`text-sm font-bold ${isNext ? "text-ios-blue" : ev.done ? "text-black dark:text-white" : "text-ios-gray"}`}>
                    {ev.label}
                  </p>
                  <p className="text-xs font-mono font-medium text-ios-gray tabular-nums">
                    {format(ev.time, "h:mm a")}
                  </p>
                </div>
                <p className="text-xs text-ios-gray mt-0.5">{ev.sub}</p>
                {isNext && mins > 0 && (
                  <p className="text-[11px] font-medium text-ios-blue mt-1.5">{mins} min{mins !== 1 ? "s" : ""} from now</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
