import { BrowserRouter, Route, Routes } from "react-router";

import { UpdateBar } from "@/components/update-bar";
import { NotFoundPage } from "@/pages/not-found";
import { StartPage } from "@/pages/start";

/**
 * The student app's routes, all under `/student/`.
 *
 * The router's basename matches Vite's `base`, so a route written here as
 * `/fees` is served at `/student/fees` and never collides with a school-fe
 * address on the same origin.
 */
export default function App() {
  return (
    <BrowserRouter basename="/student">
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <UpdateBar />
    </BrowserRouter>
  );
}
