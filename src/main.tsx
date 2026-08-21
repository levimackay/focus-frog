import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CompanionWindow from "./windows/CompanionWindow";
import NuclearWindow from "./windows/NuclearWindow";
import { resolveWindowKind } from "./windows/resolveWindowKind";

const windowKind = resolveWindowKind(window.location.hash);

const roots = {
  main: App,
  companion: CompanionWindow,
  nuclear: NuclearWindow,
} as const;

const Root = roots[windowKind];

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
