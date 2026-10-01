"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import { nice, jParts, monthName, fa, useNow } from "@/lib/jalali";
import { TxModalProvider, useTxModal } from "./TransactionModal";
import {
  ChartIcon,
  DebtIcon,
  GearIcon,
  HomeIcon,
  IncomeIcon,
  ExpenseIcon,
  ListIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
} from "./icons";

const NAV = [
  { href: "/", label: "خانه", short: "خانه", icon: HomeIcon },
  { href: "/transactions", label: "تراکنش‌ها", short: "تراکنش‌ها", icon: ListIcon },
  { href: "/reports", label: "گزارش‌ها", short: "گزارش‌ها", icon: ChartIcon },
  { href: "/debts", label: "بدهی و اقساط", short: "بدهی", icon: DebtIcon },
  { href: "/settings", label: "تنظیمات", short: "تنظیمات", icon: GearIcon },
];

const TITLES: Record<string, { title: string; sub: string }> = {
  "/": { title: "داشبورد", sub: "نمای کلی پول خانواده در یک نگاه" },
  "/transactions": { title: "تراکنش‌ها", sub: "همهٔ درآمدها و خرج‌ها، قابل ویرایش و مرتب‌سازی" },
  "/reports": { title: "گزارش‌ها", sub: "تحلیل رنگارنگ به تفکیک روز و ماه" },
  "/debts": { title: "بدهی و اقساط", sub: "طلبکارها، برنامهٔ قسط و پرداخت‌ها" },
  "/settings": { title: "تنظیمات", sub: "کاربران، دسته‌بندی‌ها، پشتیبان و همگام‌سازی" },
};

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-xl font-black text-white shadow-[0_14px_26px_-14px_rgba(108,92,231,.95)]">
        ی
      </span>
      <span className="leading-tight">
        <b className="block text-lg font-black text-ink">یسرا</b>
        <span className="block text-[11px] text-muted">داشبورد مالی خانواده</span>
      </span>
    </div>
  );
}

/** دکمهٔ تعویض تم — آیکون با کلاس .dark کنترل می‌شود (نه با state) تا
 *  hydration mismatch نباشد و پرش رنگ هم نداشته باشد. */
function ThemeToggle() {
  const { toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="تعویض تم روشن و تیره"
      title="تعویض تم روشن و تیره"
      className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-card text-muted transition hover:text-brand active:scale-95 dark:text-gold"
    >
      <span className="hidden dark:block">
        <SunIcon size={18} />
      </span>
      <span className="block dark:hidden">
        <MoonIcon size={18} />
      </span>
    </button>
  );
}

function QuickActions() {
  const { open } = useTxModal();
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <button
        onClick={() => open({ type: 1 })}
        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-mint-soft px-3 text-[13px] font-black text-mint transition hover:brightness-110 active:scale-95 sm:px-3.5"
      >
        <IncomeIcon size={16} />
        <span className="hidden sm:inline">درآمد</span>
      </button>
      <button
        onClick={() => open({ type: 0 })}
        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-rose-soft px-3 text-[13px] font-black text-rose transition hover:brightness-110 active:scale-95 sm:px-3.5"
      >
        <ExpenseIcon size={16} />
        <span className="hidden sm:inline">خرج</span>
      </button>
      <button
        onClick={() => open()}
        className="hidden h-10 items-center gap-1.5 rounded-xl bg-gradient-to-l from-brand-deep to-brand px-4 text-[13px] font-black text-white shadow-[0_14px_26px_-16px_rgba(108,92,231,.95)] transition hover:brightness-110 active:scale-95 md:inline-flex"
      >
        <PlusIcon size={16} /> ثبت تراکنش
      </button>
    </div>
  );
}

function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-8">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-in max-w-md rounded-2xl px-5 py-3 text-center text-[13px] font-bold text-white shadow-xl ${
            t.tone === "error"
              ? "bg-[#c2183f] dark:bg-[#e0244e]"
              : t.tone === "success"
                ? "bg-[#15803d] dark:bg-[#22c55e]"
                : t.tone === "info"
                  ? "bg-[#2a2e4a] dark:bg-[#3a3f66]"
                  : "bg-[#1e2138] dark:bg-[#282c4e]"
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const meta = TITLES[path] ?? { title: "یسرا", sub: "" };
  const { db } = useStore();
  const now = useNow();
  const nowJ = jParts(now);

  // جلوگیری از پرش اسکرول موقع باز/بسته شدن مودال‌ها
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
  }, []);

  return (
    <div className="min-h-screen">
      {/* ------------------------------ سایدبار ------------------------------ */}
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-64 flex-col border-l border-line bg-card px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo />
        </div>

        <nav className="mt-8 flex flex-col gap-1.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[13.5px] font-bold transition ${
                  active
                    ? "bg-brand-soft text-brand"
                    : "text-muted hover:bg-canvas hover:text-ink"
                }`}
              >
                {active && (
                  <span className="absolute -right-4 h-6 w-1.5 rounded-l-full bg-brand" />
                )}
                <Icon size={19} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-3xl bg-gradient-to-br from-brand to-brand-2 p-4 text-white">
            <p className="text-[11px] opacity-80">امروز</p>
            <p className="mt-1 text-[13px] font-black">{nice(now)}</p>
            <div className="mt-3 flex flex-wrap -space-x-2 overflow-hidden space-x-reverse">
              {db.members.map((m) => (
                <span
                  key={m.id}
                  className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-white/80 text-sm"
                  style={{ background: m.color }}
                  title={m.name}
                >
                  {m.emoji}
                </span>
              ))}
            </div>
          </div>
          <p className="text-center text-[11px] text-faint">نسخه ۱.۰.۰ • نسخهٔ وب</p>
        </div>
      </aside>

      {/* ------------------------------ محتوا ------------------------------ */}
      <div className="lg:pr-64">
        <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3.5 sm:gap-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="lg:hidden">
                <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-lg font-black text-white">
                  ی
                </span>
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-[15px] font-black leading-tight text-ink sm:text-[17px]">
                  {meta.title}
                </h1>
                <p className="hidden truncate text-[12px] text-muted sm:block">{meta.sub}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <span className="hidden items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-[12px] font-bold text-muted md:inline-flex">
                <span className="size-2 rounded-full bg-mint" />
                {monthName(nowJ[1])} {fa(nowJ[0])}
              </span>
              <ThemeToggle />
              <QuickActions />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-3 pb-28 pt-5 sm:px-6 sm:pb-32 lg:pb-14 lg:pt-6">
          {children}
        </main>
      </div>

      {/* ---------------------------- ناوبری موبایل ---------------------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-line bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map(({ href, short, icon: Icon }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-bold transition ${
                active ? "text-brand" : "text-faint"
              }`}
            >
              <span
                className={`grid size-9 place-items-center rounded-xl transition ${
                  active ? "bg-brand-soft" : ""
                }`}
              >
                <Icon size={19} />
              </span>
              <span className="truncate">{short}</span>
            </Link>
          );
        })}
      </nav>

      <Toasts />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <TxModalProvider>
      <Shell>{children}</Shell>
    </TxModalProvider>
  );
}
