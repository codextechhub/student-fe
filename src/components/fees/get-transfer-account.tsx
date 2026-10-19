import { useState } from "react";

import { Button } from "@/components/ui/button";
import { refusal, useOpenTransferAccountMutation } from "@/redux/services/portal-api";

/**
 * The offer of a permanent account number, for a pupil who has none yet.
 *
 * Shown wherever there is money to pay and the school takes transfers but has
 * not issued this pupil a number: a charge added after a bill has no Pay
 * screen of its own, so the offer cannot live only on a bill's. Once issued,
 * the transfer account query refreshes and the number replaces this.
 */
export function GetTransferAccount() {
  const [open, { isLoading }] = useOpenTransferAccountMutation();
  const [error, setError] = useState("");

  return (
    <section className="fees-get-account">
      <h3>Your transfer account</h3>
      <p>You don&apos;t have an account number for school fees yet. Get one, and your family can pay into it from any bank.</p>
      {error && <p className="fees-get-account-error" role="alert">{error}</p>}
      <Button
        className="fees-get-account-action"
        loading={isLoading}
        disabled={isLoading}
        onClick={async () => {
          setError("");
          try {
            await open().unwrap();
          } catch (failure) {
            setError(refusal(failure).message);
          }
        }}
      >
        Get my account number
      </Button>
    </section>
  );
}
