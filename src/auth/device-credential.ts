import { deleteCredential, getCredential } from "@/native/credentials";
import { isNativeApp } from "@/native/platform";

import { authPost } from "./api";

/**
 * Signing a pupil out of this phone, in a browser and in the store app.
 *
 * A browser proves a pupil with their httpOnly cookie, so the call carries
 * only the account. The store app has no cookie: it sends the credential it
 * kept in the phone's secure storage (`native/credentials`) in the body, and
 * forgets it afterwards. The API answers 200 either way, including for a
 * credential it no longer knows.
 */
export async function deviceSignOut(account: string): Promise<void> {
  if (!isNativeApp()) {
    await authPost("/user/auth/device/sign-out/", { account });
    return;
  }
  let refresh = "";
  try {
    refresh = (await getCredential(account)) ?? "";
  } catch {
    // Unreadable: the API is told which account, and the session ends on its own clock.
  }
  await authPost("/user/auth/device/sign-out/", { account, refresh });
  await deleteCredential(account);
}

/** Forgets the stored credential of a pupil whose sign-in has ended. A browser has none to forget. */
export async function forgetCredential(account: string): Promise<void> {
  if (isNativeApp()) await deleteCredential(account);
}
