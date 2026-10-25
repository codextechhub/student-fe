import { useSyncExternalStore } from "react";

import { pushChoiceFor, setPushChoice, type PushChoice } from "@/push/push-choice";
import { useAppSelector } from "@/redux/hooks";

import { askOsPermission, deviceToken, osPermission, type OsPermission } from "./push-device";
import { forgetPupilDevice, registerPupil } from "./push-register";

/**
 * Native push for the pupils on this phone: what the app knows, and the moves
 * that change it.
 *
 * Three things decide where notifications stand for a pupil. The phone's
 * permission is the same for every pupil on it. Whether the school sends phone
 * push at all is learned from the first registration it refuses, and holds for
 * the rest of the run. And each pupil's own choice, kept per pupil in
 * `push/push-choice`: `on` once they turned notifications on, `off` after
 * turning them off, `not-now` once they put the offer away or the school had
 * none to give. A pupil with no choice is offered notifications once.
 *
 * Only a pupil whose choice is `on` is registered, so two children on one
 * phone each choose for themselves.
 */

/** Where notifications stand for the pupil showing. */
export type NativePushState = "loading" | "unavailable" | "blocked" | "undecided" | "on" | "off";

export function nativePushState(input: {
  permission: OsPermission | "unknown";
  unavailable: boolean;
  choice: PushChoice | null;
}): NativePushState {
  const { permission, unavailable, choice } = input;
  if (permission === "unknown") return "loading";
  if (unavailable) return "unavailable";
  if (permission === "denied") return "blocked";
  if (choice === "on") return permission === "granted" ? "on" : "off";
  return choice ? "off" : "undecided";
}

type Snapshot = { permission: OsPermission | "unknown"; unavailable: boolean; revision: number };

let snapshot: Snapshot = { permission: "unknown", unavailable: false, revision: 0 };
const listeners = new Set<() => void>();

function change(next: Partial<Snapshot>): void {
  snapshot = { ...snapshot, ...next, revision: snapshot.revision + 1 };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const getSnapshot = () => snapshot;

/** Resets what the run has learned. For tests. */
export function resetNativePushState(): void {
  snapshot = { permission: "unknown", unavailable: false, revision: 0 };
  registered.clear();
  tail = Promise.resolve();
}

/** Reads the phone's permission into the state; call it at start and whenever the app comes back to the front. */
export async function readPermission(): Promise<OsPermission> {
  const permission = await osPermission();
  if (permission !== snapshot.permission) change({ permission });
  return permission;
}

/** The token each pupil was last registered under in this run, so an unchanged one is not sent again. */
const registered = new Map<string, string>();

/** Runs moves one after another, so a token change and a tap on Turn on never register at once. */
let tail: Promise<unknown> = Promise.resolve();
function inOrder<T>(work: () => Promise<T>): Promise<T> {
  const next = tail.then(work, work);
  tail = next.catch(() => undefined);
  return next;
}

export type TurnOnResult = { ok: true } | { ok: false; reason: "blocked" | "dismissed" | "unavailable" | "failed" };

/**
 * Turns notifications on for `account`: asks the phone's permission if it has
 * not been given, takes the install's token and registers it for the pupil.
 * Call it from a tap, after the in-app explanation.
 */
export function turnOn(account: string): Promise<TurnOnResult> {
  return inOrder(async () => {
    let permission = await osPermission();
    if (permission === "prompt") permission = await askOsPermission();
    change({ permission });
    if (permission === "denied") return { ok: false, reason: "blocked" };
    if (permission !== "granted") return { ok: false, reason: "dismissed" };
    let token: string;
    try {
      token = await deviceToken();
    } catch {
      return { ok: false, reason: "failed" };
    }
    const result = await registerPupil(account, token);
    if (result === "unavailable") {
      // The offer is put away: the school has none to give yet, and turning it on later asks again.
      setPushChoice(account, "not-now");
      change({ unavailable: true });
      return { ok: false, reason: "unavailable" };
    }
    if (result === "failed") return { ok: false, reason: "failed" };
    registered.set(account, token);
    setPushChoice(account, "on");
    change({});
    return { ok: true };
  });
}

/** Turns notifications off for `account` only; a brother or sister on the phone keeps theirs. */
export async function turnOff(account: string): Promise<void> {
  await forgetPupilDevice(account);
  registered.delete(account);
  setPushChoice(account, "off");
  change({});
}

/** Puts the offer away for `account`. */
export function notNow(account: string): void {
  setPushChoice(account, "not-now");
  change({});
}

/**
 * Registers the phone for every pupil on it who has notifications on.
 *
 * Runs when the app starts, when a pupil is added or the pupils change, when
 * the app returns to the front and when Firebase issues a new token (passed
 * in as `token`). A pupil already registered under the same token is skipped.
 * Nothing is asked of the pupil and nothing is said if it fails: it is tried
 * again the next time. Once the school says it sends no phone push, the rest
 * are not tried.
 */
export function syncPupils(accounts: string[], token?: string): Promise<void> {
  return inOrder(async () => {
    const wanted = accounts.filter((account) => pushChoiceFor(account) === "on");
    if (wanted.length === 0 || snapshot.unavailable) return;
    if ((await osPermission()) !== "granted") return;
    let current = token;
    if (!current) {
      try {
        current = await deviceToken();
      } catch {
        return;
      }
    }
    for (const account of wanted) {
      if (registered.get(account) === current) continue;
      const result = await registerPupil(account, current);
      if (result === "ok") registered.set(account, current);
      if (result === "unavailable") {
        change({ unavailable: true });
        return;
      }
    }
  });
}

/** The state of notifications for the pupil showing, redrawn when anything above changes. */
export function useNativePush() {
  const account = useAppSelector((s) => s.session.active) ?? "";
  const current = useSyncExternalStore(subscribe, getSnapshot);
  const state = nativePushState({
    permission: current.permission,
    unavailable: current.unavailable,
    choice: account ? pushChoiceFor(account) : null,
  });
  return { account, state };
}
