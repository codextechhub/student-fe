import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Whether the school can be reached, and how old the data on screen is.
 *
 * `offline` turns on when a read fails for want of a connection and is answered
 * from the pupil's offline copy; `lastUpdated` is then the oldest moment among
 * the answers shown, for "Last updated 7:12am". The first read that reaches the
 * school turns it off again.
 */
export type ConnectivityState = { offline: boolean; lastUpdated: number | null };

const initialState: ConnectivityState = { offline: false, lastUpdated: null };

const connectivitySlice = createSlice({
  name: "connectivity",
  initialState,
  reducers: {
    servedFromCopy(state, action: PayloadAction<number>) {
      state.offline = true;
      state.lastUpdated =
        state.lastUpdated === null ? action.payload : Math.min(state.lastUpdated, action.payload);
    },
    wentOffline(state) {
      state.offline = true;
    },
    reachedSchool(state) {
      state.offline = false;
      state.lastUpdated = null;
    },
  },
});

export const { servedFromCopy, wentOffline, reachedSchool } = connectivitySlice.actions;
export const connectivityReducer = connectivitySlice.reducer;
