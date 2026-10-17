import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

import { signInPupil } from "@/auth/device-session";
import { SchoolMark } from "@/components/school-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSchoolName } from "@/lib/use-school-name";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { noticeCleared } from "@/redux/features/session-slice";
import { schoolLogoUrl } from "@/utils/school-brand";
import { currentSchoolSlug } from "@/utils/school-host";

/** School-fe's sign-in, where a staff account that tried this page belongs. */
const SCHOOL_SIGN_IN = "/accounts";
/** School-fe's forgot-password page; the reset link it sends works for pupils too. */
const FORGOT_PASSWORD = "/accounts/forgot-password";

/**
 * Signing a pupil in on this phone.
 *
 * Also "Add another pupil" (`?add=1`): the pupils already on the phone stay
 * signed in, and Cancel goes back to the one showing. A pupil signs in with
 * their admission number or their email; a staff account is turned away with
 * a link to the school's main sign-in, because staff have no student app.
 *
 * The heading is the school's full name ("Meridian Crest Academy"), so the
 * pupil can see whose app this is; an address that names no school reads
 * "XVS Student". A school that has no crest of its own shows the XVS crest.
 */
export function SignInPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { status, notice, pupils } = useAppSelector((s) => s.session);
  // "Add a pupil" with nobody on the phone yet is the plain sign-in.
  const addAsked = params.get("add") === "1";
  const adding = addAsked && pupils.length > 0;
  const slug = currentSchoolSlug();
  const schoolName = useSchoolName();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ message: string; staff?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "signed-in" && !addAsked) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!identifier.trim() || !password) {
      setError({ message: "Enter your admission number or email, and your password." });
      return;
    }
    setBusy(true);
    setError(null);
    const result = await dispatch(signInPupil(identifier, password));
    setBusy(false);
    if (result.ok) {
      navigate("/", { replace: true });
      return;
    }
    setPassword("");
    setError({ message: result.message, staff: result.staff });
  };

  return (
    <main className="grid min-h-dvh grid-cols-1 bg-background md:grid-cols-2">
      <section className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground md:flex">
        <div className="flex items-center gap-3">
          <SchoolMark logo={slug ? schoolLogoUrl(slug) : null} surface="blue" size={40} animate={false} />
          <span className="text-sm font-semibold">{schoolName}</span>
        </div>
        <div className="max-w-sm space-y-3">
          <p className="text-2xl font-semibold">Welcome to your student app</p>
          <p className="text-sm text-primary-foreground/80">
            Your classes, results, attendance and fees, all in one place.
          </p>
        </div>
        <span className="text-xs text-primary-foreground/70">XVS</span>
      </section>

      <section className="flex min-w-0 flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <SchoolMark className="md:hidden" logo={slug ? schoolLogoUrl(slug) : null} size={56} animate={false} />
            {/* Blank, not "XVS Student", while a school's name is read. */}
            <h1 className="min-h-7 break-words text-lg font-semibold text-foreground">
              {slug ? schoolName : "XVS Student"}
            </h1>
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">
              {adding ? "Add another pupil" : "Sign in"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {adding
                ? "They'll be signed in on this phone alongside the others. You can switch between them at any time."
                : "Use your admission number or your email."}
            </p>
          </div>

          {notice && !error && (
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

          {!slug ? (
            <p className="text-sm text-foreground">
              This address doesn&apos;t belong to a school. Open the student app from your
              school&apos;s own address.
            </p>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-foreground">Admission number or email</span>
                <Input
                  name="identifier"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setError(null);
                  }}
                  aria-invalid={!!error}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="flex items-center justify-between text-xs font-medium text-foreground">
                  Password
                  <a href={FORGOT_PASSWORD} className="font-medium text-primary">
                    Forgot password?
                  </a>
                </span>
                <Input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  aria-invalid={!!error}
                />
              </label>

              {error && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {error.message}{" "}
                  {error.staff && (
                    <a href={SCHOOL_SIGN_IN} className="underline underline-offset-2">
                      Go to the school&apos;s sign-in
                    </a>
                  )}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full" loading={busy} disabled={busy}>
                Sign in
              </Button>

              {adding && (
                <Link to="/" className="block text-center text-xs font-medium text-muted-foreground">
                  Cancel
                </Link>
              )}
            </form>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Trouble signing in? Ask your class teacher or the school office.
          </p>
        </div>
      </section>
    </main>
  );
}
