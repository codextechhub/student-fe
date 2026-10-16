import { configureStore, createListenerMiddleware } from "@reduxjs/toolkit";

import { endPupil } from "@/auth/device-session";

import { connectivityReducer } from "./features/connectivity-slice";
import { sessionEnded, sessionReducer } from "./features/session-slice";
import { baseApi } from "./services/base-api";

/**
 * When a request finds the showing pupil's sign-in over, the base query
 * reports it and this takes the pupil off the phone. The base query cannot do
 * it itself: taking a pupil off resets the API's own cache.
 */
const listener = createListenerMiddleware();
listener.startListening({
  actionCreator: sessionEnded,
  effect: async (action, api) => {
    await (api.dispatch as AppDispatch)(endPupil(action.payload));
  },
});

/** The app's one store; each feature's endpoints are injected into `baseApi`. */
export const store = configureStore({
  reducer: {
    session: sessionReducer,
    connectivity: connectivityReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefault) => getDefault().prepend(listener.middleware).concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
