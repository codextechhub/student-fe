import { Award, Bell, CalendarDays, CircleCheck, Home, Inbox, MessageSquare, User, Wallet, type LucideIcon } from "lucide-react";

/** One destination in the app's navigation. */
export type NavItem = {
  key: "home" | "timetable" | "results" | "attendance" | "inbox" | "notices" | "messages" | "fees" | "profile";
  label: string;
  path: string;
  icon: LucideIcon;
  /**
   * Where the pupil reaches it: a tab on the bar, the Inbox button (the Inbox
   * itself and the notice or conversation opened from it), or neither
   * (Attendance opens from its card on Home, Profile from the avatar at the
   * top of every screen).
   */
  place: "bar" | "inbox" | "off";
};

/**
 * The app's screens, in the design's order.
 *
 * Only built screens are listed: an item that opened nothing would look like a
 * working screen that does nothing. Assignments are not built.
 *
 * The bar is the design's split bar (option 3b, the owner's choice): Home,
 * Timetable, Results and Fees as tabs, and beside them an Inbox button: one
 * list of notices and messages, the way a pupil thinks of them.
 */
export const NAV: NavItem[] = [
  { key: "home", label: "Home", path: "/", icon: Home, place: "bar" },
  { key: "timetable", label: "Timetable", path: "/timetable", icon: CalendarDays, place: "bar" },
  { key: "results", label: "Results", path: "/results", icon: Award, place: "bar" },
  { key: "attendance", label: "Attendance", path: "/attendance", icon: CircleCheck, place: "off" },
  { key: "inbox", label: "Inbox", path: "/inbox", icon: Inbox, place: "inbox" },
  { key: "notices", label: "Notices", path: "/notices", icon: Bell, place: "inbox" },
  { key: "messages", label: "Messages", path: "/messages", icon: MessageSquare, place: "inbox" },
  { key: "fees", label: "Fees", path: "/fees", icon: Wallet, place: "bar" },
  { key: "profile", label: "Profile", path: "/profile", icon: User, place: "off" },
];

/** The tabs on the bar, in order. */
export const TABS = NAV.filter((item) => item.place === "bar");

/** The screens the Inbox button stands for: the Inbox, and a notice or conversation opened from it. */
export const INBOX = NAV.filter((item) => item.place === "inbox");

/** The nav item a path belongs to: `/notices/12` is Notices. */
export function itemFor(pathname: string): NavItem | undefined {
  return [...NAV]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => (item.path === "/" ? pathname === "/" : pathname === item.path || pathname.startsWith(`${item.path}/`)));
}

/**
 * Whether the path is a screen opened from another, drawn with its own back
 * bar at the top and, where it has one, its own action bar at the bottom
 * (the report card, paying a bill, a payment's result, a receipt, a notice). The shell's header and tab bar step aside for it, at
 * every size, as an iPhone pushes a screen over its tabs.
 */
export function isDetailPath(pathname: string): boolean {
  return /^\/(results\/card|fees\/pay|fees\/receipts|notices)\/[^/]+\/?$/.test(pathname) || /^\/(fees\/paid|profile\/delete-account)\/?$/.test(pathname);
}

/**
 * Whether the path is an open conversation (`/messages/41`).
 *
 * The app shell reads this to give the conversation the whole screen: the tab
 * bar steps aside on a phone and the shell is held to the visible height, so
 * the screen's own parts, not the page, do the scrolling. `/messages/new` is
 * the new-message sheet over the list, not a conversation.
 */
export function isConversationPath(pathname: string): boolean {
  return /^\/messages\/\d+\/?$/.test(pathname);
}
