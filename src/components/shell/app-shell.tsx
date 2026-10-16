import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Dialog } from "radix-ui";
import { NavLink, Outlet, useLocation } from "react-router";

import { refreshShowingPupil } from "@/auth/device-session";
import { SchoolMark } from "@/components/school-mark";
import { PupilSwitcher } from "@/components/session/pupil-switcher";
import { cn } from "@/lib/utils";
import { useAppDispatch } from "@/redux/hooks";
import { useMeQuery, useNoticesQuery } from "@/redux/services/portal-api";

import { itemFor, NAV, splitTabs, type NavItem } from "./nav";
import { OfflineBar } from "./offline-bar";
import { PullToRefresh } from "./pull-to-refresh";

/**
 * The frame every signed-in screen sits in.
 *
 * At every size the screens are a floating tab bar at the bottom (More once
 * there are too many for it), and the header carries the school's crest and
 * name, the screen's title and the pupil switcher. The offline bar sits under
 * the header whenever the app is showing kept data, and a pull down from the
 * top of a screen reads everything on it again.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const dispatch = useAppDispatch();
  const { data: me } = useMeQuery();
  // Keep the switcher's saved name and photo in step with the latest me/.
  useEffect(() => {
    if (me) void dispatch(refreshShowingPupil(me));
  }, [me, dispatch]);
  const { data: noticePage } = useNoticesQuery(1);
  const unread = noticePage?.unreadCount ?? 0;
  const current = itemFor(pathname);
  const badges: Partial<Record<NavItem["key"], number>> = { notices: unread };
  const where = [me?.school.name, me?.show_branch ? me?.branch?.name : null].filter(Boolean).join(" · ");
  const when = [me?.session?.name, me?.term?.name].filter(Boolean).join(" · ");

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-background pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 flex min-w-0 items-center gap-3 border-b border-border bg-background/95 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur lg:px-6">
        <SchoolMark logo={me?.school.logo_url || null} size={28} animate={false} alt={where} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{current?.label ?? ""}</p>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            {[where, when].filter(Boolean).join(" · ")}
          </p>
        </div>
        <PupilSwitcher />
      </header>
      <OfflineBar />
      <PullToRefresh>
        <Outlet />
      </PullToRefresh>
      <TabBar badges={badges} />
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
 */
function TabBar({ badges }: { badges: Partial<Record<NavItem["key"], number>> }) {
  const { tabs, more } = splitTabs(NAV);
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  // More stands for the screens under it: picked out when one is open, and
  // carrying their unread counts so a new notice is not hidden behind it.
  const moreShowing = more.some((item) => item.key === itemFor(pathname)?.key);
  const moreCount = more.reduce((sum, item) => sum + (badges[item.key] ?? 0), 0);
  return (
    <nav
      aria-label="Screens"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto flex w-full max-w-md gap-1 rounded-full border border-white/70 bg-white/70 p-1.5 shadow-[0_10px_30px_-8px_rgba(17,24,39,0.25)] ring-1 ring-black/5 backdrop-blur-xl backdrop-saturate-150">
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
                    ? "bg-white font-medium text-primary shadow-sm ring-1 ring-black/5"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <span className="relative">
                <Icon className="size-5" />
                {!!count && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-semibold text-primary-foreground">
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
                  ? "bg-white font-medium text-primary shadow-sm ring-1 ring-black/5"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="relative">
                <MoreHorizontal className="size-5" />
                {moreCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-semibold text-primary-foreground">
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
