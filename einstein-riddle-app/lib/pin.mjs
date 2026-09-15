export function isValidPinFormat(pin) {
  return /^\d{4}$/.test(String(pin ?? ""));
}

export function checkPin(pin, expected) {
  if (!expected || !isValidPinFormat(expected)) {
    return { ok: false, error: "misconfigured" };
  }
  if (!isValidPinFormat(pin) || String(pin) !== String(expected)) {
    return { ok: false, error: "invalid_pin" };
  }
  return { ok: true };
}
