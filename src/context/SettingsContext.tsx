import { createContext, useContext } from "solid-js";
import { createStore } from "solid-js/store";

type SettingsStore = {};

type SettingsContextType = {
  settings: SettingsStore;
  setSettings: (value: Partial<SettingsStore>) => void;
};

const SettingsContext = createContext<SettingsContextType>();

export function SettingsProvider(props: { children: any }) {
  const [settings, setSettings] = createStore<SettingsStore>({});

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {props.children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

export default SettingsContext;
