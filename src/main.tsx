import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "./index.css";
import "./app.css";
// Geist, the same typeface school-fe and the console use; Mono carries figures.
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";

import App from "./App";
import { captureInstallPrompt } from "./install/install-prompt";
import { checkRelatedApps } from "./install/installed";
import { applySchoolApp } from "./lib/school-app";
import { isNativeApp } from "./native/platform";
import { logDebugToken } from "./native/push-debug";
import { loadSchoolCode } from "./native/school-code";
import { schoolApi } from "./redux/services/school-api";
import { store } from "./redux/store";

const native = isNativeApp();

// Before React mounts: the browser's install prompt can come first. The store
// app is already installed and has no install prompt.
if (!native) captureInstallPrompt();

/** The school's public name through the store, so the sign-in screen's own read is the same one. */
async function readSchoolName(slug: string): Promise<string> {
  const read = store.dispatch(schoolApi.endpoints.schoolName.initiate(slug));
  try {
    return await read.unwrap();
  } finally {
    read.unsubscribe();
  }
}

// The browser is asked about the installed app once the school's manifest is on the page.
// The store app has no manifest to point at and no installed app to look for.
if (!native) void applySchoolApp(readSchoolName).then(checkRelatedApps);

/** The store app knows its school only from what was kept, so that is read before anything draws. */
async function start() {
  if (native) await loadSchoolCode();
  if (native) void logDebugToken();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </StrictMode>,
  );
}

void start();
