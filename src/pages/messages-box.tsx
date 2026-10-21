import { Loader2, Send } from "lucide-react";

import { MESSAGE_MAX } from "@/redux/services/messages-api";

/** Count shown once a message is this close to the limit. */
const COUNT_FROM = MESSAGE_MAX - 500;

/**
 * The box a message is written in, and its Send button.
 *
 * Send is off while the box is empty, over the school's limit, mid-send,
 * `sendDisabled` or `blocked` (the reason is then shown instead of a promise
 * the send would keep). Enter makes a new line, as it does on a phone; Ctrl or Cmd with Enter
 * sends. A long paste is kept whole and flagged rather than cut, so nothing
 * the pupil wrote vanishes without a word.
 */
export function MessageBox({
  id,
  label,
  value,
  onChange,
  onSend,
  busy,
  blocked,
  sendDisabled = false,
  sendLabel = "Send",
  autoFocus = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  busy: boolean;
  blocked?: string;
  /** Holds Send back for a reason the box cannot see, such as no teacher chosen yet. */
  sendDisabled?: boolean;
  sendLabel?: string;
  autoFocus?: boolean;
}) {
  const length = value.length;
  const over = length > MESSAGE_MAX;
  const empty = value.trim().length === 0;
  return (
    <div className="messages-box">
      <label htmlFor={id} className="messages-box-label">{label}</label>
      <textarea
        id={id}
        value={value}
        rows={2}
        autoFocus={autoFocus}
        disabled={!!blocked}
        aria-invalid={over}
        aria-describedby={`${id}-help`}
        placeholder={blocked ? "" : "Write your message"}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            onSend();
          }
        }}
      />
      <div className="messages-box-bar">
        <p id={`${id}-help`} className={over ? "is-over" : undefined} role={over ? "alert" : undefined}>
          {blocked ||
            (over
              ? `${(length - MESSAGE_MAX).toLocaleString("en-NG")} too many characters. A message can be ${MESSAGE_MAX.toLocaleString("en-NG")} characters at most.`
              : length >= COUNT_FROM
                ? `${length.toLocaleString("en-NG")} of ${MESSAGE_MAX.toLocaleString("en-NG")} characters`
                : "")}
        </p>
        <button type="button" className="messages-send" onClick={onSend} disabled={busy || empty || over || sendDisabled || !!blocked}>
          {busy ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
          {busy ? "Sending…" : sendLabel}
        </button>
      </div>
    </div>
  );
}
