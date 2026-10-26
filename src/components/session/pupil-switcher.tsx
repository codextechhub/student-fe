import { useState } from "react";
import { Check, LogOut, UserPlus, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useNavigate } from "react-router";

import { signOutPupil, switchPupil } from "@/auth/device-session";
import { PupilAvatar } from "@/components/pupil-avatar";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

import "./pupil-switcher.css";

/**
 * Shows the pupils on this phone; switching and signing out stay scoped to the
 * selected device account. It opens from "Switch pupil" at the top of Profile,
 * which the avatar on every other screen leads to.
 */
export function PupilSwitcher() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { pupils, active } = useAppSelector((state) => state.session);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const showing = pupils.find((pupil) => pupil.account === active);
  if (!showing) return null;

  const choose = async (account: string) => {
    if (account === active) return setOpen(false);
    setBusy(true);
    setMessage("");
    const result = await dispatch(switchPupil(account));
    setBusy(false);
    if (result.ok) {
      setOpen(false);
      navigate("/", { replace: true });
    } else {
      setMessage(result.message ?? "");
    }
  };

  const signOut = async () => {
    setBusy(true);
    await dispatch(signOutPupil(showing.account));
    setBusy(false);
    setOpen(false);
    navigate("/", { replace: true });
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <Dialog.Trigger asChild>
        <button type="button" className="pupil-switcher-trigger" aria-label="Switch pupil or sign out">
          Switch pupil
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="pupil-switcher-overlay" />
        <Dialog.Content aria-describedby={undefined} className="pupil-switcher-sheet">
          <Dialog.Title>Signed in on this device</Dialog.Title>
          <Dialog.Close className="pupil-switcher-close" aria-label="Close pupil switcher" disabled={busy}><X size={17} aria-hidden="true" /></Dialog.Close>
          <ul className="pupil-switcher-list">
            {pupils.map((pupil) => (
              <li key={pupil.account}>
                <button type="button" disabled={busy} onClick={() => choose(pupil.account)} className={pupil.account === active ? "is-current" : ""}>
                  {/* Only the showing pupil's photo can be fetched with the credential in hand. */}
                  <PupilAvatar name={pupil.fullName} photo={pupil.account === active ? pupil.photo : undefined} size={38} />
                  <span>{pupil.fullName}</span>
                  {pupil.account === active && <Check size={18} aria-label="Showing" />}
                </button>
              </li>
            ))}
          </ul>
          {message && <p className="pupil-switcher-error" role="alert">{message}</p>}
          <div className="pupil-switcher-actions">
            <button type="button" disabled={busy} onClick={() => { setOpen(false); navigate("/sign-in?add=1"); }}><UserPlus size={18} aria-hidden="true" />Add another pupil</button>
            <button type="button" className="is-signout" disabled={busy} onClick={signOut}><LogOut size={18} aria-hidden="true" />Sign {showing.firstName} out of this device</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
