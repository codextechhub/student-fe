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
import { schoolApi } from "./redux/services/school-api";
import { store } from "./redux/store";

// Before React mounts: the browser's install prompt can come first.
captureInstallPrompt();

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
void applySchoolApp(readSchoolName).then(checkRelatedApps);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
