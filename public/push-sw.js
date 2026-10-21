/**
 * Push notifications, loaded into the generated service worker
 * (`workbox.importScripts` in `pwa.config.ts`).
 *
 * The school sends `{title, body, tag, url, notification_id, account?}`. The
 * title already starts with the pupil's first name on a shared phone, and no
 * push carries a figure, because it can show on a locked screen. `tag` is the
 * kind of event, so a newer push of the same kind replaces the older one.
 *
 * Tapping a notification opens the screen it is about: a notice opens
 * Notices, a released result Results, a confirmed payment Fees, a message the
 * conversation it names (`/student/messages/<id>`). When the push
 * names the pupil's device-session `account`, the app is asked to show that
 * pupil first, so a sibling's notification never opens on the wrong child.
 * Only an address inside `/student/` is ever opened.
 */

/** The screen each kind of push opens, inside the app. */
const SCREEN_FOR_TAG = {
  "notices.published": "notices",
  "gradebook.result_released": "results",
  "billing.payment_received": "fees",
  "messages.new_message_pupil": "messages",
};

/** The only address a message push may name: one conversation inside the app. */
const CONVERSATION_PATH = /^\/student\/messages\/\d+$/;

const APP_ROOT = "/student/";

/** The in-app path a notification opens, never outside the student app. */
function screenFor(data) {
  if (data && data.tag === "messages.new_message_pupil" && CONVERSATION_PATH.test(data.url || "")) return data.url;
  const screen = SCREEN_FOR_TAG[data && data.tag] || "";
  return APP_ROOT + screen;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Your school";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      icon: APP_ROOT + "icons/icon-192.png",
      badge: APP_ROOT + "icons/badge-96.png",
      data: { tag: data.tag || "", account: data.account || "", notificationId: data.notification_id || "", url: data.url || "" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const path = screenFor(data);
  const account = typeof data.account === "string" ? data.account : "";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).pathname.startsWith(APP_ROOT));
      if (open) {
        open.postMessage({ type: "xvs-push-open", path, account });
        await open.focus();
        return;
      }
      const address = account ? `${path}?pupil=${encodeURIComponent(account)}` : path;
      await self.clients.openWindow(address);
    })(),
  );
});
