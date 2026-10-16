import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

/**
 * The API every screen talks through.
 *
 * Requests carry cookies (`credentials: "include"`) because the pupil's
 * sign-in lives in httpOnly cookies the API sets, one per pupil on the phone;
 * the app never holds a token it could leak. The school is named by the
 * address the app is served at, and endpoints that need it add it themselves.
 */
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_BACKEND_URL,
    credentials: "include",
  }),
  endpoints: () => ({}),
});
