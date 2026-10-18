import { useState } from "react";
import { Check, Copy } from "lucide-react";

import type { TransferAccount } from "@/redux/services/portal-api";

type IssuedAccount = Extract<TransferAccount, { state: "ISSUED" }>;

export function TransferAccountCard({ account, pupilName, title }: { account: IssuedAccount; pupilName?: string; title: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <section className="grid gap-3 rounded-xl border border-border p-4">
      <div className="grid gap-1 text-center">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {pupilName && <p className="text-lg font-semibold text-foreground">{pupilName}&apos;s account</p>}
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(account.account_number);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
          className="mx-auto inline-flex items-center gap-2 rounded-lg px-3 py-1 font-mono text-2xl font-semibold tracking-wider text-foreground hover:bg-accent"
          aria-label={`Account number ${account.account_number}. Copy`}
        >
          {account.account_number}
          {copied ? <Check className="size-4 text-green-700" /> : <Copy className="size-4 text-muted-foreground" />}
        </button>
        <p className="text-sm text-muted-foreground">{account.bank_name}</p>
        <p className="text-xs text-muted-foreground">Bank account name: {account.account_name}</p>
      </div>
      <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        This number stays the same, so your family can save it and pay at any time. Any amount over what you owe
        waits as credit for your next bill.
      </p>
    </section>
  );
}
