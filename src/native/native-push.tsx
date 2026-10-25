/**
 * Where the store app's own push notifications will be registered.
 *
 * The web app's Web Push (`src/push`) is off in the store app: it needs a
 * service worker, which the store app does not have. Native push (APNs on
 * iOS, FCM on Android) arrives here in a later phase: ask permission, register
 * the device's token with the school for the pupil showing, and open the right
 * screen when a notification is tapped, as `PushListener` does for the web.
 * Until then it renders nothing and does nothing.
 */
export function NativePushListener() {
  return null;
}
