import { useEffect, useState, type CSSProperties } from "react";
import { Inbox } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router";

import { refreshShowingPupil } from "@/auth/device-session";
import { SchoolMark } from "@/components/school-mark";
import { PupilAvatar } from "@/components/pupil-avatar";
import { PupilSwitcher } from "@/components/session/pupil-switcher";
import { useVisualViewportBox } from "@/lib/visual-viewport";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useUnreadMessagesQuery } from "@/redux/services/messages-api";
import { useMeQuery, useNoticesQuery } from "@/redux/services/portal-api";

import { INBOX, isConversationPath, isDetailPath, itemFor, TABS, type NavItem } from "./nav";
import { OfflineBar } from "./offline-bar";
import { PullToRefresh } from "./pull-to-refresh";
import "@/components/layout/screen.css";
import "./app-shell.css";

/** How often the Messages badge asks the school for the unread count, in milliseconds. */
const MESSAGE_BADGE_POLL_MS = 60_000;

/**
 * The screens that open on the redesign's large title. The header leaves
 * their name out until the large title has scrolled away under it, as on an
 * iPhone, so the name is never on screen twice.
 */
const LARGE_TITLE: ReadonlySet<NavItem["key"]> = new Set(["home", "timetable", "results", "attendance", "fees", "inbox", "profile"]);

/** How far down, in px, a large title has gone under the header. */
const LARGE_TITLE_PAST = 56;

/**
 * The frame every signed-in screen sits in.
 *
 * At every size the screens are a floating tab bar at the bottom (the split
 * bar: four tabs and an Inbox button), and the header carries the school's
 * crest, the screen title and the pupil's avatar, which opens Profile. On
 * Profile the avatar's place is "Switch pupil", the way to another pupil or
 * to signing out. The offline bar sits under the header
 * whenever the app is showing kept data, and a pull down from the top of a
 * screen reads everything on it again.
 *
 * An open Messages conversation is the one screen that does not scroll as a
 * page. The shell is held to the visible height (`100dvh`, narrowed to
 * `visualViewport` so the message box rides above the phone keyboard), the
 * conversation fills the screen, and the shell's own header (crest, title,
 * avatar) and the tab bar both step aside at every size, so the
 * conversation's header with its back arrow is the top of the screen, as in a
 * messaging app. Both return on the Inbox.
 *
 * A screen opened from another (the report card, `isDetailPath`) draws its
 * own back bar and action bar, so the header and the tab bar step aside for
 * it at every size too.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(() => window.scrollY > 8);
  const [titlePast, setTitlePast] = useState(() => window.scrollY > LARGE_TITLE_PAST);
  useEffect(() => {
    const update = () => {
      setScrolled(window.scrollY > 8);
      setTitlePast(window.scrollY > LARGE_TITLE_PAST);
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  const dispatch = useAppDispatch();
  const { data: me } = useMeQuery();
  // Keep the switcher's saved name and photo in step with the latest me/.
  useEffect(() => {
    if (me) void dispatch(refreshShowingPupil(me));
  }, [me, dispatch]);
  const { data: noticePage } = useNoticesQuery(1);
  const unread = noticePage?.unreadCount ?? 0;
  // The Messages badge: read again every minute and whenever the app comes back into view.
  const { data: unreadMessages = 0 } = useUnreadMessagesQuery(undefined, {
    pollingInterval: MESSAGE_BADGE_POLL_MS,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const current = itemFor(pathname);
  const conversationOpen = isConversationPath(pathname);
  const detail = isDetailPath(pathname);
  const viewport = useVisualViewportBox(conversationOpen);
  const onDesignPage = pathname.startsWith("/inbox") || pathname === "/" || pathname === "/timetable" || pathname.startsWith("/results") || pathname === "/attendance" || pathname.startsWith("/profile") || pathname.startsWith("/fees") || pathname.startsWith("/notices") || pathname.startsWith("/messages");
  const badges: Partial<Record<NavItem["key"], number>> = { notices: unread, messages: unreadMessages };
  const where = [me?.school.name, me?.show_branch ? me?.branch?.name : null].filter(Boolean).join(" · ");
  const screenTitle = pathname.startsWith("/results/card/") ? "Report card" : pathname.startsWith("/fees/receipts/") ? "Payment receipt" : pathname.startsWith("/fees/pay/") ? "Pay a bill" : pathname === "/fees/paid" ? "Payment status" : pathname === "/profile/delete-account" ? "Delete my account" : current?.key === "fees" ? "My fees" : current?.key === "attendance" ? "My attendance" : current?.key === "timetable" ? "My timetable" : current?.key === "results" ? "My results" : current?.key === "profile" ? "My profile" : current?.label ?? "";

  return (
    <div
      className={cn("app-shell flex min-h-dvh min-w-0 flex-col bg-background pb-[calc(6rem+env(safe-area-inset-bottom))]", onDesignPage && "app-shell--design", conversationOpen && "app-shell--conversation", detail && "app-shell--detail", viewport?.keyboard && "is-keyboard")}
      style={viewport ? ({ "--vv-top": `${viewport.top}px`, "--vv-height": `${viewport.height}px` } as CSSProperties) : undefined}
    >
      <header data-hidden={detail || conversationOpen || undefined} className={cn("app-shell-head sticky top-0 z-30 flex min-h-[58px] min-w-0 items-center gap-3 border-b px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 transition-[background-color,backdrop-filter,border-color] duration-200 sm:min-h-[66px] lg:px-6", onDesignPage ? scrolled ? "border-[#dbe0eb] bg-[#f5f7fc]/70 backdrop-blur-xl backdrop-saturate-150" : "border-transparent bg-transparent" : scrolled ? "border-border bg-background/75 backdrop-blur-xl" : "border-border bg-background")}>
        <SchoolMark logo={me?.school.logo_url || null} size={onDesignPage ? 34 : 28} animate={false} alt={where} className={onDesignPage ? "max-h-7 sm:max-h-[34px]" : undefined} />
        <div className="min-w-0 flex-1">
          <p className={cn("app-shell-title truncate font-semibold text-foreground", onDesignPage ? "text-base" : "text-sm")} data-hidden={(current && LARGE_TITLE.has(current.key) && !titlePast) || undefined}>{screenTitle}</p>
        </div>
        {current?.key === "profile" ? <PupilSwitcher /> : <ProfileLink />}
      </header>
      <OfflineBar />
      <PullToRefresh disabled={conversationOpen}>
        <Outlet />
      </PullToRefresh>
      {!detail && !conversationOpen && <TabBar badges={badges} />}
    </div>
  );
}

/** The showing pupil's avatar at the top right of every screen: it opens Profile. */
function ProfileLink() {
  const { pupils, active } = useAppSelector((state) => state.session);
  const showing = pupils.find((pupil) => pupil.account === active);
  if (!showing) return null;
  return (
    <Link to="/profile" className="app-shell-avatar" aria-label={`${showing.fullName}. My profile`}>
      <PupilAvatar name={showing.fullName} photo={showing.photo} size={36} />
    </Link>
  );
}

/** A count on a tab or a tile, capped so it stays a dot's size. */
function Count({ value, className }: { value?: number; className: string }) {
  if (!value) return null;
  return <span className={className}>{value > 9 ? "9+" : value}</span>;
}

/**
 * The app's tab bar, at every size: the design's split bar. A frosted pill
 * floats above the bottom edge with Home, Timetable, Results and Fees, the
 * screen showing tinted inside it, and beside it a round Inbox button that
 * opens the Inbox, one list of notices and messages. The Inbox button carries
 * both unread counts so nothing new is hidden behind it, and turns blue while
 * the Inbox, or a notice or conversation, is open. It clears the home
 * indicator on phones that have one, and the page scrolls on underneath.
 * The shell leaves it out of a screen with bars of its own (an open
 * conversation, a screen opened from another); `app-shell.css` holds its look.
 */
function TabBar({ badges }: { badges: Partial<Record<NavItem["key"], number>> }) {
  const { pathname } = useLocation();
  const inboxShowing = INBOX.some((item) => item.key === itemFor(pathname)?.key);
  const inboxCount = INBOX.reduce((sum, item) => sum + (badges[item.key] ?? 0), 0);
  return (
    <nav aria-label="Screens" className="app-shell-tabs">
      <div className="tab-bar">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.key} to={item.path} end={item.path === "/"} className="tab-bar-tab">
              <Icon size={22} aria-hidden="true" />
              <span className="tab-bar-label">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
      <Link
        to="/inbox"
        className="tab-bar-inbox"
        data-showing={inboxShowing || undefined}
        aria-current={inboxShowing ? "page" : undefined}
        aria-label={inboxCount ? `Inbox, ${inboxCount} unread` : "Inbox"}
      >
        <Inbox size={23} aria-hidden="true" />
        <Count value={inboxCount} className="tab-bar-inbox-count" />
      </Link>
    </nav>
  );
}
