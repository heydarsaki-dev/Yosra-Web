"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "yosra-theme";

function readInitial(): Theme {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
    return "dark";
  }
  return "light";
}

/**
 * تم روشن/تیره — کلاس `.dark` را روی <html> می‌گذارد و در localStorage ذخیره می‌کند.
 * مقدار اولیه از روی کلاسی که اسکریپت pre-hydration گذاشته می‌خواند تا پرش رنگ نباشد.
 */
export function useTheme(): {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
} {
  const [theme, setThemeState] = useState<Theme>(readInitial);

  const apply = useCallback((t: Theme) => {
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* حافظه در دسترس نیست */
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    apply(t);
  }, [apply]);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      apply(next);
      return next;
    });
  }, [apply]);

  // همگام‌سازی با تغییر سیستم (فقط اگر کاربر انتخاب صریح نداشته باشد)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem(KEY)) return;
      setTheme(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [setTheme]);

  // اطمینان از هماهنگی کلاس <html> با state بعد از هیدرات —
  // ری‌اکت کلاس پیش‌هیدرات را در hydration پاک می‌کند، پس دوباره می‌گذاریم.
  useEffect(() => {
    apply(theme);
    // فقط در mount اجرا می‌شود
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { theme, toggle, setTheme };
}
