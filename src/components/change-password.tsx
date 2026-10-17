import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { CircleCheck, KeyRound } from "lucide-react";

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
  "You're now signed out on every phone and computer, this one included. " +
  "Each will ask for your new password within 15 minutes. " +
  "Anyone else signed in on this phone stays signed in.";

/** The policy in one sentence, for while the school's own list loads or can't be read. */
const RULES_FALLBACK =
  "At least 12 characters, with an uppercase letter, a lowercase letter, a number and a special character.";

type Field = "current_password" | "password" | "confirm_password";

/**
 * The pupil changes their own password, knowing the current one.
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
  const { data: policy } = usePasswordPolicyQuery();
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
    <section aria-labelledby="password-heading" className="min-w-0 rounded-xl border border-border p-4">
      <h2 id="password-heading" className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
        <KeyRound className="size-4 text-muted-foreground" /> Password
      </h2>
      <p className="text-xs text-muted-foreground">
        Change it if anyone else might know it. You need the password you use now.
      </p>

      <form onSubmit={submit} noValidate className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
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
          <p role="alert" className="text-xs font-medium text-destructive lg:col-span-2">
            {errors.form}
          </p>
        )}

        {changed && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900 lg:col-span-2"
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

        <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2">
          <p className="text-xs text-muted-foreground">
            {offline
              ? "You can change your password when you're back online."
              : "Saving signs you out everywhere, this phone included."}
          </p>
          <Button type="submit" size="sm" disabled={!canSave} loading={isLoading}>
            Save password
          </Button>
        </div>
      </form>
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
