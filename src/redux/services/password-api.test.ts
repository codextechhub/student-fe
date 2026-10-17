/**
 * The password endpoints as Ebere's requests reach the school: through the
 * same request layer as every other screen, so they carry her token and the
 * school's tenant like the rest.
 */
import "fake-indexeddb/auto";
import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setAccess } from "@/auth/access-tokens";
import { connectivityReducer } from "@/redux/features/connectivity-slice";
import { sessionReducer, sessionSettled } from "@/redux/features/session-slice";

import { baseApi } from "./base-api";
import { passwordApi, passwordRefusals } from "./password-api";

vi.mock("@/utils/school-host", () => ({ currentSchoolSlug: () => "lagoon-view" }));

afterEach(() => vi.unstubAllGlobals());

function store() {
  const s = configureStore({
    reducer: { session: sessionReducer, connectivity: connectivityReducer, [baseApi.reducerPath]: baseApi.reducer },
    middleware: (d) => d({ serializableCheck: false }).concat(baseApi.middleware),
  });
  setAccess("a-ebere", "tok-a-ebere");
  s.dispatch(sessionSettled({ status: "signed-in", pupils: [], active: "a-ebere" }));
  return s;
}

describe("the password change request", () => {
  it("posts exactly the three passwords, as the pupil showing, at this school", async () => {
    const sent: Request[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request) => {
        sent.push(input);
        return new Response(JSON.stringify({ data: { csrf_token: "csrf-test" }, success: true }), { status: 200 });
      }),
    );
    const s = store();
    const body = { current_password: "Ebere@Lagoon2026", password: "Bello#Garden2027", confirm_password: "Bello#Garden2027" };
    await s.dispatch(passwordApi.endpoints.changePassword.initiate(body)).unwrap();

    const request = sent.find((r) => r instanceof Request && r.url.includes("/password/change/"))!;
    expect(request.method).toBe("POST");
    expect(new URL(request.url).searchParams.get("tenant")).toBe("lagoon-view");
    expect(request.headers.get("Authorization")).toBe("Bearer tok-a-ebere");
    expect(await request.clone().json()).toEqual(body);
  });
});

describe("passwordRefusals", () => {
  const refusal = (error: unknown) => ({ status: 400, data: { success: false, message: "Invalid request.", error } });

  it("puts each refusal under the box the school named", () => {
    expect(
      passwordRefusals(
        refusal({
          current_password: ["Current password is incorrect."],
          confirm_password: ["Passwords do not match."],
        }),
      ),
    ).toEqual({ current_password: "Current password is incorrect.", confirm_password: "Passwords do not match." });
  });

  it("puts a rules refusal that names no box under the new password", () => {
    expect(
      passwordRefusals(
        refusal({ error_code: "PASSWORD_POLICY_VIOLATION", messages: ["This password is too similar to the email address."] }),
      ),
    ).toEqual({ password: "This password is too similar to the email address." });
  });

  it("gives the form anything that belongs under no box", () => {
    expect(passwordRefusals({ status: 403, data: { message: "Your account is not active.", error: {} } })).toEqual({
      form: "Your account is not active.",
    });
    expect(passwordRefusals({ status: "FETCH_ERROR", error: "offline" })).toEqual({
      form: "You're offline. Try again when you have a connection.",
    });
  });
});
