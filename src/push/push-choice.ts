/**
 * What each pupil on this phone chose about notifications.
 *
 * `on` once they turned notifications on, `off` once they turned them off,
 * `not-now` once they put the offer away. A pupil with no choice yet is
 * offered notifications on Home; one with any choice is not asked again, and
 * changes it on Profile.
 *
 * Kept in this browser only. Whether a pupil is really subscribed is the
 * school's to know; this only decides what the app offers and what it
 * re-sends when the pupil opens it. Storage that cannot be read reads as no
 * choice, so the worst case is an offer shown twice.
 */
export type PushChoice = "on" | "off" | "not-now";

const STORAGE_KEY = "xvs.student.push";

function readAll(): Record<string, PushChoice> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, PushChoice>) : {};
  } catch {
    return {};
  }
}

export function pushChoiceFor(account: string): PushChoice | null {
  return readAll()[account] ?? null;
}

/** Records `choice` for `account`, or forgets the pupil's choice with null. */
export function setPushChoice(account: string, choice: PushChoice | null): void {
  const all = readAll();
  if (choice) all[account] = choice;
  else delete all[account];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // A choice that cannot be kept is offered again next time.
  }
}
