import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, CircleCheck, KeyRound } from "lucide-react";

import { signOutAfterPasswordChange } from "@/auth/device-session";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  passwordRefusals,
  useChangePasswordMutation,
  usePasswordPolicyQuery,
  type PasswordRefusals,
} from "@/redux/services/password-api";

export const MISMATCH_MESSAGE = "The new passwords don't match.";

/**
 * What the school did when the password changed, in a pupil's words.
 *
 * The change ends the pupil's sign-in everywhere, this phone included, and
 * each phone asks again within 15 minutes, when its access token runs out.
 * Sessions belong to the pupil, not the phone, so a brother or sister signed
 * in on the same phone is not touched.
 */
export const SIGNED_OUT_EVERYWHERE_MESSAGE =
  "You're now signed out on every device, this one included. " +
  "Each will ask for your new password within 15 minutes. " +
  "Anyone else signed in on this device stays signed in.";

/** The policy in one sentence, for while the school's own list loads or can't be read. */
const RULES_FALLBACK =
  "At least 12 characters, with an uppercase letter, a lowercase letter, a number and a special character.";

type Field = "current_password" | "password" | "confirm_password";

/**
 * The Change password row in Profile's settings list, which opens the form
 * under itself. Cancel, or the row again, clears typed passwords and closes it.
 *
 * Every refusal is shown under the box it is about, never as a toast. A
 * mismatch is caught here before anything is sent, and Save stays off until
 * all three boxes are filled and the new two agree, and while the phone is
 * offline. After a change the boxes empty and the pupil is told what happened
 * to their sign-ins, with a button that signs them in again now rather than
 * when this phone's sign-in runs out.
 *
 * That button lands on the sign-in screen, never on whoever is shown next. With
 * a brother or sister still on the phone, the session module shows them
 * straight away, and a pupil left on the profile page would be looking at their
 * sibling's details with no word of why. The sign-in screen says what
 * happened, takes the new password, and its Cancel goes back to the sibling.
 */
export function ChangePassword() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const account = useAppSelector((s) => s.session.active);
  const offline = useAppSelector((s) => s.connectivity.offline);
  const [open, setOpen] = useState(false);
  const { data: policy } = usePasswordPolicyQuery(undefined, { skip: !open });
  const [change, { isLoading }] = useChangePasswordMutation();

  const [values, setValues] = useState({ current_password: "", password: "", confirm_password: "" });
  const [errors, setErrors] = useState<PasswordRefusals>({});
  const [changed, setChanged] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const mismatch = values.confirm_password.length > 0 && values.confirm_password !== values.password;
  const canSave =
    !!values.current_password && !!values.password && !!values.confirm_password && !mismatch && !isLoading && !offline;

  const edit = (field: Field) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined, form: undefined }));
    setChanged(false);
  };

  const close = () => {
    setValues({ current_password: "", password: "", confirm_password: "" });
    setErrors({});
    setChanged(false);
    setOpen(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setErrors({});
    try {
      await change(values).unwrap();
      setValues({ current_password: "", password: "", confirm_password: "" });
      setChanged(true);
    } catch (error) {
      setErrors(passwordRefusals(error));
    }
  };

  const signInAgain = async () => {
    if (!account) return;
    setLeaving(true);
    await dispatch(signOutAfterPasswordChange(account));
    navigate("/sign-in?add=1", { replace: true });
  };

  const rules = policy?.requirements ?? [];

  return (
    <section aria-labelledby="password-heading" className="settings-item">
      <button type="button" className="settings-row" aria-expanded={open} aria-controls="profile-password-form" onClick={() => (open ? close() : setOpen(true))}>
        <span className="settings-icon is-brand"><KeyRound size={16} aria-hidden="true" /></span>
        <span className="settings-label" id="password-heading">Change password</span>
        <ChevronRight className="settings-chevron" size={17} aria-hidden="true" />
      </button>

      {open && <form id="profile-password-form" onSubmit={submit} noValidate className="settings-panel profile-password-form">
        <div className="min-w-0 space-y-4">
          <Box
            id="current_password"
            label="Current password"
            autoComplete="current-password"
            value={values.current_password}
            onChange={edit("current_password")}
            error={errors.current_password}
          />
          <Box
            id="new_password"
            label="New password"
            autoComplete="new-password"
            value={values.password}
            onChange={edit("password")}
            error={errors.password}
          />
          <Box
            id="confirm_password"
            label="Type the new password again"
            autoComplete="new-password"
            value={values.confirm_password}
            onChange={edit("confirm_password")}
            error={errors.confirm_password || (mismatch ? MISMATCH_MESSAGE : undefined)}
          />
        </div>

        <div aria-label="Password rules" className="min-w-0 self-start rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <p className="mb-1.5 font-medium text-foreground">Your new password needs</p>
          {rules.length > 0 ? (
            <ul className="list-disc space-y-1 pl-4">
              {rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          ) : (
            <p>{RULES_FALLBACK}</p>
          )}
          <p className="mt-2">It can't be the password you use now.</p>
        </div>

        {errors.form && (
          <p role="alert" className="profile-password-wide text-xs font-medium text-destructive">
            {errors.form}
          </p>
        )}

        {changed && (
          <div
            role="status"
            className="profile-password-wide flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900"
          >
            <CircleCheck className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 space-y-2">
              <p>
                <strong>Password changed.</strong> {SIGNED_OUT_EVERYWHERE_MESSAGE}
              </p>
              <Button type="button" variant="outline" size="sm" loading={leaving} disabled={leaving} onClick={signInAgain}>
                Sign in again now
              </Button>
            </div>
          </div>
        )}

        <div className="profile-password-wide flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {offline
              ? "You can change your password when you're back online."
              : "Saving signs you out everywhere, this device included."}
          </p>
          <div className="profile-password-actions">
            <Button type="button" variant="outline" size="sm" onClick={close} disabled={isLoading}>Cancel</Button>
            <Button type="submit" size="sm" disabled={!canSave} loading={isLoading}>Save password</Button>
          </div>
        </div>
      </form>}
    </section>
  );
}

function Box({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-foreground">
        {label}
      </label>
      <PasswordInput
        id={id}
        autoFocus={id === "current_password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <span id={`${id}-error`} className="block text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
