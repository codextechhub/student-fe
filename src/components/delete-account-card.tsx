import { Trash2 } from "lucide-react";
import { Link } from "react-router";

import { pendingSentence } from "@/lib/closure-words";
import { closureOffered, useClosureStateQuery } from "@/redux/services/account-closure-api";

/**
 * The "Delete my account" entry on Profile.
 *
 * Absent for an account the API does not offer deletion for (a 403, or not
 * eligible) and while the answer has not arrived. With a request waiting at the
 * school it states since when, in place of the button.
 */
export function DeleteAccountCard() {
  const { data: state } = useClosureStateQuery();
  if (!closureOffered(state)) return null;

  return (
    <section className="profile-surface profile-notifications" aria-labelledby="delete-account-heading">
      <div className="profile-card-heading">
        <span className="profile-card-icon"><Trash2 size={19} aria-hidden="true" /></span>
        <div><h2 id="delete-account-heading">Delete my account</h2><p>Ask your school to remove your sign-in</p></div>
      </div>
      <div className="profile-delete-body">
        {state?.pending ? (
          <p role="status">{pendingSentence(state.pending.requested_at)}</p>
        ) : (
          <>
            <p>Your school record, results and fees stay with the school.</p>
            <Link to="/profile/delete-account">Delete my account</Link>
          </>
        )}
      </div>
    </section>
  );
}
