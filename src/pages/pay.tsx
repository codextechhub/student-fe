import { useState } from "react";
import { Building2, Check, CreditCard, Lock, Wallet } from "lucide-react";
import { useParams } from "react-router";

import { TransferPanel } from "@/components/fees/transfer-panel";
import { PageShell } from "@/components/layout/page-shell";
import { BottomBar, DetailBar } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { cardPaymentsOn, isCardPaymentsOff } from "@/lib/card-payments";
import { formatDate, formatNaira, parseNaira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { openCheckout } from "@/native/checkout";
import { isNativeApp } from "@/native/platform";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { baseApi } from "@/redux/services/base-api";
import {
  refusal,
  useFeesQuery,
  useStartPaymentMutation,
  type Fees,
  type Invoice,
} from "@/redux/services/portal-api";

import "./fees.css";
import "./pay.css";

/**
 * One bill, paid on the gateway or into the pupil's permanent bank account
 * (design 2h). A screen opened from Fees, with its own back bar; on the card
 * route "Continue to secure payment" waits in the bar at the foot.
 *
 * Where the school takes no card payments the page shows the transfer view
 * only, with no method choice. A screen that was open before the school
 * turned card off finds out when its card checkout is refused: the fees are
 * read again and the page falls to the transfer view with a plain line, not
 * an error.
 */
export function PayPage() {
  const { invoiceRef } = useParams();
  const dispatch = useAppDispatch();
  const { data: fees, isLoading } = useFeesQuery();
  const offline = useAppSelector((s) => s.connectivity.offline);
  const [method, setMethod] = useState<"card" | "transfer">("card");
  const [refused, setRefused] = useState(false);
  const invoice = fees?.invoices.find((item) => String(item.invoice_ref) === invoiceRef);
  const cardOn = !!fees && cardPaymentsOn(fees) && !refused;

  const cardTurnedOff = () => {
    setRefused(true);
    dispatch(baseApi.util.invalidateTags(["Fees", "Home"]));
  };

  return (
    <PageShell className="pay-page">
      <DetailBar title="Pay a bill" back="/fees" backLabel="Back to fees" />
      <div className="pay-wrap">
        {isLoading && !fees && <div className="pay-loading" role="status" aria-label="Loading bill" />}
        {fees && !invoice && <Note>This bill isn&apos;t on your account.</Note>}
        {fees && invoice && (
          <div className="pay-layout">
            <div className="pay-overview">
              <section className="pay-bill" aria-label="Selected bill">
                <div className="screen-orb" aria-hidden="true" />
                <span className="pay-bill-label">Selected bill</span>
                <h2>{invoice.title}</h2>
                {invoice.number && <p>{invoice.number}</p>}
                <strong>{formatNaira(Math.max(0, invoice.balance))}</strong>
                <div className="pay-bill-chips"><span>{invoice.balance > 0 ? "Balance to pay" : "Fully paid"}</span>{invoice.due_date && invoice.balance > 0 && <span>Due {formatDate(invoice.due_date)}</span>}</div>
              </section>
              <div className="info-note pay-guardian"><Wallet size={17} aria-hidden="true" /><p>{cardOn ? <><strong>Fees are normally paid by a parent or guardian.</strong> You can pay here if they can&apos;t use their own app right now.</> : "Your parent or guardian can pay by transfer to your account number."}</p></div>
            </div>
            <div className="pay-detail">
              {!fees.can_pay ? <Note>Your school doesn&apos;t take payments from pupils here. Ask your parent or guardian to pay.</Note> : invoice.balance <= 0 ? <Note>This bill is fully paid. Thank you.</Note> : !cardOn ? <TransferOnly turnedOff={refused} /> : offline ? <Note>You&apos;re offline. You can pay when you&apos;re back online.</Note> : <>
                <div className="screen-section pay-section-heading"><h2>How would you like to pay?</h2></div>
                <div className="pay-methods" role="radiogroup" aria-label="How would you like to pay?">
                  <MethodButton active={method === "card"} onClick={() => setMethod("card")} icon={<CreditCard size={19} />} label="Card" description="Secure checkout" />
                  <MethodButton active={method === "transfer"} onClick={() => setMethod("transfer")} icon={<Building2 size={19} />} label="Bank transfer" description="Pay from any bank" />
                </div>
                {method === "card" ? <CardPayment fees={fees} invoice={invoice} onCardOff={cardTurnedOff} /> : <TransferPayment />}
              </>}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="screen-card pay-note">{children}</div>;
}

/** A way to pay, as a tile: the chosen one ringed in blue with a tick in its corner. */
function MethodButton({ active, onClick, icon, label, description }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; description?: string }) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick} className={cn("pay-method", active && "is-active")}>
      {active && <span className="pay-method-tick" aria-hidden="true"><Check size={12} /></span>}
      <span className="pay-method-icon">{icon}</span>
      <strong>{label}</strong>
      {description && <small>{description}</small>}
    </button>
  );
}

/** How much, as a row with a round radio: the amount or a word on the right. */
function AmountOption({ active, onClick, label, aside }: { active: boolean; onClick: () => void; label: string; aside: string }) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick} className={cn("pay-amount-option", active && "is-active")}>
      <span className="pay-radio" aria-hidden="true" />
      <strong>{label}</strong>
      <span className="pay-amount-aside">{aside}</span>
    </button>
  );
}

function CardPayment({ fees, invoice, onCardOff }: { fees: Fees; invoice: Invoice; onCardOff: () => void }) {
  const [mode, setMode] = useState<"full" | "part">("full");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [start, { isLoading }] = useStartPaymentMutation();
  const partKobo = parseNaira(typed);
  const amount = mode === "full" ? invoice.balance : partKobo;

  const problem = (): string => {
    if (mode === "full") return "";
    if (!typed.trim()) return "Enter an amount.";
    if (partKobo === null) return "Enter an amount in naira, such as 20,000.";
    if (partKobo > invoice.balance) return `You can pay at most the balance, ${formatNaira(invoice.balance)}.`;
    if (partKobo < invoice.balance && partKobo < fees.min_part_payment) return `The smallest part payment your school accepts is ${formatNaira(fees.min_part_payment)}.`;
    return "";
  };

  const go = async () => {
    const found = problem();
    if (found || !amount) return setError(found || "Enter an amount.");
    setError("");
    let checkout;
    try {
      checkout = await start({ invoiceRef: invoice.invoice_ref, amount }).unwrap();
    } catch (failure) {
      if (isCardPaymentsOff(failure)) return onCardOff();
      return setError(refusal(failure).message);
    }
    if (!isNativeApp()) {
      window.location.assign(checkout.checkout_url);
      return;
    }
    // The store app opens the checkout in the phone's in-app browser and keeps the app where it is.
    try {
      await openCheckout(checkout.checkout_url, checkout.reference);
    } catch {
      setError("The payment page couldn't be opened. Try again.");
    }
  };

  return <section className="pay-card-panel" aria-label="Card payment">
    <div className="screen-section"><h2>How much will you pay?</h2></div>
    <div className="screen-card pay-amount-options" role="radiogroup" aria-label="How much">
      <AmountOption active={mode === "full"} onClick={() => { setMode("full"); setError(""); }} label="Pay in full" aside={formatNaira(invoice.balance)} />
      <AmountOption active={mode === "part"} onClick={() => { setMode("part"); setError(""); }} label="Part payment" aside="Choose an amount" />
      {mode === "part" && <label className="pay-amount-label"><span className="sr-only">Amount to pay</span><div className="pay-amount-field"><span>₦</span><input inputMode="decimal" placeholder="e.g. 5,000" value={typed} onChange={(event) => { setTyped(event.target.value); setError(""); }} aria-invalid={!!error} aria-describedby="pay-minimum" /></div><small id="pay-minimum">At least {formatNaira(fees.min_part_payment)} for a part payment, or pay the full balance.</small></label>}
    </div>
    <dl className="screen-card pay-review"><div><dt>You&apos;ll pay</dt><dd>{amount ? formatNaira(amount) : "–"}</dd></div><div><dt>Left to pay after</dt><dd>{amount && amount <= invoice.balance ? formatNaira(Math.max(0, invoice.balance - amount)) : "–"}</dd></div></dl>
    {error && <p className="pay-error" role="alert">{error}</p>}
    <p className="pay-secure"><Lock size={14} aria-hidden="true" />Your card details go on the secure gateway page, never in this app. The gateway may offer other methods there.</p>
    <BottomBar>
      <Button className="xs-button pay-primary-action" onClick={go} loading={isLoading} disabled={isLoading}><Lock size={17} aria-hidden="true" />Continue to secure payment</Button>
    </BottomBar>
  </section>;
}

/** The whole page body where the school takes no card: the account number in front of the pupil while they pay, and arrivals under it. */
function TransferOnly({ turnedOff }: { turnedOff: boolean }) {
  return <div className="pay-transfer">
    <div className="screen-section pay-section-heading"><h2>Pay by bank transfer</h2></div>
    {turnedOff && <p className="pay-card-off" role="status">Your school takes fee payments by bank transfer. Pay into the account number below.</p>}
    <TransferPanel title="Pay into this account" lead waiting />
  </div>;
}

function TransferPayment() {
  return <div className="pay-transfer">
    <div className="screen-section pay-section-heading"><h2>Pay into this account</h2></div>
    <TransferPanel title="Pay into this account" lead waiting note={<p className="pay-transfer-note">Transfer any amount from a bank app. There is no card-payment minimum for a bank transfer.</p>} />
  </div>;
}
