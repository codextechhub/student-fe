import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Building2, CreditCard, Lock } from "lucide-react";
import { Link, useParams } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { TransferAccountCard } from "@/components/fees/transfer-account-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNaira, parseNaira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { baseApi } from "@/redux/services/base-api";
import {
  refusal,
  useDepositsQuery,
  useFeesQuery,
  useMeQuery,
  useOpenTransferAccountMutation,
  useStartPaymentMutation,
  useTransferAccountQuery,
  type Fees,
  type Invoice,
} from "@/redux/services/portal-api";

/**
 * Paying one bill, by card or by bank transfer.
 *
 * Card: the whole balance, or a part of at least the school's smallest part
 * payment, then the gateway's own secure page; the app never sees card
 * details. The gateway sends the pupil back to `/fees/paid`, which reads the
 * result from the server, never from the redirect.
 *
 * Bank transfer: the pupil's own account number, the same one every time,
 * which their family can keep and pay into from any bank. No minimum applies,
 * because a transfer cannot be turned away once it lands. While this page is
 * open it watches for money arriving from the server's own clock, says when a
 * transfer is on its way and when it is received, and then reads the fees
 * again rather than working the balance out itself.
 *
 * Nothing here works offline, and a school that does not let pupils pay is
 * told so.
 */
export function PayPage() {
  const { invoiceRef } = useParams();
  const { data: fees, isLoading } = useFeesQuery();
  const offline = useAppSelector((s) => s.connectivity.offline);
  const [method, setMethod] = useState<"card" | "transfer" | null>(null);
  const invoice = fees?.invoices.find((i) => String(i.invoice_ref) === invoiceRef);

  return (
    <PageShell grid className="mx-auto w-full max-w-xl content-start gap-4 pt-4 lg:px-6">
      <Link to="/fees" className="inline-flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground">
        <ArrowLeft className="size-4" /> Fees
      </Link>
      <PageHeader title={invoice ? `Pay ${invoice.title}` : "Pay"} description={invoice ? `Balance ${formatNaira(invoice.balance)}` : ""} />
      {isLoading && <div className="h-40 animate-pulse rounded-xl bg-muted" />}
      {fees && !invoice && <Note>This bill isn&apos;t on your account.</Note>}
      {fees && invoice && !fees.can_pay && <Note>Your school doesn&apos;t take payments from pupils here. Ask your parent or guardian to pay.</Note>}
      {fees && invoice && fees.can_pay && invoice.balance <= 0 && <Note>This bill is fully paid. Thank you.</Note>}
      {offline && <Note>You&apos;re offline. You can pay when you&apos;re back online.</Note>}
      {fees && invoice && fees.can_pay && invoice.balance > 0 && !offline && (
        <>
          <div role="radiogroup" aria-label="How would you like to pay?" className="grid grid-cols-2 gap-3">
            <MethodButton active={method === "card"} onClick={() => setMethod("card")} icon={<CreditCard className="size-5" />} label="Card" />
            <MethodButton active={method === "transfer"} onClick={() => setMethod("transfer")} icon={<Building2 className="size-5" />} label="Bank transfer" />
          </div>
          {method === "card" && <CardPayment fees={fees} invoice={invoice} />}
          {method === "transfer" && <TransferPayment />}
        </>
      )}
    </PageShell>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">{children}</p>;
}

function MethodButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium",
        active ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground hover:bg-accent",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function CardPayment({ fees, invoice }: { fees: Fees; invoice: Invoice }) {
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
    if (partKobo < invoice.balance && partKobo < fees.min_part_payment) {
      return `The smallest part payment your school accepts is ${formatNaira(fees.min_part_payment)}.`;
    }
    return "";
  };

  const go = async () => {
    const found = problem();
    if (found || !amount) return setError(found || "Enter an amount.");
    setError("");
    try {
      const checkout = await start({ invoiceRef: invoice.invoice_ref, amount }).unwrap();
      window.location.assign(checkout.checkout_url);
    } catch (failure) {
      setError(refusal(failure).message);
    }
  };

  return (
    <section className="grid gap-4 rounded-xl border border-border p-4">
      <div role="radiogroup" aria-label="How much" className="grid grid-cols-2 gap-3">
        <MethodButton active={mode === "full"} onClick={() => { setMode("full"); setError(""); }} icon={<span className="font-mono text-sm">{formatNaira(invoice.balance)}</span>} label="Pay in full" />
        <MethodButton active={mode === "part"} onClick={() => { setMode("part"); setError(""); }} icon={<span className="text-xs text-muted-foreground">Choose an amount</span>} label="Part payment" />
      </div>
      {mode === "part" && (
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-foreground">Amount to pay (₦)</span>
          <Input inputMode="decimal" placeholder="e.g. 20,000" value={typed} onChange={(e) => { setTyped(e.target.value); setError(""); }} aria-invalid={!!error} />
          <span className="block text-[11px] text-muted-foreground">At least {formatNaira(fees.min_part_payment)}, or the whole balance.</span>
        </label>
      )}
      <dl className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">You&apos;ll pay</dt>
          <dd className="font-mono font-semibold">{amount ? formatNaira(amount) : "-"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Left to pay after</dt>
          <dd className="font-mono">{amount ? formatNaira(Math.max(0, invoice.balance - amount)) : "-"}</dd>
        </div>
      </dl>
      {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}
      <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" />
        You&apos;ll enter your card on the secure payment page, not in this app. You can also choose bank transfer or
        USSD there.
      </p>
      <Button size="lg" onClick={go} loading={isLoading} disabled={isLoading}>
        Continue to secure payment
      </Button>
    </section>
  );
}

/** How often the page asks whether a transfer has arrived. */
const WATCH_EVERY_MS = 5_000;

function TransferPayment() {
  const { data: account, isLoading, isError, error } = useTransferAccountQuery();
  const { data: me } = useMeQuery();
  const signedInName = useAppSelector((s) => s.session.pupils.find((p) => p.account === s.session.active)?.fullName);
  const [open, { isLoading: opening }] = useOpenTransferAccountMutation();
  const [openError, setOpenError] = useState("");

  if (isLoading) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  if (isError || !account) {
    return <Note>{refusal(error).message || "Your account number can't be shown right now."}</Note>;
  }
  if (account.state === "UNAVAILABLE") return <Note>{account.message}</Note>;
  if (account.state === "NONE") {
    return (
      <section className="grid gap-3 rounded-xl border border-border p-4">
        <p className="text-sm text-foreground">
          You don&apos;t have an account number for school fees yet. Get one, and your family can pay into it from any
          bank, as often as they like.
        </p>
        {openError && <p role="alert" className="text-xs text-destructive">{openError}</p>}
        <Button
          onClick={async () => {
            setOpenError("");
            try {
              await open().unwrap();
            } catch (failure) {
              setOpenError(refusal(failure).message);
            }
          }}
          loading={opening}
          disabled={opening}
        >
          Get my account number
        </Button>
      </section>
    );
  }
  return (
    <div className="grid gap-4">
      <TransferAccountCard account={account} pupilName={me?.student.full_name || signedInName} title="Pay into this account" />
      <DepositWatch since={account.as_of} />
    </div>
  );
}

/**
 * Watches for transfers that arrive while the page is open.
 *
 * Asks from the moment the account was read, on the server's clock, so a
 * phone set to the wrong time still sees the money. A deposit shows as on its
 * way as soon as the bank tells the provider, and as received once the school
 * books it; then the fees are read again for the true balance.
 */
function DepositWatch({ since }: { since: string }) {
  const dispatch = useAppDispatch();
  // Checks every few seconds while in view, and at once on coming back to it:
  // a pupil who left for their bank app to send the money sees it on return.
  const { data } = useDepositsQuery(since, {
    pollingInterval: WATCH_EVERY_MS,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
  });
  const deposits = data?.deposits ?? [];
  const confirmed = deposits.filter((d) => d.status === "CONFIRMED").length;
  const seen = useRef(0);

  useEffect(() => {
    if (confirmed > seen.current) {
      seen.current = confirmed;
      dispatch(baseApi.util.invalidateTags(["Fees", "Home"]));
    }
  }, [confirmed, dispatch]);

  if (deposits.length === 0) {
    return (
      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground" role="status">
        <span className="size-2 animate-pulse rounded-full bg-primary" /> Waiting for your transfer. Keep this page open to
        see it arrive.
      </p>
    );
  }
  return (
    <ul className="grid gap-2" role="status">
      {deposits.map((deposit) => (
        <li
          key={deposit.reference}
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-sm",
            deposit.status === "CONFIRMED" ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900",
          )}
        >
          <span>
            {formatNaira(deposit.amount)}{" "}
            {deposit.status === "CONFIRMED" ? "received. Thank you." : "on its way. Waiting for the bank to confirm."}
          </span>
          {deposit.has_receipt && deposit.payment_ref && (
            <Link to={`/fees/receipts/${deposit.payment_ref}`} className="text-xs font-medium underline underline-offset-2">
              View receipt
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
