/**
 * The hues the redesign gives people and subjects: ten, evenly round the
 * wheel from the brand blue, so two names that differ never land on near
 * neighbours by accident of the list. Each name keeps its hue wherever it
 * appears, so a subject is the same colour on Home, Timetable and Results.
 */
const HUES = [255, 291, 327, 3, 39, 75, 111, 147, 183, 219] as const;

/** A name's hue, the same every time for the same name. */
export function hueFor(name: string): number {
  let hash = 0;
  for (const char of name.trim().toLowerCase()) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return HUES[hash % HUES.length];
}

/** The soft background and the strong text colour for a name, as a style. */
export function toneFor(name: string): { background: string; color: string } {
  const hue = hueFor(name);
  return { background: `oklch(0.95 0.035 ${hue})`, color: `oklch(0.45 0.11 ${hue})` };
}

/** The bright dot or bar for a name: a subject's colour in a timetable list. */
export function dotFor(name: string): string {
  return `oklch(0.64 0.14 ${hueFor(name)})`;
}
