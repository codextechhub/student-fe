import { useEffect, useRef } from "react";

import { usePageVisible } from "@/lib/page-visible";
import { useAppSelector } from "@/redux/hooks";
import { useLazyMessagesAfterQuery, type PollAnswer } from "@/redux/services/messages-api";

/** How often an open thread asks the school what is new, in milliseconds. */
export const THREAD_POLL_MS = 10_000;
/** How many follow-up reads one poll may make when the school says there are more. */
const MAX_ROUNDS = 5;

/**
 * Keeps an open conversation up to date: new messages and the ticks on the
 * pupil's own.
 *
 * While the app is in front and `enabled`, asks for what is newer than the
 * newest message held every ten seconds, and once more each time the app comes
 * back into view or the window is focused. It stops when the thread closes,
 * the app goes into the background or the phone goes offline. A poll belongs
 * to the pupil who started it: if a different pupil is showing, or the screen
 * is gone, by the time an answer arrives, the answer is dropped (the request
 * layer drops it too, so it never reaches this far).
 *
 * `newestId` is read when each poll starts, `onAnswer` receives each answer.
 */
export function useThreadPoll({
  id,
  newestId,
  enabled,
  onAnswer,
}: {
  id: number;
  newestId: number | null;
  enabled: boolean;
  onAnswer: (answer: PollAnswer) => void;
}) {
  const [poll] = useLazyMessagesAfterQuery();
  const visible = usePageVisible();
  const account = useAppSelector((s) => s.session.active);

  const accountNow = useRef(account);
  const newest = useRef(newestId);
  const answer = useRef(onAnswer);
  useEffect(() => {
    accountNow.current = account;
    newest.current = newestId;
    answer.current = onAnswer;
  });

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const busy = useRef(false);
  const started = useRef(false);
  const live = enabled && visible;
  useEffect(() => {
    if (!live) return;
    const run = async () => {
      if (busy.current) return;
      busy.current = true;
      const startedFor = accountNow.current;
      try {
        for (let round = 0; round < MAX_ROUNDS; round += 1) {
          const result = await poll({ id, after: newest.current ?? 0 }, false);
          if (!alive.current || accountNow.current !== startedFor || !result.data) return;
          answer.current(result.data);
          const last = result.data.results.at(-1);
          if (last) newest.current = Math.max(newest.current ?? 0, last.id);
          if (!result.data.hasMore || !last) return;
        }
      } finally {
        busy.current = false;
      }
    };
    // The first start is the thread just opened and read; later ones are a return to it.
    if (started.current) void run();
    started.current = true;
    const timer = window.setInterval(() => void run(), THREAD_POLL_MS);
    const onFocus = () => void run();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [live, id, poll]);
}
