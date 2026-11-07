const CM_PER_INCH = 2.54;

export function cmToFeetInches(cm: number) {
  const totalInches = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

export function feetInchesToCm(feet: number, inches: number) {
  return Math.round((feet * 12 + inches) * CM_PER_INCH);
}

/** Parses user-typed numbers; accepts "72,5" as 72.5. Returns undefined for empty or invalid. */
export function parseDecimal(text: string): number | undefined {
  const n = Number(text.replace(',', '.').trim());
  return text.trim() === '' || Number.isNaN(n) ? undefined : n;
}
