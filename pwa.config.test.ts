import { describe, expect, it } from "vitest";

import { workboxOptions } from "./pwa.config";

/**
 * The service worker's cache is shared by every pupil on a phone, so it must
 * never hold an API answer or an uploaded file, and its fallback page must be
 * this app's, not school-fe's on the same origin.
 */
describe("service worker caching", () => {
  it("has no runtime caching rule, so no API answer is ever cached", () => {
    expect(workboxOptions.runtimeCaching).toEqual([]);
  });

  it("never answers an API or media address with the app's page", () => {
    const denied = (url: string) =>
      workboxOptions.navigateFallbackDenylist.some((rule) => rule.test(url));
    expect(denied("/v1/portal/student/results/")).toBe(true);
    expect(denied("/media/students/photo.jpg")).toBe(true);
  });

  it("falls back only within the student app", () => {
    const allowed = (url: string) =>
      workboxOptions.navigateFallbackAllowlist.some((rule) => rule.test(url));
    expect(workboxOptions.navigateFallback).toBe("/student/index.html");
    expect(allowed("/student/fees")).toBe(true);
    expect(allowed("/overview")).toBe(false);
  });
});
