"use client";

import { useEffect, type ReactNode } from "react";
import { CloseIcon } from "./icons";

/** عنوان صفحه — چون صفحات client هستند، عنوان را روی داکیوست می‌گذاریم */
export function Title({ text }: { text: string }) {
  useEffect(() => {
    document.title = `${text} | یسرا`;
  }, [text]);
  return null;
}

export function Card({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <section
      className={`card fade-up ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </section>
  );
}

export function SectionTitle({
  icon,
  title,
  sub,
  action,
}: {
  icon?: ReactNode;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
            {icon}
          </span>
        )}
        <div>
          <h2 className="text-[15px] font-bold text-ink">{title}</h2>
          {sub && <p className="mt-0.5 text-xs leading-5 text-muted">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "soft" | "ghost" | "danger" | "success";
  size?: "sm" | "md";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
};

export function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  disabled,
  title,
}: BtnProps) {
  const variants: Record<string, string> = {
    primary:
      "bg-gradient-to-l from-brand-deep to-brand text-white shadow-[0_14px_28px_-16px_rgba(108,92,231,.9)] hover:brightness-110",
    soft: "bg-brand-soft text-brand hover:bg-[#e5e1ff]",
    ghost: "bg-transparent text-muted hover:bg-line",
    danger: "bg-rose-soft text-rose hover:bg-[#fbcfd9]",
    success: "bg-mint-soft text-mint hover:bg-[#c6ebdc]",
  };
  const sizes: Record<string, string> = {
    sm: "h-9 px-3.5 text-[13px] rounded-xl",
    md: "h-11 px-5 text-sm rounded-2xl",
  };
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 font-bold transition active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Chip({
  children,
  active,
  tone = "brand",
  onClick,
  className = "",
}: {
  children: ReactNode;
  active?: boolean;
  tone?: "brand" | "mint" | "rose";
  onClick?: () => void;
  className?: string;
}) {
  const on: Record<string, string> = {
    brand: "border-brand bg-brand-soft text-brand",
    mint: "border-mint bg-mint-soft text-mint",
    rose: "border-rose bg-rose-soft text-rose",
  };
  const off = "border-line bg-white text-muted hover:border-[#dfe3f2] hover:text-ink";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-[13px] font-bold transition active:scale-[.97] ${
        active ? on[tone] : off
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`pop-in flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[26px] bg-white shadow-2xl sm:max-h-[88vh] sm:rounded-[26px] ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h3 className="text-[15px] font-bold text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="grid size-9 place-items-center rounded-xl bg-line text-muted transition hover:bg-[#e3e7f5] hover:text-ink"
            aria-label="بستن"
          >
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-bold text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-2xl border border-line bg-canvas px-4 py-3 text-sm text-ink outline-none transition placeholder:text-faint focus:border-brand focus:bg-white";

export function Empty({
  emoji,
  title,
  sub,
  action,
}: {
  emoji: string;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="grid size-16 place-items-center rounded-3xl bg-brand-soft text-3xl">
        {emoji}
      </div>
      <p className="mt-4 text-sm font-bold text-ink">{title}</p>
      {sub && <p className="mt-1 max-w-xs text-xs leading-6 text-muted">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({
  emoji,
  color,
  size = 40,
}: {
  emoji: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full text-white"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        fontSize: size * 0.45,
      }}
    >
      {emoji}
    </span>
  );
}

export function Confirm({
  open,
  message,
  onYes,
  onNo,
  yesLabel = "حذف",
}: {
  open: boolean;
  message: string;
  onYes: () => void;
  onNo: () => void;
  yesLabel?: string;
}) {
  return (
    <Modal open={open} onClose={onNo} title="تأیید عملیات">
      <p className="text-sm leading-7 text-ink">{message}</p>
      <div className="mt-5 flex gap-3">
        <Btn variant="danger" className="flex-1" onClick={onYes}>
          {yesLabel}
        </Btn>
        <Btn variant="ghost" className="flex-1" onClick={onNo}>
          بی‌خیال
        </Btn>
      </div>
    </Modal>
  );
}
