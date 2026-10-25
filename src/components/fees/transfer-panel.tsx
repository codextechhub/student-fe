import { useState, type ReactNode } from "react";

import { useAppSelector } from "@/redux/hooks";
import { refusal, useMeQuery, useTransferAccountQuery } from "@/redux/services/portal-api";

import { GetTransferAccount } from "./get-transfer-account";
import { TransferAccountCard } from "./transfer-account-card";
import { TransferActivity } from "./transfer-activity";

/**
 * The pupil's account number and everything about paying into it.
 *
 * It reads the account fresh each time the screen opens, so the moment the
 * watch starts from is the school's own clock and not a copy's. What it shows
 * follows the account's state: the number (with live arrival under it), an
 * offer to get one, or the school's sentence when it has none to give.
 * `lead` is the transfer-only layout used when the school takes no cards.
 */
export function TransferPanel({ title, lead = false, note, waiting = false }: {
  title: string;
  lead?: boolean;
  note?: ReactNode;
  waiting?: boolean;
}) {
  const { data: account, isLoading, isFetching, isError, error } = useTransferAccountQuery(undefined, { refetchOnMountOrArgChange: true });
  const { data: me } = useMeQuery();
  const signedInName = useAppSelector((s) => s.session.pupils.find((p) => p.account === s.session.active)?.fullName);
  const offline = useAppSelector((s) => s.connectivity.offline);

  // The watch starts from the first fresh read made while online, and keeps that moment.
  const [since, setSince] = useState<string | null>(null);
  const issuedAt = account?.state === "ISSUED" && !isFetching && !offline ? account.as_of : null;
  if (since === null && issuedAt) setSince(issuedAt);

  if (isLoading) return <div className="transfer-loading" role="status" aria-label="Loading transfer account" />;
  if (isError || !account) return <p className="transfer-note">{refusal(error).message || "Your account number can't be shown right now."}</p>;
  if (account.state === "UNAVAILABLE") return <p className="transfer-note">{account.message}</p>;
  if (account.state === "NONE") {
    return offline ? <p className="transfer-note">You&apos;re offline. You can get your account number when you&apos;re back online.</p> : <GetTransferAccount />;
  }

  return (
    <div className="transfer-panel">
      <TransferAccountCard account={account} pupilName={me?.student.full_name || signedInName} title={title} lead={lead} />
      {note}
      {since && <TransferActivity since={since} waiting={waiting} />}
    </div>
  );
}
