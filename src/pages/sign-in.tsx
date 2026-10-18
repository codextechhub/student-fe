import { useState, type FormEvent } from "react";
import { ArrowRight, ChevronDown, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

import { signInPupil } from "@/auth/device-session";
import { PupilAvatar } from "@/components/pupil-avatar";
import { SchoolMark } from "@/components/school-mark";
import { useSchoolName } from "@/lib/use-school-name";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { noticeCleared } from "@/redux/features/session-slice";
import { schoolLogoUrl } from "@/utils/school-brand";
import { currentSchoolSlug } from "@/utils/school-host";

import "./sign-in.css";

const SCHOOL_SIGN_IN = "/accounts";
const FORGOT_PASSWORD = "/accounts/forgot-password";

/** Signing in a first pupil, or adding another without ending the pupil already on this phone. */
export function SignInPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { status, notice, pupils, active } = useAppSelector((state) => state.session);
  const addAsked = params.get("add") === "1";
  const adding = addAsked && pupils.length > 0;
  const showing = pupils.find((pupil) => pupil.account === active);
  const slug = currentSchoolSlug();
  const schoolName = useSchoolName();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
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
    setPasswordVisible(false);
    setError({ message: result.message, staff: result.staff });
  };

  return (
    <main className="signin-page">
      <div className="signin-stage">
        <section className="signin-welcome" aria-label="Welcome">
          <div className="signin-brand">
            <span className="signin-crest"><SchoolMark logo={slug ? schoolLogoUrl(slug) : null} size={39} animate={false} alt={schoolName || "School crest"} /></span>
            <span><strong>{schoolName || "Student app"}</strong><small>Student app</small></span>
          </div>
          <div className="signin-welcome-copy">
            <p className="signin-kicker">Your school, on your phone</p>
            <h1>{adding ? "Make room for one more." : "Your school day starts here."}</h1>
            <p>{adding ? `Add another pupil to this phone. ${showing?.firstName ?? "The current pupil"} stays signed in.` : "Classes, results, attendance and fees in one calm place."}</p>
            {adding && showing && <span className="signin-showing"><PupilAvatar name={showing.fullName} photo={showing.photo} size={29} />{showing.firstName}<ChevronDown size={15} aria-hidden="true" /></span>}
          </div>
          <p className="signin-welcome-foot"><LockKeyhole size={17} aria-hidden="true" />One phone can hold more than one pupil</p>
        </section>

        <section className="signin-area" aria-label={adding ? "Add another pupil" : "Sign in"}>
          <div className="signin-card">
            <p className="signin-card-kicker">{adding ? "Shared phone" : "Welcome back"}</p>
            <h2>{adding ? "Add another pupil" : "Sign in"}</h2>
            {adding && <>
              <p className="signin-card-intro">They&apos;ll be signed in alongside {showing?.firstName ?? "the current pupil"}. You can switch between pupils any time.</p>
              {showing && <div className="signin-existing"><PupilAvatar name={showing.fullName} photo={showing.photo} size={39} /><div><span>Already on this phone</span><strong>{showing.fullName}</strong></div></div>}
            </>}
            {notice && !error && <div className="signin-notice" role="status"><span>{notice}</span><button type="button" onClick={() => dispatch(noticeCleared())}>Dismiss</button></div>}
            {!slug ? (
              <div className="signin-error" role="alert">This address doesn&apos;t belong to a school. Open the student app from your school&apos;s own address.</div>
            ) : (
              <form className="signin-form" onSubmit={submit} noValidate>
                <div className="signin-field">
                  <label htmlFor="signin-identifier">Admission number or email</label>
                  <input id="signin-identifier" name="identifier" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="e.g. LVS/2026/0184" value={identifier} aria-invalid={!!error} onChange={(event) => { setIdentifier(event.target.value); setError(null); }} />
                </div>
                <div className="signin-field">
                  <label htmlFor="signin-password">Password</label>
                  <div className="signin-password-wrap">
                    <input id="signin-password" name="password" type={passwordVisible ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} aria-invalid={!!error} onChange={(event) => { setPassword(event.target.value); setError(null); }} />
                    <button type="button" className="signin-visibility" aria-label={passwordVisible ? "Hide password" : "Show password"} aria-pressed={passwordVisible} title={passwordVisible ? "Hide password" : "Show password"} onClick={() => setPasswordVisible((visible) => !visible)}>
                      {passwordVisible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                <a className="signin-forgot" href={FORGOT_PASSWORD}>Forgot password?</a>
                {error && <div className="signin-error" role="alert">{error.message}{error.staff && <><br /><a href={SCHOOL_SIGN_IN}>Go to the school&apos;s sign-in</a></>}</div>}
                <button type="submit" className="signin-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<ArrowRight size={18} aria-hidden="true" /></button>
                {adding && <Link to="/" className="signin-cancel">Cancel and return to {showing?.firstName ?? "the current pupil"}</Link>}
              </form>
            )}
            <p className="signin-helper">Trouble signing in? <strong>Ask your class teacher or the school office.</strong></p>
          </div>
        </section>
      </div>
    </main>
  );
}
