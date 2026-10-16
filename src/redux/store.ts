import { configureStore } from "@reduxjs/toolkit";

import { baseApi } from "./services/base-api";

/** The app's one store; each feature's endpoints are injected into `baseApi`. */
export const store = configureStore({
  reducer: { [baseApi.reducerPath]: baseApi.reducer },
  middleware: (getDefault) => getDefault().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
