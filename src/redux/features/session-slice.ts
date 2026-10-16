import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { DevicePupil } from "@/auth/pupils-store";

/**
 * - `booting`: reading the phone's pupils and refreshing the one to open on.
 * - `signed-out`: nobody on this phone can be opened; the sign-in screen shows.
 * - `signed-in`: `active` is open and holds a working access token.
 * - `unreachable`: there are pupils, but the school could not be reached to
 *   open any of them. Nobody is signed out for it.
 */
export type SessionStatus = "booting" | "signed-out" | "signed-in" | "unreachable";

export type SessionState = {
  status: SessionStatus;
  pupils: DevicePupil[];
  active: string | null;
  /** A sentence for the sign-in screen, such as who was just signed out and why. */
  notice: string;
};

const initialState: SessionState = { status: "booting", pupils: [], active: null, notice: "" };

/** Who is on this phone and who is showing. Changed only through `auth/device-session`. */
const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    sessionSettled(
      state,
      action: PayloadAction<{ status: SessionStatus; pupils: DevicePupil[]; active: string | null; notice?: string }>,
    ) {
      state.status = action.payload.status;
      state.pupils = action.payload.pupils;
      state.active = action.payload.active;
      if (action.payload.notice !== undefined) state.notice = action.payload.notice;
    },
    noticeCleared(state) {
      state.notice = "";
    },
    /** The API has ended a pupil's sign-in mid-use; `auth/device-session` takes them off. */
    sessionEnded(_state, _action: PayloadAction<string>) {},
  },
});

export const { sessionSettled, noticeCleared, sessionEnded } = sessionSlice.actions;
export const sessionReducer = sessionSlice.reducer;
