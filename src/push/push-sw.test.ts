/**
 * The service worker's push handler (`public/push-sw.js`), run against a fake
 * worker.
 *
 * Femi's result is released while Ebere's screen is showing on their mother's
 * phone. The notification reads as the school sent it, and a tap opens
 * Results for Femi: in the app already open, by asking it to show him first,
 * or in a new window whose address names him.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import source from "../../public/push-sw.js?raw";

type Listener = (event: Record<string, unknown>) => void;

function loadWorker(windows: Array<{ url: string; postMessage: ReturnType<typeof vi.fn>; focus: ReturnType<typeof vi.fn> }>) {
  const listeners: Record<string, Listener> = {};
  const self = {
    addEventListener: (type: string, listener: Listener) => { listeners[type] = listener; },
    registration: { showNotification: vi.fn(async () => undefined) },
    clients: {
      matchAll: vi.fn(async () => windows),
      openWindow: vi.fn(async (_address: string) => null),
    },
  };
  new Function("self", source)(self);
  return { self, listeners };
}

/** Fires `type` and waits for whatever it handed to `waitUntil`. */
async function fire(listener: Listener, event: Record<string, unknown>) {
  let pending: Promise<unknown> = Promise.resolve();
  listener({ ...event, waitUntil: (work: Promise<unknown>) => { pending = work; } });
  await pending;
}

const RESULT_PUSH = {
  title: "Femi: Your Third Term result is ready",
  body: "Open the app to read it.",
  tag: "gradebook.result_released",
  url: "/student/",
  notification_id: "812",
  account: "a-femi",
};

describe("a push arriving", () => {
  it("shows what the school sent, replacing an older push of the same kind", async () => {
    const { self, listeners } = loadWorker([]);
    await fire(listeners.push, { data: { json: () => RESULT_PUSH } });
    expect(self.registration.showNotification).toHaveBeenCalledWith("Femi: Your Third Term result is ready", expect.objectContaining({
      body: "Open the app to read it.",
      tag: "gradebook.result_released",
      renotify: true,
      icon: "/student/icons/icon-192.png",
      badge: "/student/icons/badge-96.png",
      data: { tag: "gradebook.result_released", account: "a-femi", notificationId: "812", url: "/student/" },
    }));
  });
});

describe("a Payment received push", () => {
  const PAID = { title: "Amaka: Payment received", body: "", tag: "billing.payment_received", url: "/student/fees/receipts/77", account: "a-amaka" };

  it("tells the app that is open what arrived, and no other tab of the school's site", async () => {
    const open = { url: "https://lagoon-view.xvs.codexng.com/student/fees", postMessage: vi.fn(), focus: vi.fn() };
    const school = { url: "https://lagoon-view.xvs.codexng.com/overview", postMessage: vi.fn(), focus: vi.fn() };
    const { self, listeners } = loadWorker([school, open]);
    await fire(listeners.push, { data: { json: () => PAID } });
    expect(self.registration.showNotification).toHaveBeenCalled();
    expect(open.postMessage).toHaveBeenCalledWith({ type: "xvs-push-arrived", tag: "billing.payment_received", url: "/student/fees/receipts/77" });
    expect(school.postMessage).not.toHaveBeenCalled();
  });

  it("opens the receipt it names on a tap, in the open app or a new window", async () => {
    const notification = { data: { tag: PAID.tag, url: PAID.url, account: "a-amaka" }, close: vi.fn() };
    const open = { url: "https://lagoon-view.xvs.codexng.com/student/", postMessage: vi.fn(), focus: vi.fn(async () => undefined) };
    const inApp = loadWorker([open]);
    await fire(inApp.listeners.notificationclick, { notification });
    expect(open.postMessage).toHaveBeenCalledWith({ type: "xvs-push-open", path: "/student/fees/receipts/77", account: "a-amaka" });

    const closed = loadWorker([]);
    await fire(closed.listeners.notificationclick, { notification });
    expect(closed.self.clients.openWindow).toHaveBeenCalledWith("/student/fees/receipts/77?pupil=a-amaka");
  });

  it("opens Fees when it names no receipt, and never an address outside the app or beyond one receipt", async () => {
    const opened = async (url: string) => {
      const { self, listeners } = loadWorker([]);
      await fire(listeners.notificationclick, { notification: { data: { tag: PAID.tag, account: "", url }, close: vi.fn() } });
      return self.clients.openWindow.mock.calls[0]?.[0];
    };
    expect(await opened("")).toBe("/student/fees");
    expect(await opened("https://evil.example/student/fees/receipts/1")).toBe("/student/fees");
    expect(await opened("/parent/fees/receipts/1")).toBe("/student/fees");
    expect(await opened("/student/fees/receipts/1/../../messages")).toBe("/student/fees");
  });
});

describe("a tap on the notification", () => {
  let notification: { data: unknown; close: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    notification = { data: { tag: "gradebook.result_released", account: "a-femi" }, close: vi.fn() };
  });

  it("asks the app already open to show Femi's results", async () => {
    const open = { url: "https://lagoon-view.xvs.codexng.com/student/fees", postMessage: vi.fn(), focus: vi.fn(async () => undefined) };
    const school = { url: "https://lagoon-view.xvs.codexng.com/overview", postMessage: vi.fn(), focus: vi.fn() };
    const { self, listeners } = loadWorker([school, open]);
    await fire(listeners.notificationclick, { notification });
    expect(notification.close).toHaveBeenCalled();
    expect(open.postMessage).toHaveBeenCalledWith({ type: "xvs-push-open", path: "/student/results", account: "a-femi" });
    expect(open.focus).toHaveBeenCalled();
    expect(school.postMessage).not.toHaveBeenCalled();
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it("opens a new window on Femi's results when the app is closed", async () => {
    const { self, listeners } = loadWorker([]);
    await fire(listeners.notificationclick, { notification });
    expect(self.clients.openWindow).toHaveBeenCalledWith("/student/results?pupil=a-femi");
  });

  it("opens Notices for a notice and Fees for a payment, and Home for anything else", async () => {
    const opened = async (tag: string) => {
      const { self, listeners } = loadWorker([]);
      await fire(listeners.notificationclick, { notification: { data: { tag, account: "" }, close: vi.fn() } });
      return self.clients.openWindow.mock.calls[0]?.[0];
    };
    expect(await opened("notices.published")).toBe("/student/notices");
    expect(await opened("billing.payment_received")).toBe("/student/fees");
    expect(await opened("something.else")).toBe("/student/");
  });

  it("opens the conversation a message push names, and Messages when it names none", async () => {
    const opened = async (data: Record<string, string>) => {
      const { self, listeners } = loadWorker([]);
      await fire(listeners.notificationclick, { notification: { data: { tag: "messages.new_message_pupil", account: "", ...data }, close: vi.fn() } });
      return self.clients.openWindow.mock.calls[0]?.[0];
    };
    expect(await opened({ url: "/student/messages/41" })).toBe("/student/messages/41");
    expect(await opened({ url: "/student/messages" })).toBe("/student/messages");
    expect(await opened({})).toBe("/student/messages");
  });

  it("never opens a message address outside the app or beyond one conversation", async () => {
    const opened = async (url: string) => {
      const { self, listeners } = loadWorker([]);
      await fire(listeners.notificationclick, { notification: { data: { tag: "messages.new_message_pupil", account: "", url }, close: vi.fn() } });
      return self.clients.openWindow.mock.calls[0]?.[0];
    };
    expect(await opened("https://evil.example/student/messages/1")).toBe("/student/messages");
    expect(await opened("/parent/messages/1")).toBe("/student/messages");
    expect(await opened("/student/messages/1/../../fees")).toBe("/student/messages");
  });
});
