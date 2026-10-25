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
service worker. Native push (below) takes the place of Web Push.

## Start-up, splash and icons

- **What a cold start costs.** On the iPhone simulator the page is drawn about
  two seconds after launch: roughly 1.5 seconds for the phone to start the web
  view process and load the page, then about 0.3 seconds for the app's own
  start-up (reading the school code, opening the pupil list, mounting React).
  The app's JavaScript was measured and is not the slow part: the secure
  storage plugin answers its first call in 50 to 90 ms. The log line
  `Making the view blank because of a JS prompt before the first paint` is
  Capacitor's own bridge asking the native side, with `prompt()`, whether its
  cookie and HTTP patches are on; the native side answers at once, WebKit
  blanks a view that has not painted yet, and the page paints about 150 ms
  later. The cost is the blank that shows until then, so the app covers it.
- **The splash.** `@capacitor/splash-screen` shows the XVS crest from launch.
  The app hides it itself (`src/native/splash.ts`, `splash-gate.tsx`) after the
  first real screen is painted: the school choice, the sign-in, the pupil's
  home, or the "can't reach your school" notice, never the loading mark. If the
  app never gets that far the plugin removes the splash after 8 seconds
  (`launchShowDuration` in `capacitor.config.ts`). The web view's own colour
  before it paints is the app's page background, so nothing flashes black.
- **Icons and splash art.** The sources are in `assets/` and are drawn from the
  XVS crest in `public/svg/`, never the bare CodeX mark. `npm run store-art`
  redraws them (`scripts/render-store-art.mjs`, which needs Google Chrome) and
  runs `@capacitor/assets` to write every size into `ios/` and `android/`
  (`--ios --android` only: it must not touch the web manifest). Commit the
  results.

## Version check

On the store app only, at start and when the app returns to the foreground
(at most every four hours), `src/native/app-version.ts` asks the public
`GET /v1/app-versions/?app=com.codexng.xvs.student&platform=<ios|android>&version=<x.y.z>`
and reads `status`:

- `update_required`: a full screen, "This version of XVS Student is no longer
  supported. Update it to keep using it.", with one button that opens
  `store_url` in the phone's store (`@capacitor/app-launcher`).
- `update_available`: a small dismissible note with an Update button. A
  dismissal is remembered in `@capacitor/preferences` against that `latest`
  version, so the note stays away until a newer one is published.
- `current`, a 404 (no policy set), being offline, or any failure: nothing
  happens.

The version it sends is what `@capacitor/app` `getInfo()` reports, which is the
native project's version. **To release a new version, bump both**:
`MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in
`ios/App/App.xcodeproj/project.pbxproj` (two occurrences each, Debug and
Release), and `versionName` and `versionCode` in `android/app/build.gradle`.
Both are `1.0.0`, build 1 today. `package.json`'s version is not used.

## Links that open the app

The school's website publishes Android's `assetlinks.json` and iPhone's
`apple-app-site-association` on every school address, claiming `/student/*`
for this app (school-fe's `docs/app-links.md`). The app side:

- **iOS**: `ios/App/App/App.entitlements` carries Associated Domains,
  `applinks:` and `webcredentials:` for `*.xvs.codexng.com` and
  `*.xvs-staging.codexng.com`, set as `CODE_SIGN_ENTITLEMENTS` on the App
  target. The App ID in the Apple Developer account needs the Associated
  Domains capability.
- **Android**: an `autoVerify` intent filter on `MainActivity` for `https`,
  both wildcard hosts, path prefix `/student`.
- **In the app** (`src/native/app-links.ts`, `native-links.tsx`): `appUrlOpen`
  gives the link; the host's left label is the school code and the path after
  `/student` is the screen (the store app's router starts at `/`). The same
  school navigates. Another school, or any school when none is chosen yet,
  shows "This link is for <School name>. Switch to that school?" and only a tap
  saves the code and reloads, as the school choice does. Anything that is not
  a school's `/student` address is ignored.

The links verify only once the store values are set in school-fe's Render
settings (the Apple team and bundle id, the Android certificate fingerprints).
Until then:

```bash
adb shell am start -a android.intent.action.VIEW -d "https://meridian.xvs-staging.codexng.com/student/fees"
xcrun simctl openurl booted "https://meridian.xvs-staging.codexng.com/student/fees"
```

Until the domain verifies, neither phone hands the link to the app: Android
opens it in the browser (the intent filter matches, but an unverified link is
not made the app's), and the simulator opens Safari. That is expected, not a
fault. Once the store values are set and the app is installed from a build
signed with the matching key, the same commands open the app on the fees screen.
To exercise the in-app handling before then, call the handler's decisions in
`src/native/app-links.test.ts`, or on Android turn verification off per app in
Settings, Apps, XVS Student, Open by default, and add the school hosts.

## Building for Android on this Mac

Android Studio's bundled JDK is 25, which Gradle 8.14 cannot run on (`Unsupported
class file major version 69`), so the Gradle wrapper is 9.1.0, the first
release that runs on Java 25 and that the Android Gradle plugin 8.13 builds
with. `android/local.properties` points at the SDK
(`sdk.dir=$HOME/Library/Android/sdk`) and is not committed.

```bash
export ANDROID_HOME=~/Library/Android/sdk
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
npm run cap:sync && cd android && ./gradlew assembleDebug
```

## Native push

Notifications reach the phone through Firebase Cloud Messaging on both
platforms (the API sends every phone push through Firebase), using
`@capacitor-firebase/messaging` 8.5.2. The package's own JavaScript is not
imported: its web implementation pulls in the whole Firebase web SDK, which
neither the web app nor the store app can use. `src/native/messaging-plugin.ts`
registers the plugin by name (`FirebaseMessaging`) and uses only its types;
the iOS and Android code come from the package through `cap sync`. A Capacitor
plugin is a proxy that answers `then` as a missing method, so it must never be
the result of an `await` or an async return (`push-device.test.ts` holds that).

- **Config files** (committed, not secret): `android/app/google-services.json`
  (the Google services Gradle plugin is applied by `app/build.gradle` when the
  file exists) and `ios/App/App/GoogleService-Info.plist` (an App target
  resource). The plugin configures Firebase on iOS when it loads. iOS also has
  `aps-environment` (`development`; the store build needs `production`) in
  `App.entitlements`, the `remote-notification` background mode in `Info.plist`,
  and the three APNs forwarding methods in `AppDelegate.swift`.
  `capacitor.config.ts` links the plugin by symlink for Swift Package Manager
  (`ios/App/CapApp-SPM/symlinks/` is git-ignored and rewritten by `cap sync`)
  and sets the iPhone to show the banner and sound for an open app.
- **Asking.** Only after a pupil has signed in, and only behind the in-app
  explanation (`NativePushOffer`: "Get a notification when your results,
  notices or messages arrive", with Not now). Turn on then shows the phone's
  own prompt. Each pupil chooses for themselves (`push/push-choice`: `on`,
  `off`, `not-now`); a refusal is remembered and never asked again. Profile's
  notifications card (`NativePushSetting`) shows on, off, or blocked (with
  where to allow it in the phone's settings) and turns it on or off later.
- **Registering** (`native-push-state.ts`, `push-register.ts`). `POST
  /v1/notify/push/devices/` with `{token, platform, app, app_version, account}`,
  made as each pupil with their own access token (`auth/pupil-fetch.ts`), for
  every pupil on the phone who turned notifications on: at start, when pupils
  change, when the app returns to the front and when Firebase issues a new
  token. 503 `PUSH_NOT_CONFIGURED` is "the school sends no phone push yet": no
  error, the offer is put away and Profile says it is unavailable. Signing a
  pupil out also calls `DELETE` on the same route, best effort, before the
  sign-out call (the server removes the rows on sign-out regardless).
- **A tap** (`native-push.tsx`, `push-routing.ts`). The notification's `account`
  is shown if that pupil is on the phone, then the `url` opens with `/student`
  removed. A pupil no longer on the phone opens the app normally, and a `url`
  outside `/student` opens Home. A tap that launches the app waits for the
  session to open first. Android delivers a launching tap through the plugin
  by itself.
- **An open app.** iPhone shows the system banner; Android shows a toast.
- **Debug builds** log `[push] Firebase token obtained: <token>` once at start
  (`push-debug.ts`); a release build logs nothing.
- Not done: Android's small notification icon is the app icon (a monochrome
  one would look better); the iPhone `aps-environment` must be `production` in
  a store build, and the APNs key must be uploaded to Firebase.

## Deleting the account

Profile has "Delete my account" for any pupil whose `GET
/v1/user/me/account-closure/` says `eligible` (or has a request waiting); a 403
`ACCOUNT_CLOSURE_NOT_OFFERED` hides it. It opens `/profile/delete-account`
(`pages/delete-account.tsx`), which says what happens ("Your school will be
asked to delete your sign-in. Your school record, results and fees stay with
the school."), sends `POST {confirm: true}`, and with a request waiting shows
"Your request is with the school since <date>." instead of the button. A
`closed` answer (not what a pupil's `request` mode gives) signs the pupil off
this phone through `leaveAfterClosure`. Same screen in the browser and the
store app.

## Card payments

In a browser the fees screen sends the page to the gateway and the gateway
returns to `/student/fees/paid?reference=...`. In the store app that would
carry the web view away, so `pages/pay.tsx` opens the checkout with
`@capacitor/browser` 8.0.5 (a Safari view controller or a Custom Tab) through
`native/checkout.ts`. The app comes back by either route:

- the return link opens the app (`appUrlOpen`, `native-links.tsx`): the browser
  is closed and the result screen shown;
- the pupil closes the browser (`browserFinished`, `native-checkout.tsx`): the
  result screen is shown for the checkout they left.

The result screen (`pages/paid.tsx`) asks the API for the payment's status by
reference and shows paid, still waiting or not completed. Nothing in an address
and nothing about how the browser was left marks a payment paid. On an iPhone
the return link may load inside the Safari view instead of opening the app (a
universal link does not fire for a redirect in a Safari view); the pupil taps
Done and the second route takes over.

## Later phases

File sharing of receipts and report cards; the camera for the profile photo.
