import { useEffect } from "react";

import { useAppSelector } from "@/redux/hooks";

import { hideSplash } from "./splash";

/**
 * Hides the splash once the first real screen has been painted.
 *
 * With `ready` set the screen is already the first real one (the school
 * choice, which needs no session). Otherwise the app waits for the session to
 * leave "booting": from then on it shows the sign-in, the pupil's home or the
 * "can't reach your school" notice, never the loading mark. The hide waits two
 * animation frames so the screen is on the page before the splash fades.
 */
export function SplashGate({ ready = false }: { ready?: boolean }) {
  const status = useAppSelector((s) => s.session.status);
  const settled = ready || status !== "booting";
  useEffect(() => {
    if (!settled) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => void hideSplash());
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [settled]);
  return null;
}
