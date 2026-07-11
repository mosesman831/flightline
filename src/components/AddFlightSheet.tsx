import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Airplane } from "@phosphor-icons/react";

interface AddFlightSheetProps {
  open: boolean;
  onClose: () => void;
}

export function AddFlightSheet({ open, onClose }: AddFlightSheetProps) {
  const [code, setCode] = useState("");

  useEffect(() => {
    if (open) setCode("");
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-[2rem] bg-white dark:bg-ios-darkcard shadow-[0_-8px_40px_rgba(0,0,0,0.18)] safe-bottom"
            role="dialog"
            aria-modal="true"
            aria-label="Add flight form"
          >
            <div className="p-6 space-y-5">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-black/10 dark:bg-white/20" />
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Add flight</h3>
                <button onClick={onClose} className="p-2 rounded-full bg-ios-bg dark:bg-white/10 active:scale-95 transition-transform" aria-label="Close">
                  <X weight="bold" className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-ios-gray uppercase tracking-wider">Flight number</label>
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-ios-bg dark:bg-white/5 focus-within:ring-2 focus-within:ring-ios-blue transition-shadow">
                  <Airplane weight="bold" className="w-5 h-5 text-ios-gray" />
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="AA184"
                    className="flex-1 bg-transparent text-lg font-bold placeholder:text-ios-gray/60 outline-none uppercase"
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={onClose} className="py-3.5 rounded-2xl font-semibold text-ios-gray bg-ios-bg dark:bg-white/5 active:scale-[0.97] transition-transform">
                  Cancel
                </button>
                <button className="py-3.5 rounded-2xl font-semibold text-white bg-ios-blue shadow-lg shadow-ios-blue/25 active:scale-[0.97] transition-transform">
                  Track flight
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
