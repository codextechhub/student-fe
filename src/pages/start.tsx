import { PageShell } from "@/components/layout/page-shell";
import { SchoolMark } from "@/components/school-mark";
import { useSchoolNameQuery } from "@/redux/services/school-api";
import { schoolLogoUrl } from "@/utils/school-brand";
import { currentSchoolSlug } from "@/utils/school-host";

/**
 * The app's start page: the school's crest and name, read from the public
 * routes before anybody signs in.
 *
 * The sign-in form replaces the placeholder line once the per-pupil session
 * routes exist. An address that names no school says so plainly, because the
 * app cannot sign anybody in without knowing which school they belong to.
 */
export function StartPage() {
  const slug = currentSchoolSlug();
  const { data: name } = useSchoolNameQuery(slug, { skip: !slug });

  return (
    <PageShell className="flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
      <SchoolMark logo={slug ? schoolLogoUrl(slug) : null} alt="" size={72} animate={false} />
      {slug ? (
        <>
          <h1 className="text-base font-semibold text-foreground">{name || " "}</h1>
          <p className="max-w-xs text-xs text-muted-foreground">
            Student sign-in is not available yet.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-base font-semibold text-foreground">No school at this address</h1>
          <p className="max-w-xs text-xs text-muted-foreground">
            Open the student app from your school&apos;s own address, the one your school
            gave you.
          </p>
        </>
      )}
    </PageShell>
  );
}
