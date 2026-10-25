/**
 * What a tapped notification opens. The API sends a path on the school's host
 * under `/student`; the store app's router has no such prefix.
 */
import { describe, expect, it } from "vitest";

import { appPath, tapTarget } from "./push-routing";

describe("a tapped notification's destination", () => {
  it("takes the /student prefix off the path and keeps the rest", () => {
    expect(tapTarget({ url: "/student/messages/41", account: "a-femi" })).toEqual({ account: "a-femi", path: "/messages/41" });
    expect(tapTarget({ url: "/student/fees/receipts/9?from=push#top" }).path).toBe("/fees/receipts/9?from=push#top");
  });

  it("opens the home screen for the student app's own root", () => {
    expect(appPath("/student")).toBe("/");
    expect(appPath("/student/")).toBe("/");
    expect(appPath("/student?x=1")).toBe("/?x=1");
  });

  it("opens the home screen when the path is missing or is not inside the student app", () => {
    for (const url of [
      "",
      "/overview",
      "/students/fees",
      "/studentship",
      "//evil.example/student/fees",
      "https://lagoon-view.xvs.codexng.com/student/fees",
      "javascript:alert(1)",
      "/student\\..\\fees",
    ]) {
      expect(appPath(url), url).toBe("/");
    }
    expect(tapTarget({}).path).toBe("/");
    expect(tapTarget({ url: 12 }).path).toBe("/");
  });

  it("reads the pupil from account, and no pupil when it is absent", () => {
    expect(tapTarget({ url: "/student/", account: "  a-ebere " }).account).toBe("a-ebere");
    expect(tapTarget({ url: "/student/" }).account).toBe("");
    expect(tapTarget({ url: "/student/", account: 7 }).account).toBe("");
  });
});
