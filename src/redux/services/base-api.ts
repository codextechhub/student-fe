import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";

import { accessFor } from "@/auth/access-tokens";
import { API_BASE, withTenant } from "@/auth/api";
import { getCsrfToken } from "@/auth/csrf";
import { refreshAccess } from "@/auth/refresh";
import { sessionEnded, type SessionState } from "@/redux/features/session-slice";

type StateWithSession = { session: SessionState };

const raw = fetchBaseQuery({
  baseUrl: API_BASE,
  credentials: "include",
  prepareHeaders: async (headers, { getState, type }) => {
    const active = (getState() as StateWithSession).session.active;
    const access = active ? accessFor(active) : "";
    if (access) headers.set("Authorization", `Bearer ${access}`);
    if (type === "mutation") {
      const csrf = await getCsrfToken();
      if (csrf) headers.set("X-CSRFToken", csrf);
    }
    return headers;
  },
});

function tenanted(args: string | FetchArgs): string | FetchArgs {
  return typeof args === "string" ? withTenant(args) : { ...args, url: withTenant(args.url) };
}

/**
 * Every screen's requests, as the pupil who is showing.
 *
 * The showing pupil's access token and this school's `?tenant=` go on every
 * request. A 401 means the token has run out: it is refreshed once (see
 * `refreshAccess`) and the request sent again. A refresh the API refuses for
 * good ends that pupil on this phone, which takes them off the switcher and
 * clears what the store read for them.
 *
 * The pupil is read when the request starts. If a different pupil is showing
 * by the time the answer arrives, the answer is dropped rather than returned:
 * Tunde's results that were in flight when the phone switched to Bola must
 * never land in the cache Bola's screens read. A retry is never re-sent as
 * the new pupil either.
 */
const pupilQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extra,
) => {
  const showing = () => (api.getState() as StateWithSession).session.active;
  const account = showing();
  const switched = { error: { status: "CUSTOM_ERROR", error: "The pupil showing changed." } } as const;

  let result = await raw(tenanted(args), api, extra);
  if (showing() !== account) return switched;
  if (result.error?.status !== 401 || !account) return result;

  const outcome = await refreshAccess(account);
  if (outcome.ok) {
    if (showing() !== account) return switched;
    result = await raw(tenanted(args), api, extra);
    if (showing() !== account) return switched;
  } else if (outcome.reason === "ended") {
    api.dispatch(sessionEnded(account));
  }
  return result;
};

/** The API every screen talks through; each feature injects its endpoints. */
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: pupilQuery,
  endpoints: () => ({}),
});
