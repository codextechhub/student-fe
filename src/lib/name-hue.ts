/**
 * The hues the redesign gives people and subjects, far enough apart to tell
 * at a glance. Each name keeps its hue wherever it appears, so a teacher's
 * avatar is the same colour in the Inbox and in the conversation.
 */
const HUES = [255, 25, 150, 300, 205, 70, 120, 340, 180, 230] as const;

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
