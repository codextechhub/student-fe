import { BrowserRouter, Route, Routes } from "react-router";
import { Toaster } from "sonner";

import { InstallListener } from "@/components/install-offer";
import { SessionBoot, SignedIn } from "@/components/session/session-gate";
import { AppShell } from "@/components/shell/app-shell";
import { UpdateBar } from "@/components/update-bar";
import { AttendancePage } from "@/pages/attendance";
import { FeesPage } from "@/pages/fees";
import { HomePage } from "@/pages/home";
import { MessagesPage } from "@/pages/messages";
import { NoticesPage } from "@/pages/notices";
import { NotFoundPage } from "@/pages/not-found";
import { PaidPage } from "@/pages/paid";
import { PayPage } from "@/pages/pay";
import { ProfilePage } from "@/pages/profile";
import { ReceiptPage } from "@/pages/receipt";
import { ReportCardPage } from "@/pages/report-card";
import { ResultsPage } from "@/pages/results";
import { SignInPage } from "@/pages/sign-in";
import { PushListener } from "@/push/push-listener";
import { TimetablePage } from "@/pages/timetable";

/**
 * The student app's routes, all under `/student/`.
 *
 * The router's basename matches Vite's `base`, so a route written here as
 * `/fees` is served at `/student/fees` and never collides with a school-fe
 * address on the same origin. Every screen but sign-in sits in the app shell,
 * for a signed-in pupil, and remounts when the pupil showing changes.
 */
export default function App() {
  return (
    <BrowserRouter basename="/student">
      <SessionBoot>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route
            element={
              <SignedIn>
                <AppShell />
              </SignedIn>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="timetable" element={<TimetablePage />} />
            <Route path="results" element={<ResultsPage />} />
            <Route path="results/card/:termId" element={<ReportCardPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="fees" element={<FeesPage />} />
            <Route path="fees/pay/:invoiceRef" element={<PayPage />} />
            <Route path="fees/paid" element={<PaidPage />} />
            <Route path="fees/receipts/:paymentRef" element={<ReceiptPage />} />
            <Route path="notices" element={<NoticesPage />} />
            <Route path="notices/:id" element={<NoticesPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="messages/new" element={<MessagesPage />} />
            <Route path="messages/:id" element={<MessagesPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </SessionBoot>
      <PushListener />
      <InstallListener />
      <UpdateBar />
      <Toaster position="top-center" richColors closeButton />
    </BrowserRouter>
  );
}
