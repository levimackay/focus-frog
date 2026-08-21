import { useEffect, useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";

/** True when motion should be minimized: explicit setting OR OS preference. */
export function useReducedMotion(): boolean {
  const explicit = useSettingsStore((s) => s.settings.reduced_motion);
  const [osPreference, setOsPreference] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setOsPreference(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return explicit || osPreference;
}
