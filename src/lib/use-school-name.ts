import { useSyncExternalStore } from "react";

import { useSchoolNameQuery } from "@/redux/services/school-api";
import { currentSchoolSlug } from "@/utils/school-host";

import { schoolFullName, subscribeSchoolName } from "./school-app";

/**
 * The school's full name ("Meridian Crest Academy"): the one the page is
 * named with, else its public name, else "" while it is read.
 */
export function useSchoolName(): string {
  const named = useSyncExternalStore(subscribeSchoolName, schoolFullName);
  const slug = currentSchoolSlug();
  const { data: schoolName } = useSchoolNameQuery(slug, { skip: !slug || !!named });
  return named || schoolName || "";
}
