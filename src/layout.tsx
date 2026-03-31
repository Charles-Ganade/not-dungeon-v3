import { createEffect, on, type Component, type JSX } from "solid-js";
import Navbar from "./app/shared/Navbar";
import { Toaster } from "solid-sonner";
import { Portal } from "solid-js/web";
import { settingsStore } from "./store";

const Layout: Component = (props: { children?: JSX.Element }) => {
  createEffect(
    on(
      () => ({
        ui: settingsStore.settings.UI.uiScale,
        font: settingsStore.settings.UI.fontSize,
        theme: settingsStore.settings.UI.theme,
      }),
      ({ ui, font, theme }) => {
        document.documentElement.style.setProperty("--ui-scale", ui.toString());
        document.documentElement.style.setProperty(
          "--text-scale",
          font.toString(),
        );

        if (theme === "system") {
          document.documentElement.removeAttribute("data-theme");
        } else {
          document.documentElement.setAttribute(
            "data-theme",
            theme === "light" ? "nord" : "forest",
          );
        }
      },
    ),
  );
  return (
    <>
      <Navbar />
      <main>{props.children}</main>
      <Portal>
        <Toaster toastOptions={{ style: { "z-index": "100" } }} />
      </Portal>
    </>
  );
};

export default Layout;
