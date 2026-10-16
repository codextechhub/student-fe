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
import { keepAnswer, keptAnswer } from "@/offline/offline-copy";
import {
  reachedSchool,
  servedFromCopy,
  wentOffline,
  type ConnectivityState,
} from "@/redux/features/connectivity-slice";
import { sessionEnded, type SessionState } from "@/redux/features/session-slice";

type StateWithSession = { session: SessionState; connectivity: ConnectivityState };

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

/** A read, as opposed to a write: only reads are kept and answered offline. */
function isRead(args: string | FetchArgs): boolean {
  return typeof args === "string" || !args.method || args.method.toUpperCase() === "GET";
}

/** The address a read is kept under, its query string included. */
function readKey(args: string | FetchArgs): string {
  if (typeof args === "string") return args;
  const params = args.params ? new URLSearchParams(args.params as Record<string, string>).toString() : "";
  return params ? `${args.url}${args.url.includes("?") ? "&" : "?"}${params}` : args.url;
}

/**
 * Settles a finished request against the offline copy.
 *
 * A read that reached the school is kept for the pupil. A read that failed for
 * want of a connection is answered from the pupil's copy where there is one,
 * and the app is told it is showing old data. A write that could not be sent
 * fails as it is: nothing is changed offline.
 */
async function withOfflineCopy(
  args: string | FetchArgs,
  account: string | null,
  result: Awaited<ReturnType<typeof raw>>,
  dispatch: (action: unknown) => unknown,
  offlineNow: boolean,
): Promise<Awaited<ReturnType<typeof raw>>> {
  if (result.error?.status === "FETCH_ERROR") {
    if (!account || !isRead(args)) {
      dispatch(wentOffline());
      return result;
    }
    const kept = await keptAnswer(account, readKey(args));
    if (!kept) {
      dispatch(wentOffline());
      return result;
    }
    dispatch(servedFromCopy(kept.at));
    return { data: kept.data, meta: result.meta };
  }
  if (!result.error) {
    if (offlineNow) dispatch(reachedSchool());
    if (account && isRead(args)) void keepAnswer(account, readKey(args), result.data);
  }
  return result;
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

  const offlineNow = () => (api.getState() as StateWithSession).connectivity.offline;
  const settle = (r: Awaited<ReturnType<typeof raw>>) =>
    withOfflineCopy(args, account, r, api.dispatch, offlineNow());

  let result = await raw(tenanted(args), api, extra);
  if (showing() !== account) return switched;
  if (result.error?.status !== 401 || !account) return settle(result);

  const outcome = await refreshAccess(account);
  if (outcome.ok) {
    if (showing() !== account) return switched;
    result = await raw(tenanted(args), api, extra);
    if (showing() !== account) return switched;
    return settle(result);
  }
  if (outcome.reason === "ended") {
    api.dispatch(sessionEnded(account));
    return result;
  }
  // The token ran out and the school cannot be reached to renew it: answer
  // from the pupil's copy as for any other lost connection.
  return settle({ error: { status: "FETCH_ERROR", error: "offline" }, meta: result.meta });
};

/** The API every screen talks through; each feature injects its endpoints. */
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: pupilQuery,
  tagTypes: ["Me", "Home", "Notices", "Profile", "Timetable", "Attendance", "Results"],
  endpoints: () => ({}),
});

/** Every tag, for refetching everything on screen (pull to refresh, back online). */
export const ALL_TAGS = ["Me", "Home", "Notices", "Profile", "Timetable", "Attendance", "Results"] as const;
