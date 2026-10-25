import { useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/redux/hooks";

import { turnOff, turnOn, useNativePush } from "./native-push-state";
import { sayNotOn } from "./push-say";

/**
 * The notifications setting on Profile in the store app, for the pupil showing.
 *
 * It says where things stand (on, off, blocked in the phone's settings, or not
 * offered by the school yet) and offers the one action that applies. Turning
 * notifications on from here goes straight to the phone's permission prompt:
 * the pupil has just asked for it. A phone that has been told no cannot be
 * asked again from inside the app, so the card says where to allow it.
 * Turning off stops this pupil's notifications only.
 */
export function NativePushSetting() {
  const { account, state } = useNativePush();
  const offline = useAppSelector((s) => s.connectivity.offline);
  const several = useAppSelector((s) => s.session.pupils.length > 1);
  const firstName = useAppSelector((s) => s.session.pupils.find((p) => p.account === s.session.active)?.firstName) || "you";
  const [busy, setBusy] = useState(false);
  if (state === "loading" || !account) return null;

  const on = async () => {
    setBusy(true);
    try {
      const result = await turnOn(account);
      if (result.ok) toast.success(`Notifications are on for ${firstName} on this device.`);
      else sayNotOn(result);
    } finally {
      setBusy(false);
    }
  };

  const off = async () => {
    setBusy(true);
    try {
      await turnOff(account);
      toast.success(`Notifications are off for ${firstName} on this device.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="profile-surface profile-notifications">
      <div className="profile-card-heading">
        <span className="profile-card-icon"><Bell size={19} aria-hidden="true" /></span>
        <div><h2>Notifications on this device</h2><p>A setting for {firstName} on this device</p></div>
      </div>
      <div className="profile-notification-body">
        <div>
          {state === "on" && <p><strong>On.</strong> You&apos;ll hear about new notices, released results, confirmed payments and messages.</p>}
          {(state === "off" || state === "undecided") && <p><strong>Off.</strong> Turn on notifications to hear about new notices, released results, confirmed payments and messages.</p>}
          {state === "blocked" && <p><strong>Blocked.</strong> Notifications are not allowed for this app. Open your phone&apos;s Settings, find XVS Student, allow notifications, then come back here.</p>}
          {state === "unavailable" && <p><strong>Unavailable.</strong> Your school doesn&apos;t send notifications to phones yet.</p>}
        </div>
        {state === "on" && <Button disabled={busy || offline} onClick={() => void off()}>{busy ? "Turning off" : "Turn off"}</Button>}
        {(state === "off" || state === "undecided") && <Button disabled={busy || offline} onClick={() => void on()}>{busy ? "Turning on" : "Turn on"}</Button>}
      </div>
      <p className="profile-notification-help">Notifications never show marks or amounts. {several ? "Each pupil on this device chooses for themselves." : "This setting applies to you on this device."}</p>
    </section>
  );
}
