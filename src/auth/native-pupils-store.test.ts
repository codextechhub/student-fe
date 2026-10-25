import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const phone = vi.hoisted(() => ({ school: "meridian" }));
vi.mock("@/native/platform", () => ({ isNativeApp: () => true }));
vi.mock("@/utils/school-host", () => ({ currentSchoolSlug: () => phone.school }));

import { deletePupil, listPupils, putPupil, resetPupilsStoreForTests, type DevicePupil } from "./pupils-store";

const tunde: DevicePupil = { account: "a-tunde", studentId: 1, fullName: "Tunde Okoro", firstName: "Tunde", photo: "" };
const ada: DevicePupil = { account: "a-ada", studentId: 9, fullName: "Ada Eze", firstName: "Ada", photo: "" };

beforeEach(async () => {
  for (const school of ["meridian", "lagoon-view"]) {
    phone.school = school;
    resetPupilsStoreForTests();
    for (const p of await listPupils()) await deletePupil(p.account);
  }
  resetPupilsStoreForTests();
});

describe("the pupils on a phone with the store app", () => {
  it("keeps each school's pupils apart, because every school shares one origin", async () => {
    phone.school = "meridian";
    await putPupil(tunde);
    resetPupilsStoreForTests();
    phone.school = "lagoon-view";
    expect(await listPupils()).toEqual([]);
    await putPupil(ada);
    resetPupilsStoreForTests();
    phone.school = "meridian";
    expect((await listPupils()).map((p) => p.account)).toEqual(["a-tunde"]);
  });
});
