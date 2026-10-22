import { baseApi } from "./base-api";

/** The longest message the school accepts, in characters. */
export const MESSAGE_MAX = 4000;

/** The sentence every list carries; the app shows this one if an old copy lacks it. */
export const OVERSIGHT_FALLBACK = "Your parent or guardian and the school can read your messages.";

/** The member of staff at the other end, with how the pupil knows them. */
export type Counterpart = { user_id: number; name: string; label: string };

export type LastMessage = {
  id: number;
  preview: string;
  sender_name: string;
  sent_at: string;
  mine: boolean;
};

/** One of the pupil's conversations, as the list and the thread header read it. */
export type Conversation = {
  id: number;
  kind: string;
  kind_label: string;
  display_name: string;
  counterpart: Counterpart | null;
  last_message: LastMessage | null;
  last_activity_at: string;
  unread_count: number;
  read_only: boolean;
  can_send: boolean;
  read_only_reason: string;
  /** True while the school shows read receipts to this pupil; ticks are drawn only then. */
  receipts?: boolean;
};

/** Whether the person written to has read a message the pupil sent. */
export type Receipt = { state: "sent" | "read"; read_count: number; recipient_count: number };

/** A receipt as a poll answers it, named by the message it belongs to. */
export type ReceiptUpdate = Receipt & { id: number };

export type ChatMessage = {
  id: number;
  body: string;
  sender: { user_id: number; name: string } | null;
  sent_at: string;
  mine: boolean;
  /** Present on the pupil's own messages while receipts apply. */
  receipt?: Receipt;
};

export type ConversationPage = {
  rows: Conversation[];
  unreadCount: number;
  oversightNotice: string;
  next: number | null;
};

/** One cursor page of a thread, newest first as the school sends it. */
export type MessagePage = { results: ChatMessage[]; hasMore: boolean; nextBefore: number | null };

/** What changed in a thread since a message: newer messages, oldest first, and fresh receipts. */
export type PollAnswer = { results: ChatMessage[]; hasMore: boolean; receipts: ReceiptUpdate[] };

export type Contact = { user_id: number; name: string; label: string };

export type ContactsPage = {
  contacts: Contact[];
  canStart: boolean;
  canStartReason: string;
  oversightNotice: string;
};

type Paged<T> = {
  data: T[];
  pagination?: { currentPage: number; totalPages: number };
};

const next = (body: Paged<unknown>) =>
  body.pagination && body.pagination.currentPage < body.pagination.totalPages ? body.pagination.currentPage + 1 : null;

const unwrap = <T,>(body: { data: T }) => body.data;

/** How many contacts one request asks for; a pupil has far fewer teachers than this. */
const CONTACTS_PAGE_SIZE = 100;

/**
 * The pupil's messages with their teachers and the school office.
 *
 * A thread is read a cursor page at a time (`before` is the oldest message id
 * already held). Every list, row and count shares the `Conversations` tag, so
 * a send or a read refreshes them together; a thread is tagged by its own id.
 * `messagesAfter` is the poll: the messages newer than the newest held and the
 * receipts of the pupil's recent ones. Nothing here is kept by address outside the pupil's own cache: the base
 * query keeps each read per pupil for the offline copy, and the cache is
 * emptied when the pupil showing changes.
 */
export const messagesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    conversations: build.query<ConversationPage, number>({
      query: (page) => `/portal/student/messages/conversations/?page=${page}`,
      transformResponse: (body: Paged<Conversation> & { unread_count?: number; oversight_notice?: string }) => ({
        rows: body.data,
        unreadCount: body.unread_count ?? 0,
        oversightNotice: body.oversight_notice || OVERSIGHT_FALLBACK,
        next: next(body),
      }),
      providesTags: ["Conversations"],
    }),
    conversation: build.query<Conversation, number>({
      query: (id) => `/portal/student/messages/conversations/${id}/`,
      transformResponse: unwrap<Conversation>,
      providesTags: ["Conversations"],
    }),
    messagesPage: build.query<MessagePage, { id: number; before: number | null }>({
      query: ({ id, before }) =>
        `/portal/student/messages/conversations/${id}/messages/?limit=30${before ? `&before=${before}` : ""}`,
      transformResponse: (body: { data: { results: ChatMessage[]; has_more: boolean; next_before: number | null } }) => ({
        results: body.data.results,
        hasMore: body.data.has_more,
        nextBefore: body.data.next_before,
      }),
      providesTags: (_result, _error, { id }) => [{ type: "MessageThread", id }],
    }),
    messagesAfter: build.query<PollAnswer, { id: number; after: number }>({
      query: ({ id, after }) => `/portal/student/messages/conversations/${id}/messages/?after=${after}`,
      transformResponse: (body: { data: { results: ChatMessage[]; has_more: boolean; receipts?: ReceiptUpdate[] } }) => ({
        results: body.data.results,
        hasMore: body.data.has_more,
        receipts: body.data.receipts ?? [],
      }),
      // A poll is a live look, never kept for offline and never answered from a copy.
      extraOptions: { live: true },
      keepUnusedDataFor: 0,
    }),
    unreadMessages: build.query<number, void>({
      query: () => "/portal/student/messages/unread-count/",
      transformResponse: (body: { data: { total: number } }) => body.data.total,
      providesTags: ["Conversations"],
    }),
    contacts: build.query<ContactsPage, void>({
      query: () => `/portal/student/messages/contacts/?page_size=${CONTACTS_PAGE_SIZE}`,
      transformResponse: (body: Paged<Contact> & { can_start?: boolean; can_start_reason?: string; oversight_notice?: string }) => ({
        contacts: body.data,
        canStart: body.can_start ?? false,
        canStartReason: body.can_start_reason ?? "",
        oversightNotice: body.oversight_notice || OVERSIGHT_FALLBACK,
      }),
    }),
    sendMessage: build.mutation<ChatMessage, { id: number; body: string; clientToken: string }>({
      query: ({ id, body, clientToken }) => ({
        url: `/portal/student/messages/conversations/${id}/messages/`,
        method: "POST",
        body: { body, client_token: clientToken },
      }),
      transformResponse: unwrap<ChatMessage>,
      // Show the stored message at once; the refetch the tags cause confirms it.
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        try {
          const { data: sent } = await queryFulfilled;
          dispatch(
            messagesApi.util.updateQueryData("messagesPage", { id, before: null }, (draft) => {
              if (!draft.results.some((m) => m.id === sent.id)) draft.results.unshift(sent);
            }),
          );
        } catch {
          // The screen reports a refused send; nothing to undo here.
        }
      },
      invalidatesTags: (_result, _error, { id }) => ["Conversations", { type: "MessageThread", id }],
    }),
    markConversationRead: build.mutation<{ conversation: number; unread_count: number }, { id: number; upTo?: number }>({
      query: ({ id, upTo }) => ({
        url: `/portal/student/messages/conversations/${id}/read/`,
        method: "POST",
        body: upTo ? { up_to: upTo } : {},
      }),
      transformResponse: unwrap<{ conversation: number; unread_count: number }>,
      invalidatesTags: ["Conversations"],
    }),
    startConversation: build.mutation<
      { conversation: Conversation; message: ChatMessage | null },
      { staff: number; body: string; clientToken: string }
    >({
      query: ({ staff, body, clientToken }) => ({
        url: "/portal/student/messages/conversations/",
        method: "POST",
        body: { staff, body, client_token: clientToken },
      }),
      transformResponse: unwrap<{ conversation: Conversation; message: ChatMessage | null }>,
      invalidatesTags: ["Conversations"],
    }),
  }),
});

export const {
  useConversationsQuery,
  useConversationQuery,
  useMessagesPageQuery,
  useLazyMessagesPageQuery,
  useLazyMessagesAfterQuery,
  useUnreadMessagesQuery,
  useContactsQuery,
  useSendMessageMutation,
  useMarkConversationReadMutation,
  useStartConversationMutation,
} = messagesApi;
