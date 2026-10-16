import { baseApi } from "./base-api";

/** A device subscription as the browser gives it (`PushSubscription.toJSON()`). */
export type DeviceSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

const unwrap = <T,>(body: { data: T }) => body.data;

/**
 * Push for the pupil showing: the school's key, and this phone's subscription.
 *
 * The key answers 503 `PUSH_NOT_CONFIGURED` where the school sends no push,
 * and the app then offers no notifications at all. A subscription is
 * remembered for the pupil whose token the request carries, with their
 * device-session `account`, so it ends when that pupil signs out. Several
 * pupils on one phone share one browser endpoint and each has their own row,
 * so forgetting one never touches another's.
 */
export const pushApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    pushKey: build.query<string, void>({
      query: () => "/notify/push/key/",
      transformResponse: (body: { data: { public_key: string } }) => unwrap(body).public_key,
      keepUnusedDataFor: 3600,
    }),
    subscribePush: build.mutation<void, DeviceSubscription & { account: string }>({
      query: (body) => ({ url: "/notify/push/subscriptions/", method: "POST", body }),
    }),
    unsubscribePush: build.mutation<void, { endpoint: string }>({
      query: (body) => ({ url: "/notify/push/subscriptions/", method: "DELETE", body }),
    }),
  }),
});

export const { usePushKeyQuery } = pushApi;
