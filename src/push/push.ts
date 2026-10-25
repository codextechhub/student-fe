import type { ThunkDispatch, UnknownAction } from "@reduxjs/toolkit";

import { runningInstalled } from "@/install/installed";
import { isNativeApp } from "@/native/platform";
import { browserFacts, isAppleMobile } from "@/install/situation";
import { pushApi, type DeviceSubscription } from "@/redux/services/push-api";

import { pushChoiceFor, setPushChoice } from "./push-choice";

/**
 * Notifications on this phone, for the pupil showing.
 *
 * The browser holds one push subscription for the whole app, and every pupil
 * signed in on the phone shares it: turning notifications on remembers that
 * subscription with the school for this pupil, and turning them off forgets
 * it for this pupil only. The browser's subscription itself is never
 * cancelled, because a brother or sister on the same phone may still be
 * using it.
 *
 * The permission prompt comes only from a tap (iPhone refuses any other), and
 * only after a pupil has signed in. An iPhone shows notifications only to the
 * app added to its Home Screen, so there they wait for the installed app.
 */

type Dispatch = ThunkDispatch<unknown, unknown, UnknownAction>;

/** How long to wait for the service worker before deciding this browser cannot push. */
const WORKER_WAIT_MS = 5000;

/** `/student/results` as the router's own path (`/results`), never outside the app. */
export function routerPath(path: string): string {
  if (!path.startsWith("/student/") && path !== "/student") return "/";
  return path.slice("/student".length) || "/";
}

export type PushSupport = "ready" | "install-first" | "unsupported";

/**
 * Whether this browser can show the school's notifications, and what stands in the way.
 * The store app has no Web Push: its notifications are native push, which
 * `native/native-push` will register.
 */
export function pushSupport(): PushSupport {
  if (isNativeApp()) return "unsupported";
  if (typeof window === "undefined" || typeof navigator === "undefined") return "unsupported";
  if (isAppleMobile(browserFacts()) && !runningInstalled()) return "install-first";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  return "ready";
}

/** The browser's permission, or "default" where it has none to give. */
export function pushPermission(): NotificationPermission {
  return typeof Notification === "undefined" ? "default" : Notification.permission;
}

/** The school's public key as the bytes `applicationServerKey` takes. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(current: ArrayBuffer | null | undefined, wanted: Uint8Array): boolean {
  if (!current) return false;
  const have = new Uint8Array(current);
  return have.length === wanted.length && have.every((byte, i) => byte === wanted[i]);
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), WORKER_WAIT_MS));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

/** This browser's subscription under the school's key, made if there is none. */
async function deviceSubscription(dispatch: Dispatch): Promise<DeviceSubscription | null> {
  const key = keyBytes(await dispatch(pushApi.endpoints.pushKey.initiate()).unwrap());
  const worker = await registration();
  if (!worker) return null;
  let subscription = await worker.pushManager.getSubscription();
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    // The school changed its key: the old subscription can no longer be sent to.
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}

export type TurnOnResult = { ok: true } | { ok: false; reason: "blocked" | "dismissed" | "failed" };

/**
 * Turns notifications on for `account`. Call it straight from a tap: the
 * permission prompt must be the first thing the tap does.
 */
export async function turnOnPush(dispatch: Dispatch, account: string): Promise<TurnOnResult> {
  const permission = await Notification.requestPermission();
  if (permission === "denied") return { ok: false, reason: "blocked" };
  if (permission !== "granted") return { ok: false, reason: "dismissed" };
  try {
    const subscription = await deviceSubscription(dispatch);
    if (!subscription) return { ok: false, reason: "failed" };
    await dispatch(pushApi.endpoints.subscribePush.initiate({ ...subscription, account })).unwrap();
  } catch {
    return { ok: false, reason: "failed" };
  }
  setPushChoice(account, "on");
  return { ok: true };
}

/** Turns notifications off for `account` only; the phone's other pupils keep theirs. */
export async function turnOffPush(dispatch: Dispatch, account: string): Promise<boolean> {
  try {
    const worker = await registration();
    const subscription = await worker?.pushManager.getSubscription();
    if (subscription) {
      await dispatch(pushApi.endpoints.unsubscribePush.initiate({ endpoint: subscription.endpoint })).unwrap();
    }
  } catch {
    return false;
  }
  setPushChoice(account, "off");
  return true;
}

/**
 * Re-sends this phone's subscription for a pupil who turned notifications on,
 * when they are shown.
 *
 * The browser may have replaced its subscription since, or the school's key
 * may have changed and the subscription with it, and the school only learns
 * the new one this way. Nothing is asked of the pupil and nothing is said if
 * it fails; it is tried again next time.
 */
export async function refreshPush(dispatch: Dispatch, account: string): Promise<void> {
  if (pushChoiceFor(account) !== "on" || pushSupport() !== "ready" || pushPermission() !== "granted") return;
  try {
    const subscription = await deviceSubscription(dispatch);
    if (subscription) await dispatch(pushApi.endpoints.subscribePush.initiate({ ...subscription, account })).unwrap();
  } catch {
    // Tried again the next time the pupil is shown.
  }
}
