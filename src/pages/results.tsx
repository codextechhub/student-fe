import { useState, type ReactNode } from "react";
import { FileText } from "lucide-react";
import { Link } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { formatDate, formatTimestampDate } from "@/lib/format";
import { cellsLine, movement, movementLabel, percent, teachersBySubject, termsReleasedLine } from "@/lib/results";
import { cn } from "@/lib/utils";
import {
  useResultsQuery,
  useSessionResultsQuery,
  type SessionResults,
  type TermResult,
} from "@/redux/services/portal-api";

/**
 * The pupil's results: one term at a time, or the whole school year.
 *
 * Only released results are shown. A term the school is holding says so in
 * the school's own sentence and shows no figure; a pupil with nothing
 * published yet is told that. Position appears only where the school ranks,
 * and class averages only where it shows class figures: a figure the API does
 * not send leaves no gap.
 *
 * Each released term has its report card, and the year's last term's card is
 * the annual one; both open as their own page so they print cleanly.
 */
export function ResultsPage() {
  const [tab, setTab] = useState<"term" | "session">("term");
  return (
    <PageShell grid className="mx-auto w-full max-w-5xl content-start gap-4 pt-4 lg:px-6">
      <PageHeader title="My results" description="Released results only. Ask the school office about a result you expected to see." />
      <div role="tablist" aria-label="Results" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1">
        {(["term", "session"] as const).map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-medium whitespace-nowrap",
              tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {key === "term" ? "This term" : "Full session"}
          </button>
        ))}
      </div>
      {tab === "term" ? <TermTab /> : <SessionTab />}
    </PageShell>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate font-mono text-lg font-semibold text-foreground">{value}</p>
      {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">{children}</p>;
}

const GRADE_CHIP: Record<string, string> = {
  A: "bg-green-100 text-green-800",
  B: "bg-green-100 text-green-800",
  C: "bg-amber-100 text-amber-800",
};

function GradeChip({ grade }: { grade: string | null | undefined }) {
  if (!grade) return null;
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", GRADE_CHIP[grade] ?? "bg-red-100 text-red-700")}>
      {grade}
    </span>
  );
}

function CardLink({ termId, children }: { termId: number; children: ReactNode }) {
  return (
    <Link
      to={`/results/card/${termId}`}
      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
    >
      <FileText className="size-4" />
      {children}
    </Link>
  );
}

function TermTab() {
  const [term, setTerm] = useState<number | null>(null);
  const { data, isLoading, isError, isFetching, refetch } = useResultsQuery(term);

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
  if (isError && !data) {
    return (
      <p className="rounded-xl border border-border p-4 text-xs text-muted-foreground">
        Your results can&apos;t be shown right now.{" "}
        <button type="button" className="font-medium text-primary" onClick={() => refetch()}>
          Try again
        </button>
      </p>
    );
  }
  if (!data) return null;
  if (data.state === "not_published") return <Notice>No results have been published for you yet.</Notice>;

  return (
    <div className={cn("grid min-w-0 gap-4", isFetching && "opacity-60")}>
      {data.terms.length > 1 && (
        <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          Term
          <select
            value={data.term?.id ?? ""}
            onChange={(e) => setTerm(Number(e.target.value))}
            className="h-9 rounded-md border border-border bg-background px-2 text-base text-foreground md:text-sm"
          >
            {[...data.terms].reverse().map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.session}
                {t.state === "withheld" ? " (held)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {data.state === "withheld" ? (
        <Notice>{data.message}</Notice>
      ) : (
        <ReleasedTerm result={data} />
      )}
    </div>
  );
}

function ReleasedTerm({ result }: { result: TermResult }) {
  const summary = result.summary;
  const subjects = result.subjects ?? [];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Term average" value={percent(summary?.overall_average)} sub={summary?.class_average ? `Class average ${percent(summary.class_average)}` : undefined} />
        {summary?.position_label && <Tile label="Position" value={summary.position_label.split(" of ")[0]} sub={`of ${summary.position_label.split(" of ")[1] ?? ""} in ${result.class_name ?? "the class"}`} />}
        <Tile label="Subjects" value={String(summary?.subjects ?? subjects.length)} sub={result.class_name} />
        <Tile label="Term" value={result.term?.name ?? ""} sub={result.term?.session} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ul className="grid min-w-0 content-start gap-3">
          {subjects.map((subject) => {
            const pct = Number(subject.percentage ?? 0);
            return (
              <li key={subject.name} className="min-w-0 rounded-xl border border-border p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{subject.name}</p>
                    {subject.teacher && <p className="truncate text-xs text-muted-foreground">{subject.teacher}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">{percent(subject.percentage, 0)}</span>
                    <GradeChip grade={subject.grade} />
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{cellsLine(subject)}</span>
                  {subject.remark && <span>{subject.remark}</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="grid min-w-0 content-start gap-4">
          <section className="min-w-0 rounded-xl border border-border p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">By subject</h2>
            <div className="flex h-40 items-end gap-3" role="img" aria-label="Scores by subject, out of 100">
              {subjects.map((subject) => {
                const pct = Math.max(0, Math.min(100, Number(subject.percentage ?? 0)));
                return (
                  <div key={subject.name} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[11px] font-medium text-foreground">{Math.round(pct)}</span>
                    {/* Pixels, not a percentage: a percentage height has no box to be a share of here. */}
                    <div className="w-full max-w-10 rounded-t-md bg-primary" style={{ height: `${Math.max(2, Math.round(pct * 1.1))}px` }} />
                    <span className="w-full truncate text-center text-[10px] text-muted-foreground">{subject.name.split(" ")[0]}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Scores out of 100 · {result.term?.name}</p>
          </section>
          {result.teacher_comment && (
            <section className="min-w-0 rounded-xl border border-border p-4">
              <h2 className="mb-1 text-sm font-semibold text-foreground">Class teacher&apos;s remark</h2>
              <p className="text-sm text-foreground">{result.teacher_comment}</p>
              {result.class_teacher && <p className="mt-1 text-xs text-muted-foreground">{result.class_teacher}</p>}
            </section>
          )}
          {result.term && (
            <section className="min-w-0 rounded-xl border border-border p-4">
              <h2 className="mb-1 text-sm font-semibold text-foreground">{result.term.name} report card</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                This term only, as the school printed it. The year&apos;s card is under Full session.
              </p>
              <CardLink termId={result.term.id}>View term report card</CardLink>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function SessionTab() {
  const { data, isLoading, isError, refetch } = useSessionResultsQuery();
  const latestTerm = data?.terms.filter((t) => t.state === "released").at(-1);
  const { data: latest } = useResultsQuery(latestTerm?.id ?? null, { skip: !latestTerm });

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
  if (isError && !data) {
    return (
      <p className="rounded-xl border border-border p-4 text-xs text-muted-foreground">
        Your results for the year can&apos;t be shown right now.{" "}
        <button type="button" className="font-medium text-primary" onClick={() => refetch()}>
          Try again
        </button>
      </p>
    );
  }
  if (!data) return null;
  if (data.state === "not_published") return <Notice>No results have been published for you yet.</Notice>;
  if (!data.terms_released) {
    return <Notice>Your results for this year are being held by the school. Ask the school office when they will be available.</Notice>;
  }
  return <SessionView session={data} teachers={teachersBySubject(latest?.subjects)} />;
}

function SessionView({ session, teachers }: { session: SessionResults; teachers: Map<string, string> }) {
  const cumulative = session.cumulative;
  const released = session.terms.filter((t) => t.state === "released");
  const last = released.at(-1);
  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Year average"
          value={cumulative ? percent(cumulative.annual_average) : "-"}
          sub={cumulative?.class_average ? `Class average ${percent(cumulative.class_average)}` : cumulative ? undefined : "When the last term is out"}
        />
        {cumulative?.annual_position_label && (
          <Tile label="Year position" value={cumulative.annual_position_label.split(" of ")[0]} sub={`of ${cumulative.annual_position_label.split(" of ")[1] ?? ""} for the year`} />
        )}
        <Tile label="Terms released" value={termsReleasedLine(session)} sub={session.session?.name} />
        {cumulative?.promotion && <Tile label="Promotion" value={cumulative.promotion} />}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {session.terms.map((term) => (
          <div key={term.id} className={cn("min-w-0 rounded-xl border p-4", term.id === last?.id ? "border-primary" : "border-border")}>
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{term.name}</p>
              {term.id === last?.id && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Latest</span>}
            </div>
            {term.state === "withheld" ? (
              <p className="mt-2 text-xs text-muted-foreground">Held by the school.</p>
            ) : (
              <>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-lg font-semibold text-foreground">{percent(term.average)}</span>
                  {term.position_label && <span className="text-xs text-muted-foreground">{term.position_label}</span>}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, Number(term.average ?? 0)))}%` }} />
                </div>
                {term.class_average && <p className="mt-2 text-[11px] text-muted-foreground">Class average {percent(term.class_average)}</p>}
              </>
            )}
          </div>
        ))}
      </div>

      {cumulative ? (
        <>
          <section className="min-w-0 rounded-xl border border-border p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Every subject, all {cumulative.terms.length} terms</h2>
              <span className="text-[11px] text-muted-foreground">Year average = the average of your term scores</span>
            </div>
            <ScrollArea className="w-full">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-[11px] text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Subject</th>
                    {cumulative.terms.map((t) => (
                      <th key={t.id} className="px-2 py-2 text-right font-medium">{t.name.split(" ")[0]}</th>
                    ))}
                    <th className="px-2 py-2 text-right font-medium">Year</th>
                    <th className="py-2 pl-3 font-medium">Across the year</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cumulative.subjects.map((subject) => {
                    const move = movement(subject.terms);
                    return (
                      <tr key={subject.name}>
                        <td className="py-2 pr-3">
                          <p className="text-sm text-foreground">{subject.name}</p>
                          {teachers.get(subject.name) && <p className="text-[11px] text-muted-foreground">{teachers.get(subject.name)}</p>}
                        </td>
                        {subject.terms.map((t, i) => (
                          <td key={i} className="px-2 py-2 text-right font-mono text-xs tabular-nums">{t.percentage === null ? "-" : Math.round(Number(t.percentage))}</td>
                        ))}
                        <td className="px-2 py-2 text-right">
                          <span className="font-mono text-xs font-semibold">{percent(subject.annual_average)}</span>{" "}
                          <GradeChip grade={subject.annual_grade} />
                        </td>
                        <td className="py-2 pl-3">
                          <div className="flex items-end gap-1" aria-hidden="true">
                            {subject.terms.map((t, i) => (
                              <span
                                key={i}
                                title={`${t.term}: ${t.percentage ?? "-"}`}
                                className={cn("w-2.5 rounded-sm", i === subject.terms.length - 1 ? "bg-primary" : "bg-primary/40")}
                                style={{ height: `${Math.max(4, Math.round(Number(t.percentage ?? 0) * 0.3))}px` }}
                              />
                            ))}
                          </div>
                          {move && (
                            <p className={cn("mt-1 text-[11px]", move.direction === "up" ? "text-green-700" : move.direction === "down" ? "text-amber-700" : "text-muted-foreground")}>
                              {movementLabel(move)}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section className="min-w-0 rounded-xl border border-border p-4">
              {cumulative.promotion && <p className="mb-3 text-sm font-semibold text-foreground">{cumulative.promotion}</p>}
              {cumulative.remark && (
                <>
                  <h2 className="mb-1 text-xs font-medium text-muted-foreground">Class teacher&apos;s remark for the year</h2>
                  <p className="text-sm text-foreground">{cumulative.remark}</p>
                </>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {[cumulative.class_teacher, session.next_term_begins ? `next session begins ${formatDate(session.next_term_begins)}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </section>
            {last && (
              <section className="min-w-0 rounded-xl border border-border p-4">
                <h2 className="mb-1 text-sm font-semibold text-foreground">Annual report card</h2>
                <p className="mb-3 text-xs text-muted-foreground">
                  Every term on one sheet, with the year&apos;s average and the promotion decision.
                </p>
                <CardLink termId={last.id}>View annual report card</CardLink>
                {last.released_at && (
                  <p className="mt-2 text-[11px] text-muted-foreground">Published {formatTimestampDate(last.released_at)} by the school</p>
                )}
              </section>
            )}
          </div>
        </>
      ) : (
        <Notice>The year&apos;s summary appears here once the year&apos;s last term is released.</Notice>
      )}
    </div>
  );
}
