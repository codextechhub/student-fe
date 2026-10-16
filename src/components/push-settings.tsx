import { useState } from "react";
import { Bell, BellOff, Share } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
 * notifications and this browser can show them. On an iPhone it says how to
 * add the app to the Home Screen first, because only the added app gets them.
 * Turn on asks the browser's permission there and then; Not now puts the
 * offer away, and Profile keeps the setting.
 */
export function PushOffer() {
  const { state, busy, turnOn, notNow } = usePush();
  const offline = useAppSelector((s) => s.connectivity.offline);
  const firstName = useShowingFirstName();
  const [installPutAway, setInstallPutAway] = useState(() => !offerInstall());
  if (state !== "undecided" && state !== "install-first") return null;
  if (state === "install-first" && installPutAway) return null;

  return (
    <section className="flex min-w-0 flex-wrap items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <Bell className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1 basis-56">
        <h2 className="text-sm font-semibold text-foreground">Get notifications</h2>
        {state === "undecided" ? (
          <p className="mt-0.5 text-xs text-muted-foreground">Be told on this device about {WHAT_THEY_SAY}</p>
        ) : (
          <InstallSteps />
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (state === "install-first") {
              // Put away until the app is added; not a choice about notifications.
              rememberInstallOffered();
              setInstallPutAway(true);
            } else {
              notNow();
            }
          }}
        >
          Not now
        </Button>
        {state === "undecided" && (
          <Button size="sm" disabled={busy || offline} onClick={async () => sayTurnOn(await turnOn(), firstName)}>
            {busy ? "Turning on" : "Turn on"}
          </Button>
        )}
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
 * a brother or sister signed in on the same phone keeps theirs.
 */
export function PushSetting() {
  const { state, busy, turnOn, turnOff } = usePush();
  const offline = useAppSelector((s) => s.connectivity.offline);
  const several = useAppSelector((s) => s.session.pupils.length > 1);
  const firstName = useShowingFirstName();
  if (state === "loading") return null;

  return (
    <section className="min-w-0 rounded-xl border border-border p-4">
      <h2 className="mb-2 text-sm font-semibold text-foreground">Notifications on this device</h2>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-56 text-xs text-muted-foreground">
          {state === "on" && <p><span className="font-medium text-foreground">On.</span> You&apos;re told about {WHAT_THEY_SAY}</p>}
          {(state === "off" || state === "undecided") && <p><span className="font-medium text-foreground">Off.</span> Turn them on to be told about {WHAT_THEY_SAY}</p>}
          {state === "blocked" && <p><span className="font-medium text-foreground">Blocked.</span> This browser has been told not to show notifications from your school. Allow them in its settings, then come back here.</p>}
          {state === "install-first" && <InstallSteps />}
          {state === "unavailable" && <p>Notifications aren&apos;t available on this device.</p>}
          {several && state !== "unavailable" && <p className="mt-1">Each pupil on this device chooses for themselves.</p>}
        </div>
        {state === "on" && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy || offline}
            onClick={async () => {
              if (await turnOff()) toast.success(`Notifications are off for ${firstName} on this device.`);
              else toast.error("Notifications couldn't be turned off. Try again in a moment.");
            }}
          >
            <BellOff className="size-4" aria-hidden /> {busy ? "Turning off" : "Turn off"}
          </Button>
        )}
        {(state === "off" || state === "undecided") && (
          <Button size="sm" disabled={busy || offline} onClick={async () => sayTurnOn(await turnOn(), firstName)}>
            <Bell className="size-4" aria-hidden /> {busy ? "Turning on" : "Turn on"}
          </Button>
        )}
      </div>
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

const INSTALL_OFFERED_KEY = "xvs.student.push-install-offered";

/** The install steps are offered on Home once per phone, not once per pupil. */
function offerInstall(): boolean {
  try {
    return localStorage.getItem(INSTALL_OFFERED_KEY) !== "1";
  } catch {
    return true;
  }
}

function rememberInstallOffered() {
  try {
    localStorage.setItem(INSTALL_OFFERED_KEY, "1");
  } catch {
    // Offered again next time.
  }
}
