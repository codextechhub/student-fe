import { BrowserRouter, Route, Routes } from "react-router";
import { Toaster } from "sonner";

import { InstallListener } from "@/components/install-offer";
import { SessionBoot, SignedIn } from "@/components/session/session-gate";
import { AppShell } from "@/components/shell/app-shell";
import { UpdateBar } from "@/components/update-bar";
import { NativeCheckoutReturn } from "@/native/native-checkout";
import { NativeLinks } from "@/native/native-links";
import { NativePushListener } from "@/native/native-push";
import { isNativeApp, routerBasename } from "@/native/platform";
import { SplashGate } from "@/native/splash-gate";
import { StatusBarGate } from "@/native/status-bar-gate";
import { VersionGate } from "@/native/version-gate";
import { AttendancePage } from "@/pages/attendance";
import { DeleteAccountPage } from "@/pages/delete-account";
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
import { SchoolChoicePage } from "@/pages/school-choice";
import { SignInPage } from "@/pages/sign-in";
import { PushListener } from "@/push/push-listener";
import { TimetablePage } from "@/pages/timetable";
import { currentSchoolSlug } from "@/utils/school-host";

/**
 * The student app's routes, all under `/student/`.
 *
 * The router's basename matches Vite's `base`, so a route written here as
 * `/fees` is served at `/student/fees` and never collides with a school-fe
 * address on the same origin. Every screen but sign-in sits in the app shell,
 * for a signed-in pupil, and remounts when the pupil showing changes.
 *
 * The store app is the same app on its own origin: the basename is `/`, there
 * is no install offer, service worker or Web Push (`NativePushListener` does
 * native push instead), the splash screen stays up until the first real
 * screen is drawn (`SplashGate`), links from a school's website open the right
 * screen (`NativeLinks`), a card payment's checkout browser hands back to the
 * result screen (`NativeCheckoutReturn`), the version check can block or nudge (`VersionGate`),
 * the status bar's text colour follows the screen showing (`StatusBarGate`),
 * and until a school code has been entered the only
 * screen is the one that asks for it. Choosing a school reloads the app, so
 * this reads the school once per load.
 */
export default function App() {
  const native = isNativeApp();
  if (native && !currentSchoolSlug()) {
    return (
      <BrowserRouter basename={routerBasename()}>
        <SchoolChoicePage />
        <SplashGate ready />
        <StatusBarGate />
        <NativeLinks />
        <VersionGate />
        <Toaster position="top-center" richColors closeButton />
      </BrowserRouter>
    );
  }
  return (
    <BrowserRouter basename={routerBasename()}>
      <SessionBoot>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
          {native && <Route path="/school" element={<SchoolChoicePage />} />}
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
            <Route path="profile/delete-account" element={<DeleteAccountPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </SessionBoot>
      {native ? (
        <>
          <NativePushListener />
          <SplashGate />
          <StatusBarGate />
          <NativeLinks />
          <NativeCheckoutReturn />
          <VersionGate />
        </>
      ) : (
        <>
          <PushListener />
          <InstallListener />
          <UpdateBar />
        </>
      )}
      <Toaster position="top-center" richColors closeButton />
    </BrowserRouter>
  );
}
