import { BrowserRouter, Route, Routes } from "react-router";

import { SessionBoot, SignedIn } from "@/components/session/session-gate";
import { UpdateBar } from "@/components/update-bar";
import { HomePage } from "@/pages/home";
import { NotFoundPage } from "@/pages/not-found";
import { SignInPage } from "@/pages/sign-in";

/**
 * The student app's routes, all under `/student/`.
 *
 * The router's basename matches Vite's `base`, so a route written here as
 * `/fees` is served at `/student/fees` and never collides with a school-fe
 * address on the same origin. Every screen but sign-in is for a signed-in
 * pupil and remounts when the pupil showing changes.
 */
export default function App() {
  return (
    <BrowserRouter basename="/student">
      <SessionBoot>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route
            path="/"
            element={
              <SignedIn>
                <HomePage />
              </SignedIn>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </SessionBoot>
      <UpdateBar />
    </BrowserRouter>
  );
}
