# The store app

The pupil app also ships as a store app for iPhone and Android: this same
code in a Capacitor shell (`com.codexng.xvs.student`, "XVS Student"). The web
app is unchanged. Everything native is additive and runs only inside the shell,
behind `isNativeApp()` in `src/native/platform.ts`, which asks
`Capacitor.isNativePlatform()`. No other file asks the platform a different
way.

## Building and running

Use the arm64 Node, as for the web app.

```bash
npm install
npm run cap:sync          # build:native, then `cap sync` into ios/ and android/
npx cap open ios          # Xcode: pick an iPhone simulator, press Run
npx cap open android      # Android Studio: pick an emulator, press Run
```

From the command line, an iPhone simulator build:

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator \
  -configuration Debug -derivedDataPath ios/DerivedData CODE_SIGNING_ALLOWED=NO build
xcrun simctl install booted ios/DerivedData/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted com.codexng.xvs.student
```

iOS needs Xcode 26 or later and uses Swift Package Manager (no CocoaPods).
Android needs the Android SDK and a JDK 21. Run `npm run cap:sync` again after
any change to the web code or to a Capacitor plugin.

## The native build

`npm run build:native` is `vite build --mode native`, configured in
`vite.config.ts`. It writes `dist-native/` (gitignored); the web build's
`dist/` is never touched.

- `base` is `/` and the router's basename is `/`, because the app is served
  from its own origin, `capacitor://localhost` (iOS) or `https://localhost`
  (Android). Capacitor's default schemes are kept: those two origins are what
  the API accepts as the store app.
- The PWA plugin is off. There is no service worker, manifest or push worker,
  and `virtual:pwa-register/react` is stood in for by
  `src/native/pwa-register-stub.ts`.
- The API is a separate origin, so its address is absolute. Set
  `VITE_NATIVE_API_ORIGIN` (no `/v1`) when building; it is staging's
  `https://api-staging.codexng.com` when unset. `VITE_APP_BASE_DOMAIN` is the
  domain schools' websites are under, used for "Forgot password"; it is
  `xvs-staging.codexng.com` when unset. For production:

  ```bash
  VITE_NATIVE_API_ORIGIN=https://api.codexng.com VITE_APP_BASE_DOMAIN=xvs.codexng.com npm run cap:sync
  ```

The generated projects live in `ios/` and `android/` and are committed.
Their build outputs, the copied web assets and Capacitor's generated config
files are ignored by the ignore files Capacitor writes there.

## What is native-only

- **School choice.** A browser reads its school off the address. The store app
  has one address for every school, so the first screen asks for the school
  code (the left part of the school's address, `meridian` for
  `meridian.xvs.codexng.com`), checks it against the public school name route,
  shows the school's name and crest to confirm, and keeps the code in
  `@capacitor/preferences` (`src/native/school-code.ts`). It is read into memory
  before the app mounts, so `currentSchoolSlug()` stays synchronous and answers
  with the code. "Change school" on the sign-in screen comes back to the
  choice; choosing reloads the app. Each school's pupils are kept in a
  database named for the school, so changing school shows that school's
  pupils and leaves the others signed in.
- **Sign-in by device session.** The login call sends `session: "device"` and the
  school's code as `tenant`. The API answers with `account` and `refresh` and
  sets no cookie. The refresh credential is kept per account in the iOS
  Keychain or Android Keystore (`src/native/credentials.ts`), is sent in the
  body of the refresh and sign-out calls (`src/auth/refresh.ts`,
  `src/auth/device-credential.ts`), and is replaced by the rotated one on every
  refresh. No cookie and no CSRF token is used. Access tokens stay in memory.
  A 401 (`TOKEN_EXPIRED`, `TOKEN_REVOKED`, `TOKEN_INVALID`) forgets that
  account's credential and asks for sign-in; a 409 (`TOKEN_STALE`) is retried
  with the credential kept. A secure storage that cannot be read decides
  nothing: the pupil is not signed out for it. Several pupils on one phone work
  as on the web.
- **Secure storage plugin.** `@aparajita/capacitor-secure-storage` 8.0.1: built
  for Capacitor 8, maintained, ships a Swift Package manifest, uses the
  Keychain and the Android Keystore, and lets the app set the key prefix, turn
  iCloud sync off and keep items `ThisDeviceOnly` so a backup restored on
  another phone carries no sign-in. It also brings `@capacitor/app` and
  `@capacitor/keyboard` into `node_modules`, which the app does not use.
- **Links to the school's website** ("Forgot password", the staff sign-in
  notice) are absolute addresses that the phone opens in its own browser.

## Off in the store app

The install offer, the update bar, Web Push and everything that registers a
service worker. `src/native/native-push.tsx` is where native push goes later;
it renders nothing today.

## Later phases

Native push (APNs and FCM) at `NativePushListener`; a minimum-version check;
deep links; the account deletion screen; file sharing of receipts and report
cards; Paystack checkout in an in-app browser (until then a payment leaves the
app for the checkout page through the WebView, and "Forgot password" opens the
phone's browser); camera for the profile photo; app icons and the splash
screen, which are still Capacitor's defaults.
