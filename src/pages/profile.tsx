import { useRef, useState, type FormEvent } from "react";
import { Info, LockKeyhole, Pencil } from "lucide-react";
import { toast } from "sonner";

import { PageShell } from "@/components/layout/page-shell";
import { PupilAvatar } from "@/components/pupil-avatar";
import { PushSetting } from "@/components/push-settings";
import { formatDate } from "@/lib/format";
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

import "./profile.css";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** School-managed fields stay read-only; contact, photo and push settings retain their own permissions. */
export function ProfilePage() {
  const { data: profile, isLoading, isError, refetch } = useProfileQuery();
  const { data: me } = useMeQuery();
  const offline = useAppSelector((s) => s.connectivity.offline);

  return (
    <PageShell className="profile-page">
      <div className="profile-wrap">
        <header className="profile-heading">
          <p>Your school record</p>
          <h1>See your details and keep your contact information current.</h1>
        </header>
        {isLoading && !profile && <div className="profile-loading" role="status" aria-label="Loading profile" />}
        {isError && !profile && (
          <div className="profile-error" role="alert">
            Your profile can&apos;t be shown right now. <button type="button" onClick={() => refetch()}>Try again</button>
          </div>
        )}
        {profile && (
          <>
            <PhotoCard
              profile={profile}
              className={[profile.managed_by_school.class_name, profile.managed_by_school.session_name].filter(Boolean).join(" · ")}
              schoolName={me?.school.name ?? ""}
              offline={offline}
            />
            <div className="profile-cards">
              <EditableDetails profile={profile} offline={offline} />
              <SchoolDetails profile={profile} />
            </div>
          </>
        )}
        <PushSetting />
      </div>
    </PageShell>
  );
}

function PhotoCard({ profile, className, schoolName, offline }: { profile: Profile; className: string; schoolName: string; offline: boolean }) {
  const picker = useRef<HTMLInputElement>(null);
  const [upload, { isLoading: uploading }] = useUploadPhotoMutation();
  const [remove, { isLoading: removing }] = useRemovePhotoMutation();
  const name = profile.managed_by_school.full_name;

  const chosen = async (file: File | undefined) => {
    if (!file) return;
    if (!(["image/png", "image/jpeg", "image/webp"].includes(file.type))) {
      toast.error("Choose a PNG, JPEG or WebP photo.");
      return;
    }
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
    <section className="profile-hero" aria-label="Pupil identity">
      <div className="profile-hero-avatar"><PupilAvatar name={name} photo={profile.photo_url} size={104} /></div>
      <div className="profile-hero-content">
        <span className="profile-hero-label">Pupil profile</span>
        <h2>{name}</h2>
        {className && <p className="profile-hero-class">{className}</p>}
        <span className="profile-hero-id">Admission no. {profile.managed_by_school.admission_number || "None"}</span>
        {schoolName && <p className="profile-hero-school">{schoolName}</p>}
        {profile.photo_editable ? (
          <div className="profile-photo-actions">
            <input
              ref={picker}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Choose a profile photo"
              onChange={(event) => {
                void chosen(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button type="button" disabled={offline || uploading || removing} onClick={() => picker.current?.click()}>
              {uploading ? "Uploading…" : "Change photo"}
            </button>
            {profile.photo_url && <button type="button" className="is-remove" disabled={offline || removing || uploading} onClick={drop}>
              {removing ? "Removing…" : "Remove photo"}
            </button>}
          </div>
        ) : <p className="profile-photo-note">Your school manages profile photos.</p>}
      </div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="profile-row"><dt>{label}</dt><dd>{value || "None"}</dd></div>;
}

function SchoolDetails({ profile }: { profile: Profile }) {
  const managed = profile.managed_by_school;
  const guardian = managed.primary_guardian;
  const guardianLine = guardian
    ? [`${guardian.name}${guardian.relationship ? ` (${guardian.relationship})` : ""}`, guardian.phone].filter(Boolean).join(" · ")
    : "None";

  return (
    <section className="profile-surface profile-card profile-school">
      <div className="profile-card-heading">
        <span className="profile-card-icon"><LockKeyhole size={18} aria-hidden="true" /></span>
        <div><h2>Managed by the school</h2><p>Your official school details</p></div>
      </div>
      <dl className="profile-rows">
        <DetailRow label="Full name" value={managed.full_name} />
        <DetailRow label="Admission number" value={managed.admission_number} />
        <DetailRow label="Class and year" value={[managed.class_name, managed.session_name].filter(Boolean).join(" · ")} />
        <DetailRow label="Date of birth" value={managed.date_of_birth ? formatDate(managed.date_of_birth) : "None"} />
        <DetailRow label="School email" value={managed.school_email} />
        <DetailRow label="Parent or guardian" value={guardianLine} />
      </dl>
      <p className="profile-school-tip"><Info size={17} aria-hidden="true" /><span>Need to correct one of these? Ask the school office.</span></p>
    </section>
  );
}

function EditableDetails({ profile, offline }: { profile: Profile; offline: boolean }) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(profile.editable.phone);
  const [email, setEmail] = useState(profile.editable.email);
  const [errors, setErrors] = useState<{ phone?: string; email?: string; form?: string }>({});
  const [save, { isLoading }] = useUpdateProfileMutation();
  const invalidEmail = !!email.trim() && !EMAIL_PATTERN.test(email.trim());
  const changed = phone.trim() !== profile.editable.phone || email.trim() !== profile.editable.email;

  const start = () => {
    setPhone(profile.editable.phone);
    setEmail(profile.editable.email);
    setErrors({});
    setEditing(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (invalidEmail) {
      setErrors({ email: "Enter a valid email address." });
      return;
    }
    if (!changed || offline || isLoading) return;
    const body: { phone?: string; email?: string } = {};
    if (phone.trim() !== profile.editable.phone) body.phone = phone.trim();
    if (email.trim() !== profile.editable.email) body.email = email.trim();
    try {
      await save(body).unwrap();
      setEditing(false);
      toast.success("Contact details updated");
    } catch (error) {
      const { message, field } = refusal(error);
      setErrors(field === "phone" || field === "email" ? { [field]: message } : { form: message });
    }
  };

  return (
    <section className="profile-surface profile-card profile-contact">
      <div className="profile-card-top">
        <div className="profile-card-heading">
          <span className="profile-card-icon"><Pencil size={19} aria-hidden="true" /></span>
          <div><h2>Your contact details</h2><p>You can keep these up to date</p></div>
        </div>
        {!editing && <button type="button" className="profile-edit-button" onClick={start} disabled={offline}>Edit details</button>}
      </div>
      {editing ? (
        <form className="profile-form" onSubmit={submit} noValidate>
          <div className="profile-field">
            <label htmlFor="profile-phone">Phone number</label>
            <input id="profile-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} aria-invalid={!!errors.phone} onChange={(event) => {
              setPhone(event.target.value);
              setErrors((current) => ({ ...current, phone: undefined, form: undefined }));
            }} />
            <p className="profile-field-hint">Use a number the school can reach.</p>
            {errors.phone && <p className="profile-field-error" role="alert">{errors.phone}</p>}
          </div>
          <div className="profile-field">
            <label htmlFor="profile-email">Personal email</label>
            <input id="profile-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} aria-invalid={invalidEmail || !!errors.email} onChange={(event) => {
              setEmail(event.target.value);
              setErrors((current) => ({ ...current, email: undefined, form: undefined }));
            }} />
            {invalidEmail && <p className="profile-field-error" role="alert">Enter a valid email address.</p>}
            {!invalidEmail && errors.email && <p className="profile-field-error" role="alert">{errors.email}</p>}
          </div>
          {errors.form && <p className="profile-field-error" role="alert">{errors.form}</p>}
          <div className="profile-form-actions">
            <button type="button" className="profile-cancel" onClick={() => { setEditing(false); setErrors({}); }}>Cancel</button>
            <button type="submit" className="profile-save" disabled={!changed || invalidEmail || isLoading || offline}>{isLoading ? "Saving…" : "Save changes"}</button>
          </div>
        </form>
      ) : <dl className="profile-rows">
        <DetailRow label="Phone number" value={profile.editable.phone} />
        <DetailRow label="Personal email" value={profile.editable.email} />
      </dl>}
      {offline && <p className="profile-offline-note">You can change these when you&apos;re back online.</p>}
    </section>
  );
}
