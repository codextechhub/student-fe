import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** Whether the app is in front of the pupil: false while the tab or the phone's screen is away. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribe, () => document.visibilityState !== "hidden", () => true);
}
