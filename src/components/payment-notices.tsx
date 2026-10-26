import { ChevronRight, ReceiptText } from "lucide-react";
import { Link } from "react-router";

import { formatTimestampDate } from "@/lib/format";
import { noticeActionLabel, noticeHeadline, noticePath } from "@/lib/payment-notices";
import {
  useMarkPaymentNoticeReadMutation,
  usePaymentNoticesQuery,
} from "@/redux/services/payment-notices-api";

/**
 * The payments the school has booked that the pupil has not yet opened.
 *
 * One compact card holding a row per unread "payment received" notice from
 * the pupil's own notification feed: the amount large, "Payment received"
 * under it, the date and a "View receipt" cue beside. Each row opens the
 * receipt and clears itself as it is opened. It draws nothing while there is nothing new, while the feed is still
 * loading and when the feed cannot be read, so a quiet pupil sees no empty
 * block. A notice opens the receipt its address names, or Fees when it names none.
 */
export function PaymentNotices() {
  const { data: notices } = usePaymentNoticesQuery(undefined, { refetchOnMountOrArgChange: true });
  const shown = notices ?? [];
  const [markRead] = useMarkPaymentNoticeReadMutation();
  if (shown.length === 0) return null;

  return (
    <section className="home-payments-section" aria-labelledby="home-payments-title">
      <div className="screen-section">
        <h2 id="home-payments-title">Payments</h2>
        <span className="screen-section-aside">{shown.length === 1 ? "1 new" : `${shown.length} new`}</span>
      </div>
      <div className="screen-card home-payments-card">
        <ul className="home-payments">
          {shown.map((notice) => (
            <li key={notice.id}>
              <Link
                to={noticePath(notice.actionUrl)}
                className="home-payment"
                onClick={() => void markRead(notice.id)}
              >
                <span className="icon-tile icon-tile--good home-notice-icon">
                  <ReceiptText size={19} aria-hidden="true" />
                </span>
                <span className="home-payment-main">
                  <strong className="home-payment-amount">
                    <span className="home-unread-dot" aria-label="Unread" />
                    {noticeHeadline(notice.subject)}
                  </strong>
                  <span className="home-payment-line">Payment received</span>
                </span>
                <span className="home-payment-side">
                  <time dateTime={notice.createdAt}>{formatTimestampDate(notice.createdAt)}</time>
                  <span className="home-payment-action">
                    {noticeActionLabel(notice.actionUrl)}
                    <ChevronRight size={14} aria-hidden="true" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
