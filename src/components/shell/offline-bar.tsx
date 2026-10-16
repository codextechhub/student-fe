import { WifiOff } from "lucide-react";

import { formatTimeOfDay } from "@/lib/format";
import { useAppSelector } from "@/redux/hooks";

/**
 * Says the school cannot be reached, and how old what is on screen is.
 *
 * Shown under the header while any read is being answered from the pupil's
 * offline copy. Paying and editing are refused until the connection is back;
 * the screens say so where they offer them.
 */
export function OfflineBar() {
  const { offline, lastUpdated } = useAppSelector((s) => s.connectivity);
  if (!offline) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 lg:px-6"
    >
      <WifiOff className="size-4 shrink-0" />
      <span className="min-w-0">
        {lastUpdated
          ? `You're offline. Last updated ${formatTimeOfDay(lastUpdated)}.`
          : "You're offline. Some things can't be shown until you reconnect."}
      </span>
    </div>
  );
}
