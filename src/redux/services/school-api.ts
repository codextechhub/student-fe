import { baseApi } from "./base-api";

/**
 * The school's public face, readable before anybody signs in: its display name
 * by slug. The crest is an image address (`schoolLogoUrl`), not a query.
 */
export const schoolApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    schoolName: build.query<string, string>({
      query: (slug) => `/i/public/schools/${encodeURIComponent(slug)}/name/`,
      transformResponse: (body: { name?: string }) => body?.name ?? "",
    }),
  }),
});

export const { useSchoolNameQuery } = schoolApi;
