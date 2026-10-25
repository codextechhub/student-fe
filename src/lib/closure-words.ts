import { formatTimestampDate } from "@/lib/format";

/** What the school is asked to do, in a pupil's words. */
export const REQUEST_SENTENCE =
  "Your school will be asked to delete your sign-in. Your school record, results and fees stay with the school.";

/** The sentence for a request already waiting. */
export const pendingSentence = (requestedAt: string): string => {
  const since = formatTimestampDate(requestedAt);
  return since ? `Your request is with the school since ${since}.` : "Your request is with the school.";
};
