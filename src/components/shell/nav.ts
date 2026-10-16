import { Award, Bell, CalendarDays, CircleCheck, Home, User, Wallet, type LucideIcon } from "lucide-react";

/** One destination in the app's navigation. */
export type NavItem = {
  key: "home" | "timetable" | "results" | "attendance" | "notices" | "fees" | "profile";
  label: string;
  path: string;
  icon: LucideIcon;
  /** Kept on the tab bar when there are too many screens for it; the rest go under More. */
  onBar?: boolean;
};

/**
 * The app's screens, in the design's order.
 *
 * Only built screens are listed: an item that opened nothing would look like a
 * working screen that does nothing. Messages and Assignments are not built.
 *
 * When there are more screens than the bar holds, the bar keeps Home,
 * Timetable, Results and Fees, the ones a pupil opens most (the owner's
 * choice), and the rest move under More.
 */
export const NAV: NavItem[] = [
  { key: "home", label: "Home", path: "/", icon: Home, onBar: true },
  { key: "timetable", label: "Timetable", path: "/timetable", icon: CalendarDays, onBar: true },
  { key: "results", label: "Results", path: "/results", icon: Award, onBar: true },
  { key: "attendance", label: "Attendance", path: "/attendance", icon: CircleCheck },
  { key: "notices", label: "Notices", path: "/notices", icon: Bell },
  { key: "fees", label: "Fees", path: "/fees", icon: Wallet, onBar: true },
  { key: "profile", label: "Profile", path: "/profile", icon: User },
];

/** How many destinations the tab bar holds before some go under More. */
export const TAB_SLOTS = 5;

/**
 * The tab bar's tabs and what goes under More.
 *
 * Up to five screens all fit as tabs. Beyond that the bar keeps the screens
 * marked `onBar` (at most four, so More takes the fifth place) and the rest go
 * under More, in their usual order.
 */
export function splitTabs(items: NavItem[]): { tabs: NavItem[]; more: NavItem[] } {
  if (items.length <= TAB_SLOTS) return { tabs: items, more: [] };
  const tabs = items.filter((item) => item.onBar).slice(0, TAB_SLOTS - 1);
  return { tabs, more: items.filter((item) => !tabs.includes(item)) };
}

/** The nav item a path belongs to: `/notices/12` is Notices. */
export function itemFor(pathname: string): NavItem | undefined {
  return [...NAV]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => (item.path === "/" ? pathname === "/" : pathname === item.path || pathname.startsWith(`${item.path}/`)));
}
