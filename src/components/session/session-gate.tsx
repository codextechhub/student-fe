import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { bootSession } from "@/auth/device-session";
import { LoadingMark } from "@/components/loading-mark";
import { SchoolMark } from "@/components/school-mark";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { sessionSettled } from "@/redux/features/session-slice";
import { ALL_TAGS, baseApi } from "@/redux/services/base-api";
import { useSchoolNameQuery } from "@/redux/services/school-api";
import { schoolLogoUrl } from "@/utils/school-brand";
import { currentSchoolSlug } from "@/utils/school-host";

/**
 * Opens the app once, then keeps every signed-in screen behind a working
 * sign-in.
 *
 * While the phone's pupils are read and refreshed it shows the loading mark.
 * With nobody to show it sends the reader to sign in. When the school cannot
 * be reached it says so and offers to try again, without signing anybody out:
 * a pupil on a bus with no signal is still signed in when the signal returns.
 */
export function SessionBoot({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(bootSession());
  }, [dispatch]);
  // Back online: read everything on screen again, which also clears the offline bar.
  useEffect(() => {
    const again = () => dispatch(baseApi.util.invalidateTags([...ALL_TAGS]));
    window.addEventListener("online", again);
    return () => window.removeEventListener("online", again);
  }, [dispatch]);
  return <>{children}</>;
}

/** Renders `children` only for a signed-in pupil; the key remounts them on a switch. */
export function SignedIn({ children }: { children: ReactNode }) {
  const { status, active } = useAppSelector((s) => s.session);
  const location = useLocation();
  if (status === "booting") return <Booting />;
  if (status === "unreachable") return <Unreachable />;
  if (status !== "signed-in" || !active) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }
  return <div key={active} className="contents">{children}</div>;
}

function Booting() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <LoadingMark className="h-28" />
    </div>
  );
}

function Unreachable() {
  const dispatch = useAppDispatch();
  const slug = currentSchoolSlug();
  const { data: schoolName } = useSchoolNameQuery(slug, { skip: !slug });
  const { pupils } = useAppSelector((s) => s.session);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5 text-center">
      <SchoolMark logo={slug ? schoolLogoUrl(slug) : null} size={56} animate={false} />
      <h1 className="text-base font-semibold text-foreground">
        We can&apos;t reach {schoolName || "your school"} right now
      </h1>
      <p className="max-w-xs text-xs text-muted-foreground">
        Check your connection and try again. Nobody has been signed out.
      </p>
      <Button
        onClick={() => {
          dispatch(sessionSettled({ status: "booting", pupils, active: null }));
          dispatch(bootSession());
        }}
      >
        Try again
      </Button>
    </main>
  );
}
