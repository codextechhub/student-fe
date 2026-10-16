import { Bell, Home, User, type LucideIcon } from "lucide-react";

/** One destination in the app's navigation. */
export type NavItem = {
  key: "home" | "notices" | "profile";
  label: string;
  path: string;
  icon: LucideIcon;
};

/**
 * The app's screens, in the design's order.
 *
 * Only built screens are listed: an item that opened nothing would look like a
 * working screen that does nothing. Timetable, Results, Attendance and Fees
 * join as they are built; Messages and Assignments are not built.
 */
export const NAV: NavItem[] = [
  { key: "home", label: "Home", path: "/", icon: Home },
  { key: "notices", label: "Notices", path: "/notices", icon: Bell },
  { key: "profile", label: "Profile", path: "/profile", icon: User },
];

/** How many destinations the bottom tab bar holds before the rest go under More. */
export const TAB_SLOTS = 5;

/**
 * The phone's bottom tabs and what goes under More.
 *
 * Up to five fit as tabs. Beyond that the first four stay as tabs and the rest
 * move to a More sheet, so no tab is ever too narrow to read.
 */
export function splitTabs(items: NavItem[]): { tabs: NavItem[]; more: NavItem[] } {
  if (items.length <= TAB_SLOTS) return { tabs: items, more: [] };
  return { tabs: items.slice(0, TAB_SLOTS - 1), more: items.slice(TAB_SLOTS - 1) };
}

/** The nav item a path belongs to: `/notices/12` is Notices. */
export function itemFor(pathname: string): NavItem | undefined {
  return [...NAV]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => (item.path === "/" ? pathname === "/" : pathname === item.path || pathname.startsWith(`${item.path}/`)));
}
