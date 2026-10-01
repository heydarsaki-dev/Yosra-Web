"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { unlockWithPassword } from "@/lib/vault";
import { Btn, Field, inputCls } from "./ui";

/**
 * درِ ورود وب — پورتِ LoginActivity اندروید:
 *  - اولِ کار (بدون توکن بازشده) رمز خواسته می‌شود؛
 *  - توکن گیت‌هاب فقط با همین رمز باز می‌شود (vault.ts، همان PBKDF2 اپ)؛
 *  - بعد از ورود، توکن در localStorage می‌ماند و دفعات بعد مستقیم وارد می‌شویم
 *    (دقیقاً مثل ذخیره شدن در prefs اندروید).
 */
export function LoginGate() {
  const { dispatch, toast } = useStore();
  const [pw, setPw] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "syncing">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const login = async () => {
    const code = pw.trim();
    if (!code) {
      toast("رمز رو وارد کن 🔒", "error");
      inputRef.current?.focus();
      return;
    }
    setState("checking");
    try {
      const tok = await unlockWithPassword(code);
      if (!tok) {
        toast("رمز اشتباه است ❌", "error");
        setPw("");
        setState("idle");
        inputRef.current?.focus();
        return;
      }
      setState("syncing");
      dispatch({ type: "setToken", payload: tok });
      toast("خوش اومدی 🎉");
      // سینکِ اولِ ورود از داخل store (اثر تغییر توکن) شروع می‌شود
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا در باز کردن قفل ❌", "error");
      setState("idle");
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-7 shadow-2xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-2xl font-black text-white shadow-[0_14px_26px_-14px_rgba(108,92,231,.95)]">
            ی
          </span>
          <b className="text-xl font-black text-ink">یسرا</b>
          <span className="text-xs text-muted">برای فعال شدن همگام‌سازی، رمز ورود را وارد کن</span>
        </div>

        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void login();
          }}
        >
          <Field label="رمز همگام‌سازی" hint="همان رمزی که در اپلیکیشن اندروید تعیین کردی">
            <input
              ref={inputRef}
              type="password"
              dir="ltr"
              autoComplete="current-password"
              className={inputCls}
              placeholder="••••••"
              value={pw}
              autoFocus
              onChange={(e) => setPw(e.target.value)}
              disabled={state !== "idle"}
            />
          </Field>
          <Btn type="submit" className="w-full" disabled={state !== "idle"}>
            {state === "idle"
              ? "ورود"
              : state === "checking"
                ? "در حال بررسی..."
                : "در حال همگام‌سازی..."}
          </Btn>
        </form>
      </div>
    </div>
  );
}
