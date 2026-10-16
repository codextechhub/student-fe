import { useRef, useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { PupilAvatar } from "@/components/pupil-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { classLine } from "@/lib/pupil-lines";
import { useAppSelector } from "@/redux/hooks";
import {
  refusal,
  useMeQuery,
  useProfileQuery,
  useRemovePhotoMutation,
  useUpdateProfileMutation,
  useUploadPhotoMutation,
  type Profile,
} from "@/redux/services/portal-api";



/** The largest photo the school accepts, as the API checks it. */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * The pupil's own record.
 *
 * What the school manages (name, admission number, class, date of birth,
 * school email, primary guardian) is shown and cannot be changed here. The
 * pupil's own phone and personal email can, and the server's refusal for a
 * value it cannot store is shown under its box. The photo can be changed or
 * removed only where the school lets pupils do that. Nothing can be changed
 * offline.
 */
export function ProfilePage() {
  const { data: profile, isLoading, isError, refetch } = useProfileQuery();
  const { data: me } = useMeQuery();
  const offline = useAppSelector((s) => s.connectivity.offline);

  return (
    <PageShell grid className="mx-auto w-full max-w-5xl content-start gap-4 pt-4 lg:px-6">
      <PageHeader title="My profile" description="Your details at school, and the ones you can keep up to date yourself." />
      {isLoading && <div className="h-48 animate-pulse rounded-xl bg-muted" />}
      {isError && !profile && (
        <p className="rounded-xl border border-border p-4 text-xs text-muted-foreground">
          Your profile can&apos;t be shown right now.{" "}
          <button type="button" className="font-medium text-primary" onClick={() => refetch()}>
            Try again
          </button>
        </p>
      )}
      {profile && (
        <>
          <PhotoCard
            profile={profile}
            line={me ? [classLine(me), profile.managed_by_school.admission_number, me.school.name].filter(Boolean).join(" · ") : ""}
            offline={offline}
          />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SchoolDetails profile={profile} />
            <EditableDetails profile={profile} offline={offline} />
          </div>
        </>
      )}
    </PageShell>
  );
}

function PhotoCard({ profile, line, offline }: { profile: Profile; line: string; offline: boolean }) {
  const picker = useRef<HTMLInputElement>(null);
  const [upload, { isLoading: uploading }] = useUploadPhotoMutation();
  const [remove, { isLoading: removing }] = useRemovePhotoMutation();
  const name = profile.managed_by_school.full_name;

  const chosen = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("That photo is larger than 5 MB. Choose a smaller one.");
      return;
    }
    try {
      await upload(file).unwrap();
      toast.success("Photo updated");
    } catch (error) {
      toast.error(refusal(error).message);
    }
  };

  const drop = async () => {
    try {
      await remove().unwrap();
      toast.success("Photo removed");
    } catch (error) {
      toast.error(refusal(error).message);
    }
  };

  return (
    <section className="flex min-w-0 flex-wrap items-center gap-4 rounded-xl border border-border p-4">
      <PupilAvatar name={name} photo={profile.photo_url} size={64} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{line}</p>
      </div>
      {profile.photo_editable && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={picker}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              void chosen(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" disabled={offline || uploading} loading={uploading} onClick={() => picker.current?.click()}>
            Change photo
          </Button>
          {profile.photo_url && (
            <Button variant="ghost" size="sm" disabled={offline || removing} onClick={drop}>
              Remove photo
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 py-2 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-foreground sm:text-right">{value}</dd>
    </div>
  );
}

function SchoolDetails({ profile }: { profile: Profile }) {
  const m = profile.managed_by_school;
  const guardian = m.primary_guardian;
  return (
    <section className="min-w-0 rounded-xl border border-border p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Lock className="size-4 text-muted-foreground" /> Managed by the school
      </h2>
      <dl className="divide-y divide-border">
        <Row label="Full name" value={m.full_name} />
        <Row label="Admission number" value={m.admission_number || "None"} />
        <Row label="Class" value={[m.class_name, m.session_name].filter(Boolean).join(" · ") || "None"} />
        <Row label="Date of birth" value={m.date_of_birth ? formatDate(m.date_of_birth) : "None"} />
        <Row label="School email" value={m.school_email || "None"} />
        <Row
          label="Parent or guardian"
          value={
            guardian
              ? [`${guardian.name}${guardian.relationship ? ` (${guardian.relationship})` : ""}`, guardian.phone]
                  .filter(Boolean)
                  .join(" · ")
              : "None"
          }
        />
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">To change any of these, ask the school office.</p>
    </section>
  );
}

function EditableDetails({ profile, offline }: { profile: Profile; offline: boolean }) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(profile.editable.phone);
  const [email, setEmail] = useState(profile.editable.email);
  const [errors, setErrors] = useState<{ phone?: string; email?: string; form?: string }>({});
  const [save, { isLoading }] = useUpdateProfileMutation();

  const changed = phone.trim() !== profile.editable.phone || email.trim() !== profile.editable.email;

  const start = () => {
    setPhone(profile.editable.phone);
    setEmail(profile.editable.email);
    setErrors({});
    setEditing(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address.";
    if (next.email) return setErrors(next);
    const body: { phone?: string; email?: string } = {};
    if (phone.trim() !== profile.editable.phone) body.phone = phone.trim();
    if (email.trim() !== profile.editable.email) body.email = email.trim();
    try {
      await save(body).unwrap();
      setEditing(false);
      toast.success("Profile updated");
    } catch (error) {
      const { message, field } = refusal(error);
      setErrors(field === "phone" || field === "email" ? { [field]: message } : { form: message });
    }
  };

  return (
    <section className="min-w-0 rounded-xl border border-border p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">You can edit</h2>
        {!editing && (
          <Button variant="outline" size="sm" onClick={start} disabled={offline}>
            Edit
          </Button>
        )}
      </div>
      {!editing ? (
        <dl className="divide-y divide-border">
          <Row label="Phone number" value={profile.editable.phone || "None"} />
          <Row label="Personal email" value={profile.editable.email || "None"} />
        </dl>
      ) : (
        <form onSubmit={submit} noValidate className="mt-3 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-foreground">Phone number</span>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={!!errors.phone}
            />
            {errors.phone && <span className="block text-xs text-destructive">{errors.phone}</span>}
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-foreground">Personal email</span>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
            />
            {errors.email && <span className="block text-xs text-destructive">{errors.email}</span>}
          </label>
          {errors.form && <p className="text-xs text-destructive">{errors.form}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!changed || isLoading || offline} loading={isLoading}>
              Save changes
            </Button>
          </div>
        </form>
      )}
      {offline && <p className="mt-2 text-xs text-muted-foreground">You can change these when you&apos;re back online.</p>}
    </section>
  );
}
