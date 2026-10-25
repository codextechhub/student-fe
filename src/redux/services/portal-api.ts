import { apiAddress } from "@/auth/api";

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
        /** Open bills and charges, never reduced by credit. */
        owing: number;
        /** Credit the school holds for the pupil. */
        credit: number;
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
        /** Whether the school takes card payments; absent from a copy saved before the school sent it. */
        card_payments?: boolean;
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

/** One fee bill: its lines and what is still owed, all in kobo. */
export type Invoice = {
  invoice_ref: number;
  number: string;
  title: string;
  invoice_date: string | null;
  due_date: string | null;
  lines: { description: string; amount: number }[];
  total: number;
  paid: number;
  balance: number;
  status: string;
  status_label: string;
};

/**
 * A charge the school added to the pupil's account after a bill, such as a
 * replacement ID card. It is not a bill, so it cannot be paid by card here: a
 * transfer into the pupil's account number settles it, oldest charge first.
 */
export type DebitNote = {
  note_ref: number;
  number: string;
  date: string | null;
  reason: string;
  total: number;
  paid: number;
  balance: number;
  status: string;
  status_label: string;
};

/**
 * The pupil's fees. `owing` is what open bills and charges add up to and is
 * never reduced by credit; `credit` is what the school holds for the pupil;
 * `balance` is `owing` less `credit`, kept for older readers. `can_pay` is the
 * school's choice to let pupils pay here; `min_part_payment` its smallest card
 * part payment, in kobo. `card_payments` is the school's choice to take card
 * payments at all: when it is false the family pays only by transfer into the
 * pupil's own account number. It is absent from an answer saved before the
 * school sent it, which reads as card on (see `lib/card-payments`).
 */
export type Fees = {
  balance: number;
  owing: number;
  credit: number;
  total_billed: number;
  total_paid: number;
  invoices: Invoice[];
  /** Absent from a copy saved before the school sent charges. */
  debit_notes?: DebitNote[];
  can_pay: boolean;
  card_payments?: boolean;
  min_part_payment: number;
};

export type PageInfo = { page: number; page_size: number; total: number; total_pages: number };
export type FeeBill = ({ kind: "invoice" } & Invoice) | ({ kind: "charge" } & DebitNote);
export type FeeBillsPage = Omit<Fees, "invoices" | "debit_notes"> & {
  has_bills: boolean;
  years: string[];
  next_due: string | null;
  items: FeeBill[];
  pagination: PageInfo;
};
export type PaymentsPage = { items: Payment[]; years: string[]; pagination: PageInfo };

/** A payment on the pupil's account: confirmed with a receipt, or online and still being confirmed. */
export type Payment = {
  payment_ref: number | null;
  reference: string;
  amount: number;
  status: "CONFIRMED" | "PENDING" | string;
  status_label: string;
  method: string;
  method_label: string;
  paid_on: string | null;
  /** Who started an online payment; empty for a transfer or one the school recorded. */
  payer_name: string;
  /** How the money arrived: a transfer into the pupil's account, online, or recorded by the school. */
  source?: "TRANSFER_ACCOUNT" | "ONLINE" | "SCHOOL" | string;
  source_label?: string;
  receipt_number: string;
  invoice_number: string;
  has_receipt: boolean;
};

export type Receipt = {
  payment_ref: number;
  receipt_number: string;
  paid_on: string;
  amount: number;
  method: string;
  method_label: string;
  reference: string;
  payer_name: string;
  received_from: string;
  lines: { invoice_number: string; title: string; amount_applied: number; balance_after: number }[];
  balance_after: number;
  issuer_name: string;
};

/** The family's own account number for paying fees by transfer. */
export type TransferAccount =
  | { state: "ISSUED"; bank_name: string; account_number: string; account_name: string; as_of: string }
  | { state: "NONE"; as_of: string }
  | { state: "UNAVAILABLE"; message: string };

export type Deposit = {
  reference: string;
  amount: number;
  status: "PENDING" | "CONFIRMED" | string;
  status_label: string;
  received_at: string;
  payment_ref: number | null;
  has_receipt: boolean;
};

/** A card payment handed to the gateway: where to send the pupil, and how to follow it. */
export type Checkout = { checkout_url: string; reference: string; amount: number; balance_after: number };

/** What the public status route says about a payment, by its reference. */
export type PaymentStatus = {
  status: "PENDING" | "CONFIRMED" | "FAILED" | "ABANDONED";
  amount: number;
  amount_naira: string;
  payee_name: string;
  paid_at: string | null;
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
    fees: build.query<Fees, void>({
      query: () => "/portal/student/fees/",
      transformResponse: unwrap<Fees>,
      providesTags: ["Fees"],
    }),
    feeBills: build.query<FeeBillsPage, { page: number; year: string; status: string }>({
      query: ({ page, year, status }) => `/portal/student/fees/?page=${page}&year=${encodeURIComponent(year)}&status=${encodeURIComponent(status)}`,
      transformResponse: unwrap<FeeBillsPage>,
      providesTags: ["Fees"],
    }),
    payments: build.query<Payment[], void>({
      query: () => "/portal/student/fees/payments/",
      transformResponse: unwrap<Payment[]>,
      providesTags: ["Fees"],
    }),
    paymentPage: build.query<PaymentsPage, { page: number; year: string }>({
      query: ({ page, year }) => `/portal/student/fees/payments/?page=${page}&year=${encodeURIComponent(year)}`,
      transformResponse: unwrap<PaymentsPage>,
      providesTags: ["Fees"],
    }),
    receipt: build.query<Receipt, number>({
      query: (ref) => `/portal/student/fees/payments/${ref}/receipt/`,
      transformResponse: unwrap<Receipt>,
      providesTags: ["Fees"],
    }),
    /** The receipt's PDF, the one the school's receipt email attaches, as a local `blob:` address. */
    receiptPdf: build.query<string, number>({
      queryFn: async (ref, _api, _extra, baseQuery) => {
        const result = await baseQuery({
          url: `/portal/student/fees/payments/${ref}/receipt/?as=pdf`,
          responseHandler: async (r) => (r.ok ? r.blob() : r.text()),
        });
        if (result.error) return { error: result.error };
        return { data: URL.createObjectURL(result.data as Blob) };
      },
      keepUnusedDataFor: 0,
    }),
    startPayment: build.mutation<Checkout, { invoiceRef: number; amount: number }>({
      query: ({ invoiceRef, amount }) => ({
        url: `/portal/student/fees/invoices/${invoiceRef}/pay/`,
        method: "POST",
        body: { amount },
      }),
      transformResponse: unwrap<Checkout>,
    }),
    transferAccount: build.query<TransferAccount, void>({
      query: () => "/portal/student/fees/transfer-account/",
      transformResponse: unwrap<TransferAccount>,
      providesTags: ["TransferAccount"],
    }),
    openTransferAccount: build.mutation<TransferAccount, void>({
      query: () => ({ url: "/portal/student/fees/transfer-account/", method: "POST", body: {} }),
      transformResponse: unwrap<TransferAccount>,
      invalidatesTags: ["TransferAccount"],
    }),
    deposits: build.query<{ as_of: string; deposits: Deposit[] }, string>({
      query: (since) => `/portal/student/fees/transfer-account/deposits/?since=${encodeURIComponent(since)}`,
      transformResponse: unwrap<{ as_of: string; deposits: Deposit[] }>,
      // A watch is a live look, never kept for offline and never answered from a copy.
      extraOptions: { live: true },
    }),
    paymentStatus: build.query<PaymentStatus, string>({
      query: (reference) => `/payments/public/collections/${encodeURIComponent(reference)}/status/`,
      transformResponse: unwrap<PaymentStatus>,
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
     * A picture the API serves only to a signed-in reader (the pupil's
     * photograph, the school's crest), fetched with the pupil's token and shown
     * from a local `blob:` address, because an `<img>` cannot send the token
     * itself.
     */
    authImage: build.query<string, string>({
      queryFn: async (url, _api, _extra, baseQuery) => {
        const result = await baseQuery({
          url: apiAddress(url),
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
  useFeesQuery,
  useFeeBillsQuery,
  usePaymentsQuery,
  usePaymentPageQuery,
  useReceiptQuery,
  useLazyReceiptPdfQuery,
  useStartPaymentMutation,
  useTransferAccountQuery,
  useOpenTransferAccountMutation,
  useDepositsQuery,
  usePaymentStatusQuery,
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
