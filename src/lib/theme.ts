"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
const KEY = "yosra-theme";

/** آیا کلاس .dark روی <html> هست — منبع حقیقت تم در DOM است. */
function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * تم روشن/تیره — کلاس `.dark` را روی <html> می‌گذارد و در localStorage ذخیره می‌کند.
 *
 * برای جلوگیری از hydration mismatch، state اولیه در SSR و کلاینت یکسان است:
 * `useSyncExternalStore` در سرور همیشه "light" برمی‌گرداند و تنها پس از mount
 * مقدار واقعی (از localStorage/prefers-color-scheme) خوانده می‌شود. آیکون دکمه
 * نیز به جای state با کلاس `.dark` کنترل می‌شود.
 */
export function useTheme(): {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
} {
  const theme = useSyncExternalStore(
    subscribe,
    () => (isDark() ? "dark" : "light"),
    () => "light" as Theme
  );

  const apply = useCallback((t: Theme) => {
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* حافظه در دسترس نیست */
    }
    notify();
  }, []);

  const setTheme = useCallback(
    (t: Theme) => {
      apply(t);
    },
    [apply]
  );

  const toggle = useCallback(() => {
    apply(isDark() ? "light" : "dark");
  }, [apply]);

  return { theme, toggle, setTheme };
}
