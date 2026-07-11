// Haptic feedback with graceful degradation
export function hapticLight() {
  try {
    if (navigator.vibrate) navigator.vibrate(10);
  } catch {}
}

export function hapticMedium() {
  try {
    if (navigator.vibrate) navigator.vibrate(30);
  } catch {}
}

export function hapticHeavy() {
  try {
    if (navigator.vibrate) navigator.vibrate(50);
  } catch {}
}

export function hapticError() {
  try {
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
  } catch {}
}

export function hapticSuccess() {
  try {
    if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
  } catch {}
}
