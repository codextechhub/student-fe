import { useState } from "react";
import { Building2, Check, Copy } from "lucide-react";

import { copyText } from "@/lib/copy-text";
import type { TransferAccount } from "@/redux/services/portal-api";

type IssuedAccount = Extract<TransferAccount, { state: "ISSUED" }>;

/**
 * The pupil's account number to pay school fees into.
 *
 * `lead` is the transfer-only layout, used where the school takes no card: the
 * bank, then the number large with a Copy button that says "Copied", then the
 * account name, and one line on how to pay. Without it the card is the
 * smaller one that sits beside the card option.
 */
export function TransferAccountCard({ account, pupilName, title, lead = false }: { account: IssuedAccount; pupilName?: string; title: string; lead?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const done = await copyText(account.account_number);
    setCopied(done);
    if (done) window.setTimeout(() => setCopied(false), 2000);
  };

  if (lead) {
    return (
      <section className="student-transfer-card is-lead" aria-label={title}>
        <div className="student-transfer-top"><span className="student-transfer-icon"><Building2 size={18} aria-hidden="true" /></span><span className="student-transfer-status">Ready to use</span></div>
        <h2 className="student-transfer-label">{title}</h2>
        {pupilName && <p className="student-transfer-name">{pupilName}&apos;s account</p>}
        <p className="student-transfer-bank is-bank">{account.bank_name}</p>
        <div className="student-transfer-number is-lead">
          <span aria-label={`Account number ${account.account_number}`}>{account.account_number}</span>
          <button type="button" className="student-transfer-copy" onClick={() => void copy()} aria-live="polite">
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="student-transfer-bank">Bank account name: {account.account_name}</p>
        <p className="student-transfer-hint">Pay any amount by transfer from your bank app. It shows here as soon as it arrives.</p>
      </section>
    );
  }

  return (
    <section className="student-transfer-card">
      <div>
        <div className="student-transfer-top"><span className="student-transfer-icon"><Building2 size={18} aria-hidden="true" /></span><span className="student-transfer-status">Ready to use</span></div>
        <h2 className="student-transfer-label">{title}</h2>
        {pupilName && <p className="student-transfer-name">{pupilName}&apos;s account</p>}
        <button
          type="button"
          onClick={() => void copy()}
          className="student-transfer-number"
          aria-label={`Account number ${account.account_number}. Copy`}
        >
          <span>{account.account_number}</span>
          {copied ? <Check className="size-4 text-green-700" /> : <Copy className="size-4 text-muted-foreground" />}
        </button>
        <p className="student-transfer-bank">{account.bank_name}</p>
        <p className="student-transfer-bank">Bank account name: {account.account_name}</p>
      </div>
      <p className="student-transfer-hint">
        This number stays the same, so your family can save it and pay at any time. Any amount over what you owe
        waits as credit for your next bill.
      </p>
    </section>
  );
}
