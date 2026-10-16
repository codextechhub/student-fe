import { useState } from "react";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { usePushKeyQuery } from "@/redux/services/push-api";

import { pushChoiceFor, setPushChoice, type PushChoice } from "./push-choice";
import { pushPermission, pushSupport, turnOffPush, turnOnPush, type TurnOnResult } from "./push";

/**
 * Where notifications stand for the pupil showing, on this phone.
 *
 * - `unavailable`: this browser cannot show them, or the school sends none.
 * - `install-first`: an iPhone, where only the app on the Home Screen gets them.
 * - `blocked`: the browser's permission was refused; only its settings undo that.
 * - `undecided`: the pupil has not been asked yet.
 * - `on` / `off`: what the pupil chose.
 */
export type PushState = "loading" | "unavailable" | "install-first" | "blocked" | "undecided" | "on" | "off";

export function pushStateFrom(input: {
  support: ReturnType<typeof pushSupport>;
  keyState: "loading" | "ready" | "missing";
  permission: NotificationPermission;
  choice: PushChoice | null;
}): PushState {
  const { support, keyState, permission, choice } = input;
  if (support === "unsupported") return "unavailable";
  if (keyState === "loading") return "loading";
  if (keyState === "missing") return "unavailable";
  if (support === "install-first") return "install-first";
  if (permission === "denied") return "blocked";
  if (choice === "on") return permission === "granted" ? "on" : "off";
  if (choice) return "off";
  return "undecided";
}

export function usePush() {
  const dispatch = useAppDispatch();
  const account = useAppSelector((s) => s.session.active) ?? "";
  const support = pushSupport();
  const key = usePushKeyQuery(undefined, { skip: support === "unsupported" || !account });
  const [choice, setChoice] = useState<PushChoice | null>(() => pushChoiceFor(account));
  const [permission, setPermission] = useState<NotificationPermission>(pushPermission);
  const [busy, setBusy] = useState(false);

  const state = pushStateFrom({
    support,
    keyState: key.isSuccess ? "ready" : key.isError ? "missing" : "loading",
    permission,
    choice,
  });

  const turnOn = async (): Promise<TurnOnResult> => {
    setBusy(true);
    const result = await turnOnPush(dispatch, account);
    setPermission(pushPermission());
    if (result.ok) setChoice("on");
    setBusy(false);
    return result;
  };

  const turnOff = async (): Promise<boolean> => {
    setBusy(true);
    const done = await turnOffPush(dispatch, account);
    if (done) setChoice("off");
    setBusy(false);
    return done;
  };

  const notNow = () => {
    setPushChoice(account, "not-now");
    setChoice("not-now");
  };

  return { state, busy, turnOn, turnOff, notNow };
}
