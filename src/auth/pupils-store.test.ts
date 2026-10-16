import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import {
  deletePupil,
  getActiveAccount,
  listPupils,
  putPupil,
  resetPupilsStoreForTests,
  setActiveAccount,
  type DevicePupil,
} from "./pupils-store";

const tunde: DevicePupil = { account: "a-tunde", studentId: 1, fullName: "Tunde Okoro", firstName: "Tunde", photo: "" };
const bola: DevicePupil = { account: "a-bola", studentId: 2, fullName: "Bola Okoro", firstName: "Bola", photo: "" };

beforeEach(async () => {
  resetPupilsStoreForTests();
  for (const p of await listPupils()) await deletePupil(p.account);
  await setActiveAccount(null);
});

describe("the pupils on this phone", () => {
  it("keeps several pupils and which one was showing", async () => {
    await putPupil(tunde);
    await putPupil(bola);
    await setActiveAccount(bola.account);
    expect((await listPupils()).map((p) => p.firstName).sort()).toEqual(["Bola", "Tunde"]);
    expect(await getActiveAccount()).toBe("a-bola");
  });

  it("stores no token, only what the switcher shows", async () => {
    await putPupil(tunde);
    const [stored] = await listPupils();
    expect(Object.keys(stored).sort()).toEqual(["account", "firstName", "fullName", "photo", "studentId"]);
  });

  it("taking off the pupil showing clears the showing slot and leaves the others", async () => {
    await putPupil(tunde);
    await putPupil(bola);
    await setActiveAccount(tunde.account);
    await deletePupil(tunde.account);
    expect((await listPupils()).map((p) => p.account)).toEqual(["a-bola"]);
    expect(await getActiveAccount()).toBeNull();
  });
});
