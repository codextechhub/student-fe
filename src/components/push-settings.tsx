import { Bell, Share, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { NativePushSetting } from "@/native/native-push-setting";
import { isNativeApp } from "@/native/platform";
import type { TurnOnResult } from "@/push/push";
import { usePush } from "@/push/use-push";
import { useAppSelector } from "@/redux/hooks";

/** What the app says after a tap on Turn on, by how it went. */
function sayTurnOn(result: TurnOnResult, firstName: string) {
  if (result.ok) {
    toast.success(`Notifications are on for ${firstName} on this device.`);
  } else if (result.reason === "blocked") {
    toast.error("Notifications are blocked for this app. Allow them in your browser's settings, then try again.");
  } else if (result.reason === "failed") {
    toast.error("Notifications couldn't be turned on. Try again in a moment.");
  }
}

function useShowingFirstName(): string {
  const { pupils, active } = useAppSelector((s) => s.session);
  return pupils.find((p) => p.account === active)?.firstName || "you";
}

const WHAT_THEY_SAY = "a new notice, a result ready to read, a payment confirmed. They never show marks or amounts.";

/**
 * The offer on Home, made once to each pupil on this device.
 *
 * Shown only to a pupil who has not chosen yet, where the school sends
 * notifications and this browser can show them. On an iPhone the install card
 * comes first, because only the added app can receive notifications.
 * Turn on asks the browser's permission there and then; Not now puts the
 * offer away, and Profile keeps the setting.
 */
export function PushOffer() {
  const { state, busy, turnOn, notNow } = usePush();
  const offline = useAppSelector((s) => s.connectivity.offline);
  const firstName = useShowingFirstName();
  if (state !== "undecided") return null;

  return (
    <section aria-label="Get notifications" className="relative flex min-w-0 flex-wrap items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 pr-12">
      <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2 text-muted-foreground" aria-label="Close" onClick={notNow}><X className="size-4" aria-hidden /></Button>
      <Bell className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1 basis-56">
        <h2 className="text-sm font-semibold text-foreground">Get notifications</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Be told on this device about {WHAT_THEY_SAY}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button size="sm" disabled={busy || offline} onClick={async () => sayTurnOn(await turnOn(), firstName)}>
          {busy ? "Turning on" : "Turn on"}
        </Button>
      </div>
    </section>
  );
}

/**
 * The notifications setting on Profile, for the pupil showing on this device.
 *
 * It says where things stand (on, off, blocked by the browser, needing the
 * Home Screen app on an iPhone, or not available here) and offers the one
 * action that applies. Turning it off stops this pupil's notifications only:
 * a brother or sister signed in on the same phone keeps theirs. The store app
 * has its own card for native push (`NativePushSetting`).
 */
export function PushSetting() {
  return isNativeApp() ? <NativePushSetting /> : <WebPushSetting />;
}

function WebPushSetting() {
  const { state, busy, turnOn, turnOff } = usePush();
  const offline = useAppSelector((s) => s.connectivity.offline);
  const several = useAppSelector((s) => s.session.pupils.length > 1);
  const firstName = useShowingFirstName();
  if (state === "loading") return null;

  return (
    <section className="profile-surface profile-notifications">
      <div className="profile-card-heading">
        <span className="profile-card-icon"><Bell size={19} aria-hidden="true" /></span>
        <div><h2>Notifications on this device</h2><p>A setting for {firstName} on this device</p></div>
      </div>
      <div className="profile-notification-body">
        <div>
          {state === "on" && <p><strong>On.</strong> You&apos;ll hear about new notices, released results and confirmed payments.</p>}
          {(state === "off" || state === "undecided") && <p><strong>Off.</strong> Turn on notifications to hear about new notices, released results and confirmed payments.</p>}
          {state === "blocked" && <p><strong>Blocked.</strong> This browser has been told not to show notifications. Allow them in browser settings, then come back here.</p>}
          {state === "install-first" && <><p><strong>Add the app first.</strong></p><InstallSteps /></>}
          {state === "unavailable" && <p><strong>Unavailable.</strong> Notifications aren&apos;t available on this device.</p>}
        </div>
        {state === "on" && (
          <Button
            disabled={busy || offline}
            onClick={async () => {
              if (await turnOff()) toast.success(`Notifications are off for ${firstName} on this device.`);
              else toast.error("Notifications couldn't be turned off. Try again in a moment.");
            }}
          >
            {busy ? "Turning off" : "Turn off"}
          </Button>
        )}
        {(state === "off" || state === "undecided") && (
          <Button disabled={busy || offline} onClick={async () => sayTurnOn(await turnOn(), firstName)}>
            {busy ? "Turning on" : "Turn on"}
          </Button>
        )}
      </div>
      <p className="profile-notification-help">Notifications never show marks or amounts. {several ? "Each pupil on this device chooses for themselves." : "This setting applies to you on this device."}</p>
    </section>
  );
}

function InstallSteps() {
  return (
    <p className="mt-0.5 text-xs text-muted-foreground">
      On an iPhone, notifications come to the app on your Home Screen. Tap{" "}
      <Share className="inline size-3.5 align-text-bottom" aria-label="Share" />, then <span className="font-medium">Add to Home Screen</span>,
      and open the app from there.
    </p>
  );
}
