/**
 * Decimal numbers as people type them: "62.5" or "62,5" (phones set to a
 * comma). Fields use a text box with inputMode="decimal", because
 * type="number" throws "62,5" away on those phones.
 */

/** The number in `s`, reading a comma as a decimal point; NaN if there isn't one. */
export function parseDecimal(s: string): number {
  const t = s.trim().replace(',', '.');
  return t === '' || t === '.' ? NaN : Number(t);
}

/** What a decimal box keeps while typing: digits and one "." or ",". */
export function cleanDecimal(s: string): string {
  return s.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/g, '$1');
}
