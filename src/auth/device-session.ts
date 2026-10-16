import type { ThunkDispatch, UnknownAction } from "@reduxjs/toolkit";

import { sessionSettled, type SessionState } from "@/redux/features/session-slice";
import { baseApi } from "@/redux/services/base-api";
import type { Me } from "@/redux/services/portal-api";
import { currentSchoolSlug } from "@/utils/school-host";

import { accessFor, dropAccess, setAccess } from "./access-tokens";
import { API_BASE, authPost, withTenant } from "./api";
import {
  deletePupil,
  getActiveAccount,
  listPupils,
  putPupil,
  setActiveAccount,
  type DevicePupil,
} from "./pupils-store";
import { refreshAccess } from "./refresh";

/**
 * The pupils on this phone: opening the app, signing in, switching, signing out.
 *
 * Every change to who is showing goes through here, in one order: the store's
 * reads for the pupil leaving are thrown away first, then the next pupil is
 * made active. A screen therefore never draws one child's results while it is
 * meant to be showing another's.
 */

type State = { session: SessionState };
type Dispatch = ThunkDispatch<State, unknown, UnknownAction>;
type GetState = () => State;

/**
 * Where school-fe's sign-in page leaves the account it handed over.
 *
 * Same origin and same tab, so sessionStorage carries it across the page
 * change. Only the opaque account travels; the pupil's credential is the
 * cookie the API set, and a fresh access token is fetched from it here.
 * school-fe writes this key; the two must agree.
 */
export const HANDOVER_KEY = "xvs.student.handover";

export type SignInResult = { ok: true } | { ok: false; message: string; staff?: boolean };

/** Reads the pupil behind `account`, refreshing their access token once if it has run out. */
async function fetchMe(account: string): Promise<Me | "ended" | "unreachable"> {
  const ask = () =>
    fetch(`${API_BASE}${withTenant("/portal/student/me/")}`, {
      credentials: "include",
      headers: { accept: "application/json", Authorization: `Bearer ${accessFor(account)}` },
    });
  let response: Response;
  try {
    if (!accessFor(account)) {
      const outcome = await refreshAccess(account);
      if (!outcome.ok) return outcome.reason === "ended" ? "ended" : "unreachable";
    }
    response = await ask();
    if (response.status === 401) {
      const outcome = await refreshAccess(account);
      if (!outcome.ok) return outcome.reason === "ended" ? "ended" : "unreachable";
      response = await ask();
    }
  } catch {
    return "unreachable";
  }
  // A 404 is the portal saying this account is no pupil of this school.
  if (response.status === 404) return "ended";
  if (!response.ok) return "unreachable";
  return ((await response.json()) as { data: Me }).data;
}

function pupilFrom(account: string, me: Me): DevicePupil {
  return {
    account,
    studentId: me.student.id,
    fullName: me.student.full_name,
    firstName: me.student.first_name,
    photo: me.student.photo_url,
  };
}

/**
 * Puts `account` on the phone as the pupil `me` describes.
 *
 * The same child signing in again gets a new device account, so an older entry
 * for the same pupil record is signed out and replaced, never listed twice.
 */
async function adopt(account: string, me: Me): Promise<DevicePupil> {
  const pupil = pupilFrom(account, me);
  for (const other of await listPupils()) {
    if (other.studentId === pupil.studentId && other.account !== account) {
      await authPost("/user/auth/device/sign-out/", { account: other.account });
      dropAccess(other.account);
      await deletePupil(other.account);
    }
  }
  await putPupil(pupil);
  return pupil;
}

/**
 * Makes `account` the pupil showing.
 *
 * Everything that waits (the phone's storage) happens first. Then the reads
 * made for the last pupil are thrown away and the new pupil made active in
 * the same tick, so React never renders in between: a screen still mounted for
 * the last pupil would otherwise refetch with their token into the cache the
 * next pupil's screen then reads.
 */
async function show(dispatch: Dispatch, account: string, notice = ""): Promise<void> {
  await setActiveAccount(account);
  const pupils = await listPupils();
  dispatch(baseApi.util.resetApiState());
  dispatch(sessionSettled({ status: "signed-in", pupils, active: account, notice }));
}

/** Nobody can be shown: the sign-in screen, with `notice` saying why where there is a reason. */
async function showNobody(dispatch: Dispatch, notice = ""): Promise<void> {
  await setActiveAccount(null);
  const pupils = await listPupils();
  dispatch(baseApi.util.resetApiState());
  dispatch(sessionSettled({ status: "signed-out", pupils, active: null, notice }));
}

/** Takes a pupil whose sign-in has ended off the phone, saying so to whoever looks next. */
async function forget(account: string): Promise<string> {
  const pupil = (await listPupils()).find((p) => p.account === account);
  dropAccess(account);
  await deletePupil(account);
  return pupil?.firstName
    ? `${pupil.firstName} was signed out on this phone. Sign in again to carry on.`
    : "";
}

/**
 * Opens the app: takes over a sign-in school-fe handed across, then opens the
 * pupil used last (or the first on the phone) whose sign-in still works.
 *
 * A pupil whose sign-in has ended is taken off and the next one tried. If the
 * school cannot be reached, nobody is taken off and the app says it is
 * offline rather than asking anyone to sign in again.
 */
export const bootSession = () => async (dispatch: Dispatch) => {
  let handedOver: string | null = null;
  try {
    handedOver = sessionStorage.getItem(HANDOVER_KEY);
    sessionStorage.removeItem(HANDOVER_KEY);
  } catch {
    handedOver = null;
  }

  const order: string[] = [];
  if (handedOver) order.push(handedOver);
  const last = await getActiveAccount();
  if (last) order.push(last);
  for (const pupil of await listPupils()) order.push(pupil.account);

  let notice = "";
  let unreachable = false;
  for (const account of [...new Set(order)]) {
    const me = await fetchMe(account);
    if (me === "unreachable") {
      unreachable = true;
      continue;
    }
    if (me === "ended") {
      notice = (await forget(account)) || notice;
      continue;
    }
    await adopt(account, me);
    await show(dispatch, account, notice);
    return;
  }
  if (unreachable) {
    dispatch(sessionSettled({ status: "unreachable", pupils: await listPupils(), active: null }));
    return;
  }
  await showNobody(dispatch, notice);
};

/** What the sign-in screen says for each refusal, in words a pupil can act on. */
function refusalSentence(status: number, code: string, message: string): SignInResult {
  if (status === 0) {
    return { ok: false, message: "We can't reach your school right now. Check your connection and try again." };
  }
  if (code === "DEVICE_SESSION_NOT_OFFERED") {
    return { ok: false, staff: true, message: "This is a staff account. Staff sign in on the school's main page." };
  }
  if (code === "INVALID_CREDENTIALS" || status === 401) {
    return { ok: false, message: "That admission number or email and password don't match. Check them and try again." };
  }
  if (code === "ACCOUNT_NOT_ACTIVATED") {
    return {
      ok: false,
      message: "This account isn't set up yet. Open the invitation your school sent and choose a password first.",
    };
  }
  if (status === 429) {
    return { ok: false, message: "Too many tries. Wait a minute, then try again." };
  }
  if (status === 400) {
    return { ok: false, message: "Enter your admission number or email, and your password." };
  }
  return { ok: false, message: message || "You can't sign in right now. Ask the school office for help." };
}

/** Signs a pupil in on this phone and shows them; the pupils already here stay signed in. */
export const signInPupil =
  (identifier: string, password: string) =>
  async (dispatch: Dispatch): Promise<SignInResult> => {
    const result = await authPost<{ account: string; access: string }>("/user/auth/login/", {
      identifier: identifier.trim(),
      password,
      tenant: currentSchoolSlug(),
      session: "device",
    });
    if (!result.ok) {
      const { status, code, message } = result.refusal;
      return refusalSentence(status, code, message);
    }
    const { account, access } = result.data;
    setAccess(account, access);
    const me = await fetchMe(account);
    if (me === "unreachable") return refusalSentence(0, "", "");
    if (me === "ended") return refusalSentence(403, "", "");
    await adopt(account, me);
    await show(dispatch, account);
    return { ok: true };
  };

/**
 * Shows another pupil already on the phone.
 *
 * Their token is refreshed before anything of theirs is read; if their
 * sign-in has ended they come off the phone and the pupil showing stays.
 */
export const switchPupil =
  (account: string, notice = "") =>
  async (dispatch: Dispatch, getState: GetState): Promise<{ ok: boolean; message?: string }> => {
    if (getState().session.active === account) return { ok: true };
    if (!accessFor(account)) {
      const outcome = await refreshAccess(account);
      if (!outcome.ok && outcome.reason === "ended") {
        const notice = await forget(account);
        const { status, active } = getState().session;
        dispatch(sessionSettled({ status, pupils: await listPupils(), active }));
        return { ok: false, message: notice };
      }
      if (!outcome.ok) {
        return { ok: false, message: "We can't reach your school right now. Try again in a moment." };
      }
    }
    await show(dispatch, account, notice);
    return { ok: true };
  };

/**
 * Signs one pupil out of this phone. The others stay signed in, and the next
 * one on the list is shown, or the sign-in screen if there is none.
 */
export const signOutPupil =
  (account: string) =>
  async (dispatch: Dispatch, getState: GetState): Promise<void> => {
    await authPost("/user/auth/device/sign-out/", { account });
    dropAccess(account);
    await deletePupil(account);
    if (getState().session.active !== account) {
      const { status, active } = getState().session;
      dispatch(sessionSettled({ status, pupils: await listPupils(), active }));
      return;
    }
    const next = (await listPupils())[0];
    if (next) {
      const opened = await dispatch(switchPupil(next.account));
      if (opened.ok) return;
    }
    await showNobody(dispatch);
  };

/**
 * The API ended the showing pupil's sign-in mid-use. They come off the phone;
 * the next pupil is shown, or the sign-in screen says what happened.
 */
export const endPupil =
  (account: string) =>
  async (dispatch: Dispatch, getState: GetState): Promise<void> => {
    const notice = await forget(account);
    if (getState().session.active !== account) {
      const { status, active } = getState().session;
      dispatch(sessionSettled({ status, pupils: await listPupils(), active }));
      return;
    }
    for (const next of await listPupils()) {
      const opened = await dispatch(switchPupil(next.account, notice));
      if (opened.ok) return;
    }
    await showNobody(dispatch, notice);
  };
