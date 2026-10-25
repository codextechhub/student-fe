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
};

export default config;
