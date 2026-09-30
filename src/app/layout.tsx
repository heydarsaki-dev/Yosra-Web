import type { Metadata } from "next";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/700.css";
import "@fontsource/vazirmatn/900.css";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: { default: "یسرا | داشبورد مالی خانواده", template: "%s | یسرا" },
  description: "داشبورد وب یسرا — ثبت درآمد و خرج، بدهی و اقساط و گزارش‌های رنگارنگ خانوادگی",
};

/**
 * اسکریپت کوچک قبل از هیدرات — تم ذخیره‌شده را روی <html> می‌گذارد تا
 * هنگام بارگذاری، پرش رنگ (FOUC) نبینیم.
 */
const themeScript = `(function(){try{var t=localStorage.getItem("yosra-theme");var m=window.matchMedia("(prefers-color-scheme: dark)").matches;if(t==="dark"||(!t&&m))document.documentElement.classList.add("dark");}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
