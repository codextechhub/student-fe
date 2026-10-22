import { useEffect, useState, type CSSProperties } from "react";
import { MoreHorizontal } from "lucide-react";
import { Dialog } from "radix-ui";
import { NavLink, Outlet, useLocation } from "react-router";

import { refreshShowingPupil } from "@/auth/device-session";
import { SchoolMark } from "@/components/school-mark";
import { PupilSwitcher } from "@/components/session/pupil-switcher";
import { useVisualViewportBox } from "@/lib/visual-viewport";
import { cn } from "@/lib/utils";
import { useAppDispatch } from "@/redux/hooks";
import { useUnreadMessagesQuery } from "@/redux/services/messages-api";
import { useMeQuery, useNoticesQuery } from "@/redux/services/portal-api";

import { isConversationPath, itemFor, NAV, splitTabs, type NavItem } from "./nav";
import { OfflineBar } from "./offline-bar";
import { PullToRefresh } from "./pull-to-refresh";
import "./app-shell.css";

/** How often the Messages badge asks the school for the unread count, in milliseconds. */
const MESSAGE_BADGE_POLL_MS = 60_000;

/**
 * The frame every signed-in screen sits in.
 *
 * At every size the screens are a floating tab bar at the bottom (More once
 * there are too many for it), and the header carries the school's crest, the
 * screen title and the pupil switcher. The offline bar sits under the header
 * whenever the app is showing kept data, and a pull down from the top of a
 * screen reads everything on it again.
 *
 * An open Messages conversation is the one screen that does not scroll as a
 * page. The shell is held to the visible height (`100dvh`, narrowed to
 * `visualViewport` so the message box rides above the phone keyboard), the
 * conversation fills the screen, and on a phone the shell's own header (crest,
 * title, pupil switcher) and the tab bar both step aside, so the conversation's
 * header with its back arrow is the top of the screen, as in a messaging app.
 * Both return on the list, where the pupil switcher stays reachable. From 800px,
 * where the list sits beside the thread, the shell header and tab bar stay.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(() => window.scrollY > 8);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
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
  const viewport = useVisualViewportBox(conversationOpen);
  const onDesignPage = pathname === "/" || pathname === "/timetable" || pathname.startsWith("/results") || pathname === "/attendance" || pathname === "/profile" || pathname.startsWith("/fees") || pathname.startsWith("/notices") || pathname.startsWith("/messages");
  const badges: Partial<Record<NavItem["key"], number>> = { notices: unread, messages: unreadMessages };
  const where = [me?.school.name, me?.show_branch ? me?.branch?.name : null].filter(Boolean).join(" · ");
  const screenTitle = pathname.startsWith("/results/card/") ? "Report card" : pathname.startsWith("/fees/receipts/") ? "Payment receipt" : pathname.startsWith("/fees/pay/") ? "Pay a bill" : pathname === "/fees/paid" ? "Payment status" : current?.key === "fees" ? "My fees" : current?.key === "attendance" ? "My attendance" : current?.key === "timetable" ? "My timetable" : current?.key === "results" ? "My results" : current?.key === "profile" ? "My profile" : current?.label ?? "";

  return (
    <div
      className={cn("app-shell flex min-h-dvh min-w-0 flex-col bg-background pb-[calc(6rem+env(safe-area-inset-bottom))]", onDesignPage && "app-shell--design", conversationOpen && "app-shell--conversation", viewport?.keyboard && "is-keyboard")}
      style={viewport ? ({ "--vv-top": `${viewport.top}px`, "--vv-height": `${viewport.height}px` } as CSSProperties) : undefined}
    >
      <header data-hidden-on-phone={conversationOpen || undefined} className={cn("app-shell-head sticky top-0 z-30 flex min-h-[58px] min-w-0 items-center gap-3 border-b px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 transition-[background-color,backdrop-filter,border-color] duration-200 sm:min-h-[66px] lg:px-6", onDesignPage ? scrolled ? "border-[#dbe0eb] bg-[#f5f7fc]/70 backdrop-blur-xl backdrop-saturate-150" : "border-transparent bg-transparent" : scrolled ? "border-border bg-background/75 backdrop-blur-xl" : "border-border bg-background")}>
        <SchoolMark logo={me?.school.logo_url || null} size={onDesignPage ? 34 : 28} animate={false} alt={where} className={onDesignPage ? "max-h-7 sm:max-h-[34px]" : undefined} />
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-semibold text-foreground", onDesignPage ? "text-base" : "text-sm")}>{screenTitle}</p>
        </div>
        <PupilSwitcher />
      </header>
      <OfflineBar />
      <PullToRefresh disabled={conversationOpen}>
        <Outlet />
      </PullToRefresh>
      <TabBar badges={badges} hiddenOnPhone={conversationOpen} />
    </div>
  );
}

function Badge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function RailLink({ item, badge }: { item: NavItem; badge?: number }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
          isActive ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-accent",
        )
      }
    >
      <Icon className="size-4.5 shrink-0" />
      <span className="truncate">{item.label}</span>
      <Badge count={badge} />
    </NavLink>
  );
}

/** One tab's look: a pill that is raised and white when it is the screen showing. */
const TAB =
  "relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] transition-colors";

/**
 * The app's tab bar, at every size: a frosted pill floating above the bottom
 * edge, the screen showing raised inside it as its own pill. It clears the
 * home indicator on phones that have one, and the page scrolls on underneath.
 * `hiddenOnPhone` takes it off screens narrower than 800px (an open
 * conversation); `app-shell.css` holds the breakpoint.
 */
function TabBar({ badges, hiddenOnPhone }: { badges: Partial<Record<NavItem["key"], number>>; hiddenOnPhone: boolean }) {
  const { tabs, more } = splitTabs(NAV);
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  // More stands for the screens under it: picked out when one is open, and
  // carrying their unread counts so a new notice is not hidden behind it.
  const moreShowing = more.some((item) => item.key === itemFor(pathname)?.key);
  const moreCount = more.reduce((sum, item) => sum + (badges[item.key] ?? 0), 0);
  const activeIndex = moreShowing ? tabs.length : Math.max(0, tabs.findIndex((item) => item.key === itemFor(pathname)?.key));
  const tabCount = tabs.length + (more.length > 0 ? 1 : 0);
  return (
    <nav
      aria-label="Screens"
      data-hidden-on-phone={hiddenOnPhone || undefined}
      className="app-shell-tabs pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto relative flex w-full max-w-md gap-1 rounded-full border border-white/70 bg-white/70 p-1.5 shadow-[0_10px_30px_-8px_rgba(17,24,39,0.25)] ring-1 ring-black/5 backdrop-blur-xl backdrop-saturate-150">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-1.5 left-1.5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `calc((100% - 12px - ${(tabCount - 1) * 4}px) / ${tabCount})`, transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * 4}px))` }}
        />
        {tabs.map((item) => {
          const Icon = item.icon;
          const count = badges[item.key];
          return (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                cn(
                  TAB,
                  isActive
                    ? "font-medium text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <span className="relative">
                <Icon className="size-5" />
                {!!count && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-primary px-1 text-center text-[11px] leading-4 font-semibold text-primary-foreground">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
        {more.length > 0 && (
          <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
            <Dialog.Trigger
              className={cn(
                TAB,
                moreShowing
                  ? "font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="relative">
                <MoreHorizontal className="size-5" />
                {moreCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-primary px-1 text-center text-[11px] leading-4 font-semibold text-primary-foreground">
                    {moreCount > 9 ? "9+" : moreCount}
                  </span>
                )}
              </span>
              More
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
              <Dialog.Content
                aria-describedby={undefined}
                className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-border bg-background p-3 pb-[max(1rem,env(safe-area-inset-bottom))] outline-none sm:inset-x-auto sm:bottom-24 sm:left-1/2 sm:w-96 sm:-translate-x-1/2 sm:rounded-2xl"
              >
                <Dialog.Title className="px-3 pb-2 text-xs font-medium text-muted-foreground">More</Dialog.Title>
                {more.map((item) => (
                  <div key={item.key} onClick={() => setMoreOpen(false)}>
                    <RailLink item={item} badge={badges[item.key]} />
                  </div>
                ))}
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}
      </div>
    </nav>
  );
}
