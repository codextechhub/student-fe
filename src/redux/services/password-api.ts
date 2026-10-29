import { baseApi } from "./base-api";

/** The rules the school enforces on every password, as sentences in the order to show them. */
export type PasswordPolicy = { min_length: number; requirements: string[] };

/** Exactly what the change sends: the password the pupil knows, and the new one twice. */
export type PasswordChange = { current_password: string; password: string; confirm_password: string };

export type PasswordRefusals = {
  current_password?: string;
  password?: string;
  confirm_password?: string;
  /** A refusal that belongs under no box: offline, a closed account. */
  form?: string;
};

/**
 * The signed-in pupil's own password: the policy to show beside the new one,
 * and the change itself. The same endpoints as school-fe's Account security,
 * so a pupil and a teacher meet the same rules and the same refusals.
 */
export const passwordApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    passwordPolicy: build.query<PasswordPolicy, void>({
      query: () => "/user/auth/password/policy/",
      transformResponse: (body: { data: PasswordPolicy }) => body.data,
    }),
    changePassword: build.mutation<void, PasswordChange>({
      query: (body) => ({ url: "/user/auth/password/change/", method: "POST", body }),
    }),
  }),
});

export const { usePasswordPolicyQuery, useChangePasswordMutation } = passwordApi;

const FIELDS = ["current_password", "password", "confirm_password"] as const;

/** One sentence from a field's refusal, which the API sends as a string or a list of them. */
function sentence(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string").join(" ");
  return "";
}

/**
 * Where each refusal of a password change belongs.
 *
 * The API names the box: `error.current_password` for a wrong current
 * password, `error.password` for the policy and for reusing the current one,
 * `error.confirm_password` for a mismatch. A policy refusal raised past those
 * checks arrives as `error.messages` with no box named; it can only be about
 * the new password. Anything else (no connection, a closed account) is the
 * form's to say.
 */
export function passwordRefusals(error: unknown): PasswordRefusals {
  if ((error as { status?: unknown })?.status === "FETCH_ERROR") {
    return { form: "You're offline. Try again when you have a connection." };
  }
  if ((error as { status?: unknown })?.status === "TIMEOUT_ERROR") {
    return { form: "The school took too long to answer. Try again." };
  }
  const data = (error as { data?: { message?: string; error?: Record<string, unknown> } })?.data;
  const detail = data?.error ?? {};
  const out: PasswordRefusals = {};
  for (const field of FIELDS) {
    const text = sentence(detail[field]);
    if (text) out[field] = text;
  }
  if (!out.password) {
    const policy = sentence(detail.messages);
    if (policy) out.password = policy;
  }
  if (Object.keys(out).length === 0) {
    out.form = data?.message || "Your password couldn't be changed. Try again in a moment.";
  }
  return out;
}
