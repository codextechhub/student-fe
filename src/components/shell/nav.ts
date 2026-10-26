import { Award, Bell, CalendarDays, CircleCheck, Home, MessageSquare, User, Wallet, type LucideIcon } from "lucide-react";

/** One destination in the app's navigation. */
export type NavItem = {
  key: "home" | "timetable" | "results" | "attendance" | "notices" | "messages" | "fees" | "profile";
  label: string;
  path: string;
  icon: LucideIcon;
  /**
   * Where the pupil reaches it: a tab on the bar, a tile behind the Inbox
   * button, or neither (Attendance opens from its card on Home, Profile from
   * the avatar at the top of every screen).
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
 * Timetable, Results and Fees as tabs, and beside them an Inbox button for
 * Notices and Messages, the way a pupil thinks of them.
 */
export const NAV: NavItem[] = [
  { key: "home", label: "Home", path: "/", icon: Home, place: "bar" },
  { key: "timetable", label: "Timetable", path: "/timetable", icon: CalendarDays, place: "bar" },
  { key: "results", label: "Results", path: "/results", icon: Award, place: "bar" },
  { key: "attendance", label: "Attendance", path: "/attendance", icon: CircleCheck, place: "off" },
  { key: "notices", label: "Notices", path: "/notices", icon: Bell, place: "inbox" },
  { key: "messages", label: "Messages", path: "/messages", icon: MessageSquare, place: "inbox" },
  { key: "fees", label: "Fees", path: "/fees", icon: Wallet, place: "bar" },
  { key: "profile", label: "Profile", path: "/profile", icon: User, place: "off" },
];

/** The tabs on the bar, in order. */
export const TABS = NAV.filter((item) => item.place === "bar");

/** The screens behind the Inbox button. */
export const INBOX = NAV.filter((item) => item.place === "inbox");

/** The nav item a path belongs to: `/notices/12` is Notices. */
export function itemFor(pathname: string): NavItem | undefined {
  return [...NAV]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => (item.path === "/" ? pathname === "/" : pathname === item.path || pathname.startsWith(`${item.path}/`)));
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
