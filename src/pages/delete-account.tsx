import { useState } from "react";
import { Clock3, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { leaveAfterClosure } from "@/auth/device-session";
import { PageShell } from "@/components/layout/page-shell";
import { BottomBar, DetailBar, ScreenTitle } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { pendingSentence, REQUEST_SENTENCE } from "@/lib/closure-words";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  closureOffered,
  useClosureStateQuery,
  useConfirmClosureMutation,
} from "@/redux/services/account-closure-api";
import { refusal } from "@/redux/services/portal-api";

import "./delete-account.css";

/**
 * Deleting the pupil's own account, from Profile (design 5l; web and store
 * app alike, as the app stores require it inside the app). A screen of its
 * own: the "My profile" pill, the large title, a card saying what happens,
 * and the red button with "Keep my account" under it at the foot.
 *
 * A pupil's request goes to the school, which decides, and the pupil keeps
 * using the app meanwhile. The card says exactly that before the button, and
 * once a request is waiting an amber note gives the date instead of the
 * buttons. An account the API does not offer deletion for (a 403, or not
 * eligible) is told to ask the school office. Where an account closes at
 * once, the card says so, and on success the pupil is taken off this phone:
 * their stored credential, offline copy and notification choice are
 * discarded, and the next pupil on the phone is shown, or the sign-in screen.
 */
export function DeleteAccountPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const account = useAppSelector((s) => s.session.active);
  const offline = useAppSelector((s) => s.connectivity.offline);
  const { data: state, isFetching, isError, error, refetch } = useClosureStateQuery();
  const [confirm, { isLoading: sending }] = useConfirmClosureMutation();
  const [problem, setProblem] = useState("");
  const [sent, setSent] = useState(false);
  const closesNow = state?.mode === "close";
  const notOffered = (isError && (error as { status?: unknown })?.status === 403) || (!!state && !closureOffered(state));
  const offered = !!state && closureOffered(state);
  const waiting = !!state?.pending || sent;

  const submit = async () => {
    setProblem("");
    try {
      const outcome = await confirm().unwrap();
      if (outcome.status === "closed") {
        if (account) await dispatch(leaveAfterClosure(account));
        navigate("/", { replace: true });
        return;
      }
      setSent(true);
      void refetch();
    } catch (failure) {
      setProblem(refusal(failure).message);
    }
  };

  return (
    <PageShell className="delete-page">
      <DetailBar back="/profile" backText="My profile" backLabel="Back to my profile" />
      <div className="delete-wrap">
        <ScreenTitle title="Delete my account" />
        {/* While asking, a retry included: RTK reports neither loading nor an error then. */}
        {isFetching && !state && <div className="delete-loading" role="status" aria-label="Loading" />}
        {isError && !isFetching && !notOffered && !state && (
          <section className="screen-card delete-card" role="alert">
            <p className="delete-lead">Deleting your account can&apos;t be checked right now.</p>
            <button type="button" className="xs-button xs-button--plain delete-retry" onClick={() => void refetch()}>Try again</button>
          </section>
        )}
        {notOffered && (
          <section className="screen-card delete-card">
            <p className="delete-lead">Deleting your account isn&apos;t available here for this account. Ask the school office for help.</p>
          </section>
        )}
        {offered && (
          <section className="screen-card delete-card">
            <span className="delete-icon"><Trash2 size={21} aria-hidden="true" /></span>
            {closesNow
              ? <p className="delete-lead"><strong>Your account will be deleted now</strong> and you will be signed out on this device.</p>
              : <p className="delete-lead">{REQUEST_SENTENCE}</p>}
            {!closesNow && !waiting && <p className="delete-sub">You can keep using the app until the school has acted on your request.</p>}
          </section>
        )}
        {offered && waiting && (
          <div className="delete-note" role="status">
            <Clock3 size={17} aria-hidden="true" />
            <span>{sent
              ? "Your request has been sent to your school. You can keep using the app until the school has acted on it."
              : `${pendingSentence(state.pending!.requested_at)} You can keep using the app until the school has acted on it.`}</span>
          </div>
        )}
        {offered && !waiting && problem && <p className="delete-error" role="alert">{problem}</p>}
        {offered && !waiting && offline && <p className="delete-offline">You can send this when you&apos;re back online.</p>}
      </div>
      <BottomBar>
        <div className="delete-actions">
          {offered && !waiting ? (
            <>
              <Button className="xs-button delete-send" loading={sending} disabled={sending || offline} onClick={() => void submit()}>
                {closesNow ? "Delete my account now" : "Send my request to the school"}
              </Button>
              <button type="button" className="xs-button xs-button--plain" disabled={sending} onClick={() => navigate("/profile")}>Keep my account</button>
            </>
          ) : (
            <Link to="/profile" className="xs-button xs-button--plain">Back to my profile</Link>
          )}
        </div>
      </BottomBar>
    </PageShell>
  );
}
