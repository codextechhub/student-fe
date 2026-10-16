/**
 * Each signed-in pupil's short-lived access token, in memory only.
 *
 * Fifteen minutes long and never written anywhere: a reload or a new tab gets
 * a fresh one from the pupil's cookie. Keyed by the device account, so a phone
 * holding Tunde and Bola holds one for each and never sends one child's token
 * with the other's request.
 */
const tokens = new Map<string, string>();

export const accessFor = (account: string): string => tokens.get(account) ?? "";

export const setAccess = (account: string, access: string): void => {
  tokens.set(account, access);
};

export const dropAccess = (account: string): void => {
  tokens.delete(account);
};
