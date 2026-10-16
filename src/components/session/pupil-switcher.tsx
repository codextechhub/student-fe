import { useState } from "react";
import { Check, ChevronDown, LogOut, UserPlus } from "lucide-react";
import { Dialog } from "radix-ui";
import { useNavigate } from "react-router";

import { signOutPupil, switchPupil } from "@/auth/device-session";
import { PupilAvatar } from "@/components/pupil-avatar";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

/**
 * Who is showing, and the other pupils on this phone.
 *
 * The button names the pupil showing. It opens a sheet from the bottom on a
 * phone and a panel under the button from `md` up, listing every pupil signed
 * in here, with "Add another pupil" and "Sign out" for the one showing. Signing
 * out ends that pupil on this phone only; Bola stays signed in when Tunde signs
 * out of their mother's phone.
 */
export function PupilSwitcher() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { pupils, active } = useAppSelector((s) => s.session);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const showing = pupils.find((p) => p.account === active);
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
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 rounded-full py-1 pr-2 pl-1 hover:bg-accent"
          aria-label={`${showing.fullName}. Switch pupil or sign out`}
        >
          <PupilAvatar name={showing.fullName} photo={showing.photo} size={32} />
          <span className="truncate text-sm font-medium text-foreground">{showing.firstName}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 md:bg-transparent" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl outline-none md:inset-x-auto md:top-16 md:right-4 md:bottom-auto md:w-80 md:rounded-xl"
        >
          <Dialog.Title className="px-2 pb-2 text-xs font-medium text-muted-foreground">
            Signed in on this phone
          </Dialog.Title>
          <ul className="space-y-1">
            {pupils.map((pupil) => (
              <li key={pupil.account}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => choose(pupil.account)}
                  className="flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent disabled:opacity-60"
                >
                  <PupilAvatar name={pupil.fullName} photo={pupil.photo} size={36} />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{pupil.fullName}</span>
                  {pupil.account === active && <Check className="size-4 shrink-0 text-primary" aria-label="Showing" />}
                </button>
              </li>
            ))}
          </ul>
          {message && <p className="px-2 pt-2 text-xs text-destructive">{message}</p>}
          <div className="mt-3 space-y-1 border-t border-border pt-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                navigate("/sign-in?add=1");
              }}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm text-foreground hover:bg-accent"
            >
              <UserPlus className="size-4 text-muted-foreground" />
              Add another pupil
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm text-destructive hover:bg-accent"
            >
              <LogOut className="size-4" />
              Sign {showing.firstName} out of this phone
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
