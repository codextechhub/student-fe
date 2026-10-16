import { baseApi } from "./base-api";
import type { ReportCard } from "./report-card-types";

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

/** A Home block that could not be read: show its sentence, never a zero. */
export type Unavailable = { available: false; message: string };

/** One period of today, with where the day has got to. */
export type TodayPeriod = {
  start_time: string;
  end_time: string;
  kind: "LESSON" | "BREAK" | string;
  label: string;
  subject?: string;
  teacher?: string;
  room?: string;
  state: "done" | "now" | "next" | "later";
};

/** Today's attendance cell: `MARKED` carries the mark; the other states say why there is none. */
export type AttendanceToday = {
  date: string;
  state: "MARKED" | "NOT_TAKEN" | "CLOSED" | "SUSPENDED" | "NOT_ON_ROLL" | string;
  mark: string | null;
  mark_label: string | null;
  arrived_at: string | null;
  closed_reason: string | null;
};

export type Notice = {
  id: number;
  title: string;
  body: string;
  audience_label: string;
  published_at: string;
  edited_at: string | null;
  unread: boolean;
};

export type Home = {
  date: string;
  today: ({ available: true; published: boolean; date: string | null; periods: TodayPeriod[] }) | Unavailable;
  attendance:
    | ({
        available: true;
        term: { id: number; name: string; session_name: string } | null;
        today: AttendanceToday | null;
        rate: number | null;
      })
    | Unavailable;
  fees:
    | ({
        available: true;
        balance: number;
        status: "OWING" | "CLEAR" | "IN_CREDIT";
        open_invoice: {
          invoice_ref: number;
          number: string;
          title: string;
          due_date: string | null;
          balance: number;
          status: string;
          status_label: string;
        } | null;
        open_invoice_count: number;
        can_pay: boolean;
      })
    | Unavailable;
  notices: ({ available: true; latest: Notice | null; unread_count: number }) | Unavailable;
  notifications: ({ available: true; unread_count: number }) | Unavailable;
};

export type NoticePage = {
  notices: Notice[];
  unreadCount: number;
  next: number | null;
};

export type Profile = {
  photo_url: string;
  photo_editable: boolean;
  managed_by_school: {
    full_name: string;
    admission_number: string;
    class_name: string;
    session_name: string;
    date_of_birth: string | null;
    school_email: string;
    primary_guardian: { name: string; relationship: string; phone: string } | null;
  };
  editable: { phone: string; email: string };
};

/** One period in the week grid. */
export type TimetableCell = {
  start_time: string;
  end_time: string;
  kind: "LESSON" | "BREAK" | string;
  label: string;
  subject?: string;
  teacher?: string;
  room?: string;
};

export type Timetable = {
  published: boolean;
  class_name: string;
  days: { day_of_week: number; day_label: string; is_today: boolean; cells: TimetableCell[] }[];
  today: { date: string; periods: TodayPeriod[] } | null;
};

/** A term the pupil can look at attendance for. */
export type AttendanceTerm = {
  id: number;
  name: string;
  session_name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

/** One school day: marked (with its mark), not taken yet, closed, suspended, or before the pupil joined. */
export type AttendanceDay = {
  date: string;
  state: "MARKED" | "NOT_TAKEN" | "CLOSED" | "SUSPENDED" | "NOT_ON_ROLL" | string;
  mark: "P" | "L" | "A" | "E" | null;
  arrived_at: string | null;
  closed_reason: string | null;
};

export type AttendanceNote = {
  date: string;
  mark: "L" | "A" | "E";
  mark_label: string;
  reason_label: string | null;
  note: string;
  arrived_at: string | null;
};

export type Attendance = {
  term: AttendanceTerm | null;
  terms: AttendanceTerm[];
  counts: {
    present: number;
    late: number;
    absent: number;
    excused: number;
    not_taken: number;
    opened: number;
    rate: number | null;
  };
  days: AttendanceDay[];
  notes: AttendanceNote[];
  today: AttendanceDay | null;
};

/** A term the pupil has a published result for: released, or held by the school. */
export type ResultTerm = { id: number; name: string; session: string; state: "released" | "withheld" };

/** One subject's result in a released term. */
export type SubjectResult = {
  name: string;
  /** The main teacher, frozen when the card was published; null on older cards. */
  teacher: string | null;
  cells: { short_name: string; max_score: number | null; mark: number | string | null }[];
  total: number | null;
  obtainable: number | null;
  percentage: string | null;
  grade: string | null;
  remark: string | null;
};

/**
 * One term's result. `withheld` carries the school's sentence and no figures;
 * `not_published` means nothing has been published for the pupil yet.
 */
export type TermResult = {
  state: "released" | "withheld" | "not_published";
  term: { id: number; name: string; session: string } | null;
  terms: ResultTerm[];
  message?: string;
  released_at?: string;
  class_name?: string;
  components?: { short_name: string; max_score: number; is_exam: boolean }[];
  subjects?: SubjectResult[];
  summary?: {
    overall_average: string | null;
    subjects: number;
    position?: number;
    position_label?: string;
    /** Only where the school shows class figures. */
    class_average?: string;
  };
  teacher_comment?: string;
  class_teacher?: string | null;
  next_term_begins?: string | null;
};

/** The school year: each term's figures and, once the last term is released, the year's block. */
export type SessionResults = {
  state: "released" | "withheld" | "not_published";
  session: { id: number; name: string } | null;
  terms: (ResultTerm & {
    released_at?: string;
    average?: string | null;
    position_label?: string;
    class_average?: string;
  })[];
  terms_released?: number;
  terms_total?: number;
  cumulative: null | {
    terms: { id: number; name: string }[];
    subjects: {
      name: string;
      terms: { term: string; percentage: string | null }[];
      annual_average: string | null;
      annual_grade?: string | null;
    }[];
    annual_average: string | null;
    annual_position_label?: string;
    class_average?: string;
    promotion: string | null;
    remark: string;
    class_teacher: string | null;
  };
  next_term_begins?: string | null;
};

const unwrap = <T,>(body: { data: T }) => body.data;

/** The pupil portal's reads and the pupil's own few writes, all for the pupil showing. */
export const portalApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    me: build.query<Me, void>({
      query: () => "/portal/student/me/",
      transformResponse: unwrap<Me>,
      providesTags: ["Me"],
    }),
    home: build.query<Home, void>({
      query: () => "/portal/student/home/",
      transformResponse: unwrap<Home>,
      providesTags: ["Home"],
    }),
    timetable: build.query<Timetable, void>({
      query: () => "/portal/student/timetable/",
      transformResponse: unwrap<Timetable>,
      providesTags: ["Timetable"],
    }),
    attendance: build.query<Attendance, number | null>({
      query: (term) => (term ? `/portal/student/attendance/?term=${term}` : "/portal/student/attendance/"),
      transformResponse: unwrap<Attendance>,
      providesTags: ["Attendance"],
    }),
    results: build.query<TermResult, number | null>({
      query: (term) => (term ? `/portal/student/results/?term=${term}` : "/portal/student/results/"),
      transformResponse: unwrap<TermResult>,
      providesTags: ["Results"],
    }),
    sessionResults: build.query<SessionResults, void>({
      query: () => "/portal/student/results/session/",
      transformResponse: unwrap<SessionResults>,
      providesTags: ["Results"],
    }),
    reportCard: build.query<ReportCard, number>({
      query: (term) => `/portal/student/results/report-card/?term=${term}`,
      transformResponse: unwrap<ReportCard>,
      providesTags: ["Results"],
    }),
    notices: build.query<NoticePage, number>({
      query: (page) => `/portal/student/notices/?page=${page}`,
      transformResponse: (body: {
        data: Notice[];
        unread_count: number;
        pagination?: { currentPage: number; totalPages: number };
      }) => ({
        notices: body.data,
        unreadCount: body.unread_count,
        next:
          body.pagination && body.pagination.currentPage < body.pagination.totalPages
            ? body.pagination.currentPage + 1
            : null,
      }),
      providesTags: ["Notices"],
    }),
    notice: build.query<Notice, number>({
      query: (id) => `/portal/student/notices/${id}/`,
      transformResponse: unwrap<Notice>,
      providesTags: ["Notices"],
    }),
    markNoticeRead: build.mutation<Notice, number>({
      query: (id) => ({ url: `/portal/student/notices/${id}/read/`, method: "POST", body: {} }),
      invalidatesTags: ["Notices", "Home"],
    }),
    markAllNoticesRead: build.mutation<void, void>({
      query: () => ({ url: "/portal/student/notices/read-all/", method: "POST", body: {} }),
      invalidatesTags: ["Notices", "Home"],
    }),
    profile: build.query<Profile, void>({
      query: () => "/portal/student/profile/",
      transformResponse: unwrap<Profile>,
      providesTags: ["Profile"],
    }),
    updateProfile: build.mutation<Profile, { phone?: string; email?: string }>({
      query: (body) => ({ url: "/portal/student/profile/", method: "PATCH", body }),
      transformResponse: unwrap<Profile>,
      invalidatesTags: ["Profile"],
    }),
    uploadPhoto: build.mutation<Profile, File>({
      query: (file) => {
        const body = new FormData();
        body.append("file", file);
        return { url: "/portal/student/profile/photo/", method: "POST", body };
      },
      transformResponse: unwrap<Profile>,
      invalidatesTags: ["Profile", "Me"],
    }),
    /**
     * A picture the API serves only to the signed-in pupil (their photograph),
     * fetched with their token and shown from a local `blob:` address, because
     * an `<img>` cannot send the token itself.
     */
    authImage: build.query<string, string>({
      queryFn: async (url, _api, _extra, baseQuery) => {
        const result = await baseQuery({
          url: new URL(url, window.location.origin).href,
          responseHandler: async (r) => (r.ok ? r.blob() : r.text()),
        });
        if (result.error) return { error: result.error };
        return { data: URL.createObjectURL(result.data as Blob) };
      },
      keepUnusedDataFor: 3600,
    }),
    removePhoto: build.mutation<Profile, void>({
      query: () => ({ url: "/portal/student/profile/photo/", method: "DELETE" }),
      transformResponse: unwrap<Profile>,
      invalidatesTags: ["Profile", "Me"],
    }),
  }),
});

export const {
  useMeQuery,
  useHomeQuery,
  useTimetableQuery,
  useAttendanceQuery,
  useResultsQuery,
  useSessionResultsQuery,
  useReportCardQuery,
  useNoticesQuery,
  useNoticeQuery,
  useMarkNoticeReadMutation,
  useMarkAllNoticesReadMutation,
  useProfileQuery,
  useUpdateProfileMutation,
  useUploadPhotoMutation,
  useRemovePhotoMutation,
  useAuthImageQuery,
} = portalApi;

/** The sentence and field of a refused write, as the portal words it. */
export function refusal(error: unknown): { message: string; field?: string } {
  const data = (error as { data?: { message?: string; error?: { detail?: { field?: string } } } })?.data;
  if ((error as { status?: unknown })?.status === "FETCH_ERROR") {
    return { message: "You're offline. Try again when you have a connection." };
  }
  return {
    message: data?.message || "That couldn't be saved. Try again in a moment.",
    field: data?.error?.detail?.field,
  };
}
