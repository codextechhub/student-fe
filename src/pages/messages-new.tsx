import { useRef, useState } from "react";
import { Eye, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { ScrollArea } from "@/components/ui/scroll-area";
import { attemptFor, type SendAttempt } from "@/lib/client-token";
import { sendRefusalMessage } from "@/lib/send-refusal";
import { useAppSelector } from "@/redux/hooks";
import {
  OVERSIGHT_FALLBACK,
  useContactsQuery,
  useStartConversationMutation,
} from "@/redux/services/messages-api";

import { MessageBox } from "./messages-box";

/**
 * The sheet a new message is written in.
 *
 * It is the address `/messages/new`, so Back closes it and a link can open it.
 * It rises from the bottom of the screen on a phone and sits centred on a wide
 * one. The teachers are read only while it is open. The list of teachers
 * scrolls inside the sheet, so the box and Send stay in reach however many
 * teachers a pupil has.
 */
export function NewMessageSheet({ open }: { open: boolean }) {
  const navigate = useNavigate();
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) navigate("/messages", { replace: true }); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="messages-sheet-overlay" />
        <Dialog.Content className="messages-sheet" aria-describedby="new-message-notice">
          <div className="messages-sheet-head">
            <Dialog.Title>New message</Dialog.Title>
            <Dialog.Close className="messages-sheet-close" aria-label="Close">
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <NewMessageForm />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function NewMessageForm() {
  const navigate = useNavigate();
  const offline = useAppSelector((s) => s.connectivity.offline);
  const { data, isLoading, isError, refetch } = useContactsQuery();
  const [start, { isLoading: starting }] = useStartConversationMutation();
  const [staff, setStaff] = useState<number | null>(null);
  const [text, setText] = useState("");
  const attempt = useRef<SendAttempt | null>(null);
  const sending = useRef(false);
  const chosen = data?.contacts.find((contact) => contact.user_id === staff) ?? null;

  const submit = async () => {
    const body = text.trim();
    if (sending.current || !body || staff === null || offline) return;
    sending.current = true;
    attempt.current = attemptFor(attempt.current, `${staff}:${body}`);
    try {
      const started = await start({ staff, body, clientToken: attempt.current.token }).unwrap();
      attempt.current = null;
      navigate(`/messages/${started.conversation.id}`, { replace: true });
    } catch (error) {
      toast.error(sendRefusalMessage(error));
    } finally {
      sending.current = false;
    }
  };

  return (
    <div className="messages-sheet-body">
      <p id="new-message-notice" className="messages-oversight" role="note">
        <Eye size={18} aria-hidden="true" />
        <span>{data?.oversightNotice ?? OVERSIGHT_FALLBACK}</span>
      </p>
      {isLoading && !data && <div className="messages-loading is-short" role="status" aria-label="Loading your teachers" />}
      {isError && !data && (
        <div className="messages-error" role="alert">
          Your teachers can&apos;t be shown right now. <button type="button" onClick={() => refetch()}>Try again</button>
        </div>
      )}
      {data && !data.canStart && (
        <p className="messages-readonly" role="status">{data.canStartReason || "New messages can't be started right now."}</p>
      )}
      {data && data.canStart && data.contacts.length === 0 && (
        <p className="messages-readonly" role="status">There is nobody to message yet. Ask the school office.</p>
      )}
      {data && data.canStart && data.contacts.length > 0 && (
        <>
          <div className="messages-contacts" role="radiogroup" aria-labelledby="new-message-to-label">
            <p id="new-message-to-label">Who is it for?</p>
            <ScrollArea className="messages-contacts-scroll">
              <ul>
              {data.contacts.map((contact) => (
                <li key={contact.user_id}>
                  <label className="messages-contact">
                    <input
                      type="radio"
                      name="new-message-to"
                      checked={staff === contact.user_id}
                      onChange={() => setStaff(contact.user_id)}
                    />
                    <span className="messages-contact-text">
                      <strong>{contact.name}</strong>
                      <small>{contact.label}</small>
                    </span>
                  </label>
                </li>
              ))}
              </ul>
            </ScrollArea>
          </div>
          <MessageBox
            id="new-message-body"
            label={chosen ? `Your message to ${chosen.name}` : "Your message"}
            value={text}
            onChange={setText}
            onSend={submit}
            busy={starting}
            sendDisabled={staff === null}
            sendLabel="Send message"
            blocked={offline ? "You're offline. Sending waits until you have a connection." : undefined}
          />
        </>
      )}
    </div>
  );
}
