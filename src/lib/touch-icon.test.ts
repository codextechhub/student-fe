import { describe, expect, it } from "vitest";

import { touchIconFrom } from "./touch-icon";

describe("the iPhone home-screen icon", () => {
  it("uses the crest's icon when the school's manifest points at the backend", () => {
    expect(
      touchIconFrom({ icons: [{ src: "https://api.codexng.com/v1/portal/student/app/corona/icons/icon-192.png" }] }),
    ).toBe("https://api.codexng.com/v1/portal/student/app/corona/icons/apple-touch-icon.png");
  });

  it("keeps the XVS icon for a school with no crest", () => {
    expect(touchIconFrom({ icons: [{ src: "/student/icons/icon-192.png" }] })).toBe("");
    expect(touchIconFrom({})).toBe("");
  });
});
