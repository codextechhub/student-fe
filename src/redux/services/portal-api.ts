import { baseApi } from "./base-api";

/** The signed-in pupil, for the app's header and the switcher. */
export type Me = {
  student: {
    id: number;
    first_name: string;
    full_name: string;
    initials: string;
    photo_url: string;
    admission_number: string;
    class_name: string;
    level_name: string;
    /**
     * True in the holiday after a year-end promotion: `class_name` is then
     * next year's class and `session` next year's.
     */
    class_is_next_year?: boolean;
  };
  school: { name: string; logo_url: string };
  show_branch: boolean;
  branch?: { id: number; name: string };
  session: { id: number; name: string } | null;
  term: { id: number; name: string } | null;
};

/** The pupil portal's reads, all for the pupil who is showing. */
export const portalApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    me: build.query<Me, void>({
      query: () => "/portal/student/me/",
      transformResponse: (body: { data: Me }) => body.data,
    }),
  }),
});

export const { useMeQuery } = portalApi;
