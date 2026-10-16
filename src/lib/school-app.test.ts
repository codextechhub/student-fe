import { describe, expect, it } from "vitest";

import { schoolManifestUrl, touchIconFrom } from "./school-app";

const CORONA = "/student/app/corona/manifest.webmanifest";

describe("the school's own manifest", () => {
  it("is asked for on the app's own address, naming the school in the path", () => {
    expect(schoolManifestUrl("corona")).toBe(`${import.meta.env.BASE_URL}app/corona/manifest.webmanifest`);
  });

  it("is not asked for on an address that names no school", () => {
    expect(schoolManifestUrl("")).toBe("");
  });
});

describe("the iPhone home-screen icon", () => {
  it("uses the crest's icon when the manifest's icons sit beside it", () => {
    expect(touchIconFrom({ icons: [{ src: "icons/icon-192.png" }] }, CORONA)).toBe(
      "/student/app/corona/icons/apple-touch-icon.png",
    );
  });

  it("uses the crest's icon when the manifest names it at the API", () => {
    expect(
      touchIconFrom({ icons: [{ src: "https://api.codexng.com/v1/portal/student/app/corona/icons/icon-192.png" }] }, CORONA),
    ).toBe("https://api.codexng.com/v1/portal/student/app/corona/icons/apple-touch-icon.png");
  });

  it("keeps the XVS icon for a school with no crest", () => {
    expect(touchIconFrom({ icons: [{ src: "/student/icons/icon-192.png" }] }, CORONA)).toBe("");
    expect(touchIconFrom({}, CORONA)).toBe("");
  });
});
