import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The XVS Student store app: the pupil web app in a Capacitor shell.
 *
 * `webDir` is the native build (`npm run build:native`), kept apart from the
 * web app's `dist/`. The default schemes are kept on purpose: the WebView's
 * origin is `capacitor://localhost` on iOS and `https://localhost` on Android,
 * and those are the two origins the API accepts as the store app.
 */
const config: CapacitorConfig = {
  appId: "com.codexng.xvs.student",
  appName: "XVS Student",
  webDir: "dist-native",
  // The web view's colour before the page has painted, the app's page background.
  backgroundColor: "#F9FAFB",
  plugins: {
    // The splash (the XVS crest) is taken down by the app once its first real
    // screen is drawn (`src/native/splash.ts`). Auto-hide is the safety net: if
    // the app never gets that far, the plugin removes the splash itself after
    // this long, so a failed start never leaves it up for good.
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 8000,
      launchFadeOutDuration: 200,
      backgroundColor: "#F9FAFB",
      showSpinner: false,
    },
  },
};

export default config;
