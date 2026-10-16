import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "./index.css";
import "./app.css";
// Geist, the same typeface school-fe and the console use; Mono carries figures.
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";

import App from "./App";
import { applySchoolTouchIcon } from "./lib/touch-icon";
import { store } from "./redux/store";

void applySchoolTouchIcon();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
