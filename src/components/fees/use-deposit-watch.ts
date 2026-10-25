import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { onDepositCheck } from "@/lib/deposit-signal";
import { usePageVisible } from "@/lib/page-visible";
import { useAppDispatch } from "@/redux/hooks";
import { baseApi } from "@/redux/services/base-api";
import { useDepositsQuery, type Deposit } from "@/redux/services/portal-api";

/** How often a watching screen asks whether a transfer has arrived. */
export const WATCH_EVERY_MS = 5_000;

/** How long without a touch, key or scroll before the watching stops. */
export const IDLE_AFTER_MS = 10 * 60_000;

/** A pupil's touch is noted at most this often, so a scroll does not re-arm the timer on every frame. */
const NOTE_EVERY_MS = 1_000;

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "wheel", "scroll"] as const;

/**
 * Whether the pupil has been away from the screen for `afterMs`, and a way to
 * say they are back. Any touch, key or scroll on the page counts as back.
 */
function useIdle(afterMs: number): { idle: boolean; wake: () => void } {
  const [idle, setIdle] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const armedAt = useRef(0);

  const arm = useCallback(() => {
    window.clearTimeout(timer.current);
    armedAt.current = Date.now();
    timer.current = window.setTimeout(() => setIdle(true), afterMs);
  }, [afterMs]);

  const wake = useCallback(() => {
    setIdle(false);
    arm();
  }, [arm]);

  useEffect(() => {
    arm();
    const touched = () => {
      setIdle(false);
      if (Date.now() - armedAt.current >= NOTE_EVERY_MS) arm();
    };
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, touched, { capture: true, passive: true });
    return () => {
      window.clearTimeout(timer.current);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, touched, { capture: true });
    };
  }, [arm]);

  return { idle, wake };
}

/**
 * Watches the pupil's account number for transfers made since `since`.
 *
 * `since` is the server's own time from the moment the screen opened, so a
 * phone with the wrong clock still sees a deposit arrive. The look is cheap
 * and polite:
 *
 * - it asks every five seconds while the app is in front and focused, and not
 *   at all while the tab or the phone's screen is away;
 * - it asks again at once when the app returns to the front, when a "Payment
 *   received" push arrives in front (`deposit-signal`), and when the pupil
 *   comes back after a long idle;
 * - after ten minutes with no touch it stops, and the next touch starts it.
 *
 * A transfer shows as pending until it is booked. The first time a deposit is
 * seen booked, the fees and home reads are marked stale so the balance on
 * screen is read again from the school.
 */
export function useDepositWatch(since: string): { deposits: Deposit[] } {
  const dispatch = useAppDispatch();
  const visible = usePageVisible();
  const { idle, wake } = useIdle(IDLE_AFTER_MS);
  const polling = visible && !idle;
  const { data, refetch } = useDepositsQuery(since, {
    pollingInterval: polling ? WATCH_EVERY_MS : 0,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
  });

  const checkNow = useEffectEvent(() => void refetch());

  // Back in front, or back from idle: look at once instead of waiting out the interval.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (polling) checkNow();
  }, [polling]);

  // A push said money arrived, or the store app returned to the foreground.
  useEffect(
    () =>
      onDepositCheck(() => {
        wake();
        checkNow();
      }),
    [wake],
  );

  const deposits = useMemo(() => data?.deposits ?? [], [data]);
  const booked = useRef(new Set<string>());
  useEffect(() => {
    const fresh = deposits.filter((deposit) => deposit.status === "CONFIRMED" && !booked.current.has(deposit.reference));
    if (fresh.length === 0) return;
    for (const deposit of fresh) booked.current.add(deposit.reference);
    dispatch(baseApi.util.invalidateTags(["Fees", "Home", "PaymentNotices"]));
  }, [deposits, dispatch]);

  return { deposits };
}
