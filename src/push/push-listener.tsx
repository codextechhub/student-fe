import { useEffect } from "react";
import { useNavigate } from "react-router";

import { showPupilFromPush } from "@/auth/device-session";
import { isPaymentPush, requestDepositCheck } from "@/lib/deposit-signal";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import { refreshPush, routerPath } from "./push";

/** What the service worker posts when a notification is tapped while the app is open. */
type OpenMessage = { type: "xvs-push-open"; path: string; account: string };

const isOpenMessage = (data: unknown): data is OpenMessage =>
  !!data && typeof data === "object" && (data as { type?: unknown }).type === "xvs-push-open";

/** What the service worker posts when a push arrives while the app is open: the kind and screen it carries. */
type ArrivedMessage = { type: "xvs-push-arrived"; tag: string; url: string };

const isArrivedMessage = (data: unknown): data is ArrivedMessage =>
  !!data && typeof data === "object" && (data as { type?: unknown }).type === "xvs-push-arrived";

/**
 * Keeps push working for the pupil showing, and answers a tapped notification.
 *
 * Each time a pupil is shown, their subscription is re-sent if they turned
 * notifications on. A tap on a notification while the app is already open
 * arrives here from the service worker: the pupil it is about is shown first,
 * if they are on this phone, and then the screen it opens. A "Payment received"
 * push that arrives while the app is open tells a Fees or Pay screen to look
 * for the transfer at once. Renders nothing.
 */
export function PushListener() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { status, active } = useAppSelector((s) => s.session);

  useEffect(() => {
    if (status === "signed-in" && active) void refreshPush(dispatch, active);
  }, [dispatch, status, active]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = async (event: MessageEvent) => {
      if (isArrivedMessage(event.data)) {
        if (isPaymentPush(event.data)) requestDepositCheck();
        return;
      }
      if (!isOpenMessage(event.data)) return;
      if (event.data.account) await dispatch(showPupilFromPush(event.data.account));
      navigate(routerPath(event.data.path));
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [dispatch, navigate]);

  return null;
}
