import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { PupilAvatar } from "@/components/pupil-avatar";
import { SchoolMark } from "@/components/school-mark";
import { PupilSwitcher } from "@/components/session/pupil-switcher";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { noticeCleared } from "@/redux/features/session-slice";
import { useMeQuery, type Me } from "@/redux/services/portal-api";

/** The pupil's class, naming the year when it is next year's ("JSS2 A (from 2027/2028)"). */
function classLine(me: Me): string {
  const { class_name, class_is_next_year } = me.student;
  if (!class_name) return "";
  return class_is_next_year && me.session ? `${class_name} (from ${me.session.name})` : class_name;
}

/**
 * The signed-in pupil's first screen: who they are, at which school, in which
 * class and term, read from `me/`.
 *
 * The header carries the school's crest and the pupil switcher. The Home
 * screen's own blocks (today's classes, attendance, fees, the latest notice)
 * replace the card below when they are built.
 */
export function HomePage() {
  const dispatch = useAppDispatch();
  const notice = useAppSelector((s) => s.session.notice);
  const { data: me, isLoading, isError, refetch } = useMeQuery();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <SchoolMark logo={me?.school.logo_url || null} size={28} animate={false} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {me?.school.name}
        </span>
        <PupilSwitcher />
      </header>

      <PageShell grid className="mx-auto max-w-2xl content-start gap-4">
        {notice && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
          >
            <span className="min-w-0 flex-1">{notice}</span>
            <button type="button" className="font-medium" onClick={() => dispatch(noticeCleared())}>
              Dismiss
            </button>
          </div>
        )}

        <PageHeader
          title={me ? `Hi, ${me.student.first_name}` : "Home"}
          description={me ? [me.session?.name, me.term?.name].filter(Boolean).join(" · ") : ""}
        />

        {isLoading && <div className="h-28 animate-pulse rounded-xl bg-muted" />}
        {isError && (
          <div className="rounded-xl border border-border p-4 text-xs text-muted-foreground">
            Your details can&apos;t be shown right now.{" "}
            <button type="button" className="font-medium text-primary" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        )}
        {me && (
          <section className="flex min-w-0 items-center gap-4 rounded-xl border border-border p-4">
            <PupilAvatar name={me.student.full_name} photo={me.student.photo_url} size={56} />
            <dl className="min-w-0 space-y-0.5 text-xs text-muted-foreground">
              <dt className="sr-only">Name</dt>
              <dd className="truncate text-sm font-semibold text-foreground">{me.student.full_name}</dd>
              <dt className="sr-only">Class and admission number</dt>
              <dd className="truncate">
                {[classLine(me), me.student.admission_number].filter(Boolean).join(" · ")}
              </dd>
              <dt className="sr-only">School</dt>
              <dd className="truncate">
                {[me.school.name, me.show_branch ? me.branch?.name : null].filter(Boolean).join(" · ")}
              </dd>
            </dl>
          </section>
        )}
      </PageShell>
    </div>
  );
}
