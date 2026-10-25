import { baseApi } from "./base-api";

/**
 * Whether the signed-in pupil may delete their own account, and how.
 *
 * `mode` is `request` for a pupil: the confirmation goes to the school, which
 * decides, and `pending` says when it was asked. `eligible` false, or a 403
 * `ACCOUNT_CLOSURE_NOT_OFFERED`, means this account is not offered the option
 * and the app shows no entry for it.
 */
export type ClosureState = {
  eligible: boolean;
  mode: "close" | "request" | null;
  pending: { requested_at: string } | null;
};

/** What confirming did: the account is closed now, or the school was asked. */
export type ClosureOutcome = { status: "closed" } | { status: "requested"; requested_at: string };

/**
 * Account deletion for the pupil showing (`/user/me/account-closure/`).
 *
 * The state is a live look, never kept as an offline copy: a request pending
 * with the school can be decided while the phone is away. Confirming does not
 * invalidate it: an account that closed at once can no longer be read, and the
 * screen refreshes the state itself when the school was only asked.
 */
export const accountClosureApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    closureState: build.query<ClosureState, void>({
      query: () => "/user/me/account-closure/",
      transformResponse: (body: { data: ClosureState }) => body.data,
      providesTags: ["AccountClosure"],
      extraOptions: { live: true },
    }),
    confirmClosure: build.mutation<ClosureOutcome, void>({
      query: () => ({ url: "/user/me/account-closure/", method: "POST", body: { confirm: true } }),
      transformResponse: (body: { data: ClosureOutcome }) => body.data,
    }),
  }),
});

export const { useClosureStateQuery, useConfirmClosureMutation } = accountClosureApi;

/** Whether the screens offer deletion for this answer: the pupil is eligible, or has a request waiting. */
export function closureOffered(state: ClosureState | undefined): boolean {
  return !!state && (state.eligible || !!state.pending);
}
