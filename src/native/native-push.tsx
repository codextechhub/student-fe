import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { showPupilFromPush } from "@/auth/device-session";
import { Button } from "@/components/ui/button";
import { isPaymentPush, requestDepositCheck } from "@/lib/deposit-signal";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { nativePlatform } from "./platform";
import { sayNotOn } from "./push-say";
import {
  notNow,
  readPermission,
  syncPupils,
  turnOn,
  useNativePush,
} from "./native-push-state";
import { onForeground, onTap, onTokenChange, type PushPayload } from "./push-device";
import { tapTarget } from "./push-routing";

/**
 * Native push for the store app, mounted once inside the router.
 *
 * - **Registering.** Every pupil on the phone who turned notifications on is
 *   registered with the school under their own sign-in, when the app starts,
 *   when pupils are added, when the app comes back to the front and when
 *   Firebase issues a new token.
 * - **A tapped notification.** The pupil it names is shown, if they are on
 *   this phone, and the screen it names opens. A notification for a pupil no
 *   longer here opens the app and nothing else. A tap that launched the app
 *   waits for the session to open first, because switching pupils while the
 *   app is still choosing whom to show would race it.
 * - **An open app.** The iPhone shows the banner itself. Android shows nothing
 *   for an app in front, so a toast stands in. A "Payment received" push (or the
 *   app returning to the front) also tells a Fees or Pay screen to look for the
 *   transfer at once (`deposit-signal`).
 * - **The offer.** A pupil who has not chosen is shown a short explanation
 *   before the phone's own permission prompt (`NativePushOffer`).
 */
export function NativePushListener() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { status, pupils } = useAppSelector((s) => s.session);
  const accounts = pupils.map((p) => p.account);
  const accountsKey = accounts.join("|");
  const waiting = useRef<PushPayload | null>(null);

  const open = useEffectEvent(async (payload: PushPayload) => {
    const { account, path } = tapTarget(payload.data);
    if (account && !(await dispatch(showPupilFromPush(account)))) return;
    navigate(path);
  });
  const tapped = useEffectEvent((payload: PushPayload) => {
    if (status === "signed-in") void open(payload);
    else waiting.current = payload;
  });
  const tokenChanged = useEffectEvent((token: string) => void syncPupils(accounts, token));
  const returned = useEffectEvent(() => void readPermission().then(() => syncPupils(accounts)));

  // The phone's side: listeners that live as long as the app does.
  useEffect(() => {
    if (!nativePlatform()) return;
    let live = true;
    const stops: Array<() => void> = [];
    const keep = (stop: () => void) => (live ? stops.push(stop) : stop());

    void readPermission();
    void onTokenChange(tokenChanged).then(keep, () => undefined);
    void onTap(tapped).then(keep, () => undefined);
    void onForeground(({ title, body, data }) => {
      if (isPaymentPush(data)) requestDepositCheck();
      if (nativePlatform() === "android" && (title || body)) toast(title || body, title && body ? { description: body } : undefined);
    }).then(keep, () => undefined);
    void import("@capacitor/app").then(async ({ App }) => {
      const handle = await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          returned();
          requestDepositCheck();
        }
      });
      keep(() => void handle.remove());
    });

    return () => {
      live = false;
      stops.forEach((stop) => stop());
    };
  }, []);

  // A tap that arrived before the session opened is answered once it has, or dropped if nobody is signed in.
  useEffect(() => {
    if (status === "booting") return;
    const payload = waiting.current;
    waiting.current = null;
    if (payload && status === "signed-in") void open(payload);
  }, [status]);

  // Pupils on the phone: register those with notifications on, at start and as pupils are added.
  useEffect(() => {
    if (status !== "signed-in" || !nativePlatform()) return;
    void syncPupils(accountsKey ? accountsKey.split("|") : []);
  }, [status, accountsKey]);

  return <NativePushOffer />;
}

/**
 * The one-time offer to the pupil showing, before the phone asks anything.
 *
 * Shown to a signed-in pupil who has not chosen, where the phone has not been
 * told no and the school sends phone push. Turn on goes on to the phone's
 * permission prompt; Not now puts the offer away for good, and Profile keeps
 * the setting for later. Not shown offline, since turning on needs the school.
 */
function NativePushOffer() {
  const { account, state } = useNativePush();
  const status = useAppSelector((s) => s.session.status);
  const offline = useAppSelector((s) => s.connectivity.offline);
  const firstName = useAppSelector((s) => s.session.pupils.find((p) => p.account === s.session.active)?.firstName);
  const [busy, setBusy] = useState(false);
  if (status !== "signed-in" || !account || state !== "undecided" || offline) return null;

  const turnOnNow = async () => {
    setBusy(true);
    try {
      const result = await turnOn(account);
      if (!result.ok) sayNotOn(result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      aria-label="Get notifications"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-5 bg-background px-6 text-center"
    >
      <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
        <Bell className="size-7" aria-hidden />
      </span>
      <h1 className="max-w-xs text-lg font-semibold text-foreground">
        Get a notification when your results, notices or messages arrive
      </h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        {firstName ? `${firstName}, your` : "Your"} phone will ask you to allow notifications next. They never show marks
        or amounts, and you can turn them off any time in Profile.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button disabled={busy} loading={busy} onClick={() => void turnOnNow()}>
          Turn on notifications
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => notNow(account)}>
          Not now
        </Button>
      </div>
    </main>
  );
}
