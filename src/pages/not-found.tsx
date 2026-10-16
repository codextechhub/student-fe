import { Link } from "react-router";

import { PageShell } from "@/components/layout/page-shell";

/** Any address under `/student/` the app does not have. */
export function NotFoundPage() {
  return (
    <PageShell className="flex min-h-dvh flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-base font-semibold text-foreground">This page does not exist</h1>
      <Link to="/" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
        Go to the start page
      </Link>
    </PageShell>
  );
}
