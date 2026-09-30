"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { Category, Member, TxType } from "@/lib/types";
import { emptyDB } from "@/lib/seed";
import { clock, fa, inMonth, money, nice } from "@/lib/jalali";
import { downloadBackup, parseBackupFile } from "@/lib/github";
import { unlockWithPassword } from "@/lib/vault";
import {
  Avatar,
  Btn,
  Card,
  Chip,
  Confirm,
  Empty,
  Field,
  Modal,
  SectionTitle,
  Title,
  inputCls,
} from "@/components/ui";
import {
  CloudDownIcon,
  CloudUpIcon,
  DownloadIcon,
  EditIcon,
  PlusIcon,
  TagIcon,
  TrashIcon,
  UploadIcon,
  UsersIcon,
} from "@/components/icons";

const MEM_EMOJIS = ["🚕", "🏠", "👦🏻", "👧🏻", "👩🏻", "👨🏻", "🌸", "⭐", "🐱", "💼"];
const MEM_COLORS = [
  "#6C5CE7", "#F06292", "#059669", "#F7971E",
  "#29B6F6", "#8D6E63", "#EC407A", "#66BB6A",
];
const CAT_EMOJIS = ["", "🚕", "🏠", "🍔", "⛽", "🧾", "🛒", "💊", "🎮", "🔧", "💰", "💵", "⭐"];

/* --------------------------------- دیالوگ کاربر --------------------------------- */

function MemberDialog({ edit, onClose }: { edit?: Member; onClose: () => void }) {
  const { dispatch, toast } = useStore();
  const [name, setName] = useState(edit?.name ?? "");
  const [emoji, setEmoji] = useState(edit?.emoji ?? MEM_EMOJIS[0]);
  const [color, setColor] = useState(edit?.color ?? MEM_COLORS[0]);

  const save = () => {
    if (!name.trim()) return toast("اسم را بنویس 🙏", "error");
    if (edit) {
      dispatch({ type: "updateMember", payload: { id: edit.id, patch: { name: name.trim(), emoji, color } } });
      toast(`«${name.trim()}» ویرایش شد ✓`);
    } else {
      dispatch({ type: "addMember", payload: { name: name.trim(), emoji, color } });
      toast(`«${name.trim()}» اضافه شد ✓`);
    }
    onClose();
  };

  return (
    <div className="space-y-4">
      <Field label="اسم کاربر">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً حیدر" className={inputCls} autoFocus />
      </Field>
      <Field label="ایموجی">
        <div className="flex flex-wrap gap-2">
          {MEM_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`grid size-11 place-items-center rounded-2xl border text-xl transition ${
                emoji === e ? "border-brand bg-brand-soft" : "border-line hover:bg-canvas"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </Field>
      <Field label="رنگ آواتار">
        <div className="flex flex-wrap gap-2.5">
          {MEM_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`size-10 rounded-full transition ${color === c ? "ring-4 ring-ink/15" : ""}`}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>
      </Field>
      <div className="flex gap-3 pt-1">
        <Btn className="flex-1" onClick={save}>
          {edit ? "ذخیره ✓" : "افزودن ✓"}
        </Btn>
        <Btn variant="ghost" onClick={onClose}>
          بی‌خیال
        </Btn>
      </div>
    </div>
  );
}

/* --------------------------------- دیالوگ دسته --------------------------------- */

function CategoryDialog({ edit, onClose }: { edit?: Category; onClose: () => void }) {
  const { dispatch, toast } = useStore();
  const [name, setName] = useState(edit?.name ?? "");
  const [type, setType] = useState<TxType>(edit?.type ?? 1);
  const [emoji, setEmoji] = useState(edit?.emoji ?? "");

  const save = () => {
    if (!name.trim()) return toast("اسم دسته را بنویس 🙏", "error");
    const em = emoji || (type === 1 ? "💰" : "✨");
    if (edit) {
      dispatch({ type: "updateCategory", payload: { id: edit.id, patch: { name: name.trim(), emoji: em, type } } });
      toast(`«${name.trim()}» ویرایش شد ✓`);
    } else {
      dispatch({ type: "addCategory", payload: { name: name.trim(), emoji: em, type } });
      toast(`«${name.trim()}» اضافه شد ✓`);
    }
    onClose();
  };

  return (
    <div className="space-y-4">
      <Field label="اسم دسته">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثلاً اسنپ"
          className={inputCls}
          autoFocus
        />
      </Field>
      <Field label="نوع">
        <div className="grid grid-cols-2 gap-2.5">
          <Chip tone="mint" active={type === 1} onClick={() => setType(1)} className="justify-center py-3">
            درآمد
          </Chip>
          <Chip tone="rose" active={type === 0} onClick={() => setType(0)} className="justify-center py-3">
            خرج
          </Chip>
        </div>
      </Field>
      <Field label="ایموجی (اختیاری)">
        <div className="flex flex-wrap gap-2">
          {CAT_EMOJIS.map((e, i) => (
            <button
              key={i}
              onClick={() => setEmoji(e)}
              className={`grid size-10 place-items-center rounded-2xl border text-lg transition ${
                emoji === e ? "border-brand bg-brand-soft" : "border-line hover:bg-canvas"
              }`}
            >
              {e === "" ? "—" : e}
            </button>
          ))}
        </div>
      </Field>
      <div className="flex gap-3 pt-1">
        <Btn className="flex-1" onClick={save}>
          {edit ? "ذخیره ✓" : "افزودن ✓"}
        </Btn>
        <Btn variant="ghost" onClick={onClose}>
          بی‌خیال
        </Btn>
      </div>
    </div>
  );
}

/* ----------------------------------- صفحه ----------------------------------- */

export default function SettingsPage() {
  const { db, dispatch, toast, replaceAll, resetAll, syncPush, syncPull } = useStore();

  const [memberModal, setMemberModal] = useState<{ open: boolean; edit?: Member }>({ open: false });
  const [catModal, setCatModal] = useState<{ open: boolean; edit?: Category }>({ open: false });
  const [catType, setCatType] = useState<TxType>(1);
  const [showAllCats, setShowAllCats] = useState(false);

  const [memberDel, setMemberDel] = useState<Member | null>(null);
  const [catDel, setCatDel] = useState<Category | null>(null);
  const [askRestore, setAskRestore] = useState(false);
  const [askClear, setAskClear] = useState(false);
  const [askSample, setAskSample] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  // همگام‌سازی — فقط با رمز
  const [pw, setPw] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [askPull, setAskPull] = useState(false);

  const cats = db.categories
    .filter((c) => c.type === catType)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const shownCats = showAllCats ? cats : cats.slice(0, 5);

  const onImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseBackupFile(text);
      replaceAll({ ...emptyDB(), ...parsed });
      toast("بازیابی انجام شد ✅");
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا در بازیابی ❌", "error");
    }
  };

  const doPush = async () => {
    setBusy(true);
    const ok = await syncPush();
    setBusy(false);
    if (ok) toast("📤 آپلود شد ✓");
  };

  /** باز کردن قفل توکن گیت‌هاب با رمز — دقیقاً مثل اپ اندروید */
  const unlock = async () => {
    const code = pw.trim();
    if (!code) return toast("رمز را وارد کن 🔒", "error");
    setUnlocking(true);
    try {
      const tok = await unlockWithPassword(code);
      if (!tok) {
        toast("رمز اشتباه است ❌", "error");
        return;
      }
      dispatch({ type: "setToken", payload: tok });
      setPw("");
      toast("قفل باز شد ✓ همگام‌سازی فعال شد");
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا در باز کردن قفل ❌", "error");
    } finally {
      setUnlocking(false);
    }
  };
  const doPull = async () => {
    setBusy(true);
    const ok = await syncPull();
    setBusy(false);
    if (ok) toast("📥 بازیابی شد ✓");
  };

  return (
    <div className="space-y-5">
      <Title text="تنظیمات" />

      {/* ------------------------------ کاربران ------------------------------ */}
      <Card delay={0}>
        <SectionTitle
          icon={<UsersIcon size={18} />}
          title="کاربران خانواده"
          sub="هر درآمد یا خرج به یکی از این کاربران تعلق می‌گیرد"
          action={
            <Btn size="sm" onClick={() => setMemberModal({ open: true })}>
              <PlusIcon size={15} /> کاربر
            </Btn>
          }
        />
        <div className="mt-4 space-y-2 px-3 pb-5">
          {db.members.map((m) => {
            const spent = db.transactions
              .filter((t) => t.memberId === m.id && t.type === 0 && inMonth(t.ts))
              .reduce((s, t) => s + t.amount, 0);
            return (
              <div
                key={m.id}
                className="group flex items-center gap-3 rounded-2xl border border-line p-3"
              >
                <Avatar emoji={m.emoji} color={m.color} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-ink">{m.name}</p>
                  <p className="text-[11.5px] text-faint">
                    خرج این ماه: <span className="num">{money(spent)}</span> تومان
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => setMemberModal({ open: true, edit: m })}
                    className="grid size-8 place-items-center rounded-xl text-faint transition hover:bg-brand-soft hover:text-brand"
                    title="ویرایش"
                  >
                    <EditIcon size={15} />
                  </button>
                  <button
                    onClick={() => setMemberDel(m)}
                    className="grid size-8 place-items-center rounded-xl text-faint transition hover:bg-rose-soft hover:text-rose"
                    title="حذف"
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              </div>
            );
          })}
          {db.members.length === 0 && (
            <Empty emoji="👨‍👩‍👧" title="کاربری وجود ندارد" sub="حداقل یک کاربر لازم است." />
          )}
        </div>
      </Card>

      {/* ------------------------------ دسته‌بندی‌ها ------------------------------ */}
      <Card delay={70}>
        <SectionTitle
          icon={<TagIcon size={18} />}
          title="دسته‌بندی‌ها"
          sub="ترتیب دسته‌ها را با فلش‌ها عوض کن"
          action={
            <Btn size="sm" onClick={() => setCatModal({ open: true })}>
              <PlusIcon size={15} /> دسته
            </Btn>
          }
        />
        <div className="flex gap-2 px-5 pt-4">
          <Chip tone="mint" active={catType === 1} onClick={() => setCatType(1)}>
            دسته‌های درآمد
          </Chip>
          <Chip tone="rose" active={catType === 0} onClick={() => setCatType(0)}>
            دسته‌های خرج
          </Chip>
        </div>

        <div className="mt-3 space-y-1.5 px-3 pb-3">
          {shownCats.map((c, i) => (
            <div key={c.id} className="group flex items-center gap-3 rounded-2xl border border-line p-2.5">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-2xl text-base bg-mint-soft dark:bg-[#12362b]"
                style={c.type === 1 ? undefined : { background: "var(--color-rose-soft)" }}
              >
                {c.emoji}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-ink">
                {c.name}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => {
                    const ids = cats.map((x) => x.id);
                    if (i === 0) return;
                    [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                    dispatch({ type: "reorderCategories", payload: ids });
                    toast("ترتیب تغییر کرد ⠿", "info");
                  }}
                  disabled={i === 0}
                  className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-line hover:text-ink disabled:opacity-30"
                  title="بالا"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V6M7 11l5-5 5 5" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    const ids = cats.map((x) => x.id);
                    if (i === ids.length - 1) return;
                    [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
                    dispatch({ type: "reorderCategories", payload: ids });
                    toast("ترتیب تغییر کرد ⠿", "info");
                  }}
                  disabled={i === cats.length - 1}
                  className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-line hover:text-ink disabled:opacity-30"
                  title="پایین"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v13M7 13l5 5 5-5" />
                  </svg>
                </button>
                <button
                  onClick={() => setCatModal({ open: true, edit: c })}
                  className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-brand-soft hover:text-brand"
                  title="ویرایش"
                >
                  <EditIcon size={14} />
                </button>
                <button
                  onClick={() => setCatDel(c)}
                  className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-rose-soft hover:text-rose"
                  title="حذف"
                >
                  <TrashIcon size={14} />
                </button>
              </span>
            </div>
          ))}
          {cats.length === 0 && (
            <Empty
              emoji="🏷️"
              title="دسته‌ای برای این نوع نیست"
              sub="یک دستهٔ جدید اضافه کن."
              action={<Btn size="sm" onClick={() => setCatModal({ open: true })}>افزودن دسته</Btn>}
            />
          )}
        </div>

        {cats.length > 5 && (
          <button
            onClick={() => setShowAllCats((v) => !v)}
            className="mx-5 mb-5 w-[calc(100%-2.5rem)] rounded-2xl border border-line py-2.5 text-[12.5px] font-bold text-brand transition hover:bg-brand-soft"
          >
            {showAllCats
              ? "▲ بستن لیست"
              : `▼ نمایش همهٔ ${fa(cats.length)} دسته`}
          </button>
        )}
      </Card>

      {/* ------------------------------ پشتیبان‌گیری ------------------------------ */}
      <Card delay={140}>
        <SectionTitle
          icon={<DownloadIcon size={18} />}
          title="پشتیبان‌گیری محلی"
          sub="دیتابیس را به‌صورت فایل JSON بگیر یا برگردان"
        />
        <div className="flex flex-wrap gap-3 px-5 pb-6 pt-4">
          <Btn variant="soft" onClick={() => downloadBackup(db)}>
            <DownloadIcon size={16} /> گرفتن بکاپ
          </Btn>
          <Btn variant="ghost" onClick={() => setAskRestore(true)}>
            <UploadIcon size={16} /> بازیابی از فایل
          </Btn>
        </div>
      </Card>

      {/* ------------------------------ همگام‌سازی گیت‌هاب ------------------------------ */}
      <Card delay={210}>
        <SectionTitle
          icon={<CloudUpIcon size={18} />}
          title="همگام‌سازی با گیت‌هاب"
          sub="هر تغییر به‌صورت خودکار در ریپوی خصوصی yosra-backup ذخیره می‌شود"
        />
        <div className="space-y-4 px-5 pb-6 pt-4">
          {db.token ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-mint-soft px-4 py-2 text-[12.5px] font-black text-mint">
                  🔓 متصل و همگام است
                </span>
                <span className="text-[12px] text-muted">
                  آخرین همگام‌سازی:{" "}
                  {db.lastSync ? `${nice(db.lastSync)} ساعت ${clock(db.lastSync)}` : "هنوز انجام نشده"}
                </span>
              </div>
              <div className="rounded-2xl bg-canvas px-4 py-3 text-[12px] leading-6 text-muted">
                ✅ هر تغییری که در وب می‌دهی، خودکار آپلود می‌شود
                <br />
                ✅ هر ۶۰ ثانیه و با بازگشت به این تب، نسخهٔ آنلاین بررسی می‌شود
                <br />
                ✅ اپلیکیشن اندروید از همان بکاپ استفاده می‌کند — داده‌ها همیشه یکسان‌اند
              </div>
            </div>
          ) : (
            <Field
              label="رمز همگام‌سازی"
              hint="رمز تعیین‌شده در اپلیکیشن اندروید را وارد کن. توکن گیت‌هاب به‌صورت رمزنگاری‌شده در سورس قرار دارد و فقط با این رمز باز می‌شود."
            >
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") unlock();
                }}
                placeholder="••••••"
                className={inputCls}
                autoFocus
              />
            </Field>
          )}

          <div className="flex flex-wrap gap-3">
            {!db.token && (
              <Btn onClick={unlock} disabled={unlocking}>
                {unlocking ? "در حال باز کردن قفل..." : "🔓 فعال‌سازی همگام‌سازی"}
              </Btn>
            )}
            {db.token && (
              <>
                <Btn variant="success" onClick={() => void doPush()} disabled={busy}>
                  <CloudUpIcon size={16} /> {busy ? "در حال آپلود..." : "آپلود دستی"}
                </Btn>
                <Btn variant="soft" onClick={() => setAskPull(true)} disabled={busy}>
                  <CloudDownIcon size={16} /> دریافت دستی
                </Btn>
              </>
            )}
          </div>

          {db.token ? (
            <div className="flex items-center gap-3">
              <Btn
                variant="ghost"
                onClick={() => {
                  dispatch({ type: "setToken", payload: "" });
                  toast("اتصال قطع شد", "info");
                }}
              >
                قطع اتصال
              </Btn>
              <p className="text-[11.5px] leading-6 text-faint">
                ⚠️ دریافت دستی، اطلاعات فعلی این مرورگر را با نسخهٔ گیت‌هاب جایگزین می‌کند.
              </p>
            </div>
          ) : (
            <p className="text-[11.5px] leading-6 text-faint">
              🔒 توکن واقعی هرگز در سورس دیده نمی‌شود — دقیقاً مثل اپ اندروید.
            </p>
          )}
        </div>
      </Card>

      {/* ------------------------------ درباره و خطرات ------------------------------ */}
      <Card delay={280}>
        <SectionTitle icon={<TrashIcon size={18} />} title="داده‌ها و دربارهٔ اپ" />
        <div className="space-y-3 px-5 pb-6 pt-4">
          <div className="flex flex-wrap gap-3">
            <Btn variant="ghost" onClick={() => setAskSample(true)}>
              🎲 بازنشانی داده‌های نمونه
            </Btn>
            <Btn variant="danger" onClick={() => setAskClear(true)}>
              <TrashIcon size={16} /> پاک‌کردن همهٔ داده‌ها
            </Btn>
          </div>
          <p className="text-[11.5px] leading-6 text-faint">
            یسرا نسخهٔ وب ۱.۰.۰ — تبدیل‌شده از اپلیکیشن اندروید یسرا. تمام داده‌ها فقط روی همین
            مرورگر ذخیره می‌شوند. ساخته‌شده با Next.js و Tailwind CSS.
          </p>
        </div>
      </Card>

      {/* ------------------------------ مودال‌ها ------------------------------ */}
      <Modal
        open={memberModal.open}
        onClose={() => setMemberModal({ open: false })}
        title={memberModal.edit ? "✏️ ویرایش کاربر" : "＋ کاربر جدید"}
      >
        {memberModal.open && (
          <MemberDialog
            key={memberModal.edit?.id ?? "new"}
            edit={memberModal.edit}
            onClose={() => setMemberModal({ open: false })}
          />
        )}
      </Modal>

      <Modal
        open={catModal.open}
        onClose={() => setCatModal({ open: false })}
        title={catModal.edit ? "✏️ ویرایش دسته" : "＋ دسته‌بندی جدید"}
      >
        {catModal.open && (
          <CategoryDialog
            key={catModal.edit?.id ?? "new"}
            edit={catModal.edit}
            onClose={() => setCatModal({ open: false })}
          />
        )}
      </Modal>

      <Confirm
        open={memberDel !== null}
        message={`«${memberDel?.name ?? ""}» و همهٔ تراکنش‌هایش حذف بشن؟`}
        onYes={() => {
          if (memberDel) {
            if (db.members.length <= 1) {
              toast("حداقل یک کاربر لازم است!", "error");
            } else {
              dispatch({ type: "deleteMember", payload: memberDel.id });
              toast("حذف شد ✓");
            }
          }
          setMemberDel(null);
        }}
        onNo={() => setMemberDel(null)}
      />

      <Confirm
        open={catDel !== null}
        message={`دستهٔ «${catDel?.name ?? ""}» حذف بشه؟ تراکنش‌های قبلی‌اش بی‌دسته می‌شوند.`}
        onYes={() => {
          if (catDel) {
            dispatch({ type: "deleteCategory", payload: catDel.id });
            toast("حذف شد ✓");
          }
          setCatDel(null);
        }}
        onNo={() => setCatDel(null)}
      />

      <Confirm
        open={askRestore}
        message="بازیابی، همهٔ اطلاعات فعلی را با فایل بکاپ جایگزین می‌کند. ادامه بدم؟"
        yesLabel="بله، بازیابی کن"
        onYes={() => {
          setAskRestore(false);
          fileRef.current?.click();
        }}
        onNo={() => setAskRestore(false)}
      />

      <Confirm
        open={askPull}
        message="دریافت از گیت‌هاب، همهٔ اطلاعات فعلی این مرورگر را با نسخهٔ آنلین جایگزین می‌کند. ادامه بدم؟"
        yesLabel="بله، دریافت کن"
        onYes={() => {
          setAskPull(false);
          void doPull();
        }}
        onNo={() => setAskPull(false)}
      />

      <Confirm
        open={askClear}
        message="همهٔ تراکنش‌ها، کاربران و بدهی‌ها پاک شوند؟ این کار قابل بازگشت نیست!"
        onYes={() => {
          resetAll(false);
          toast("همه پاک شد ✓");
          setAskClear(false);
        }}
        onNo={() => setAskClear(false)}
      />

      <Confirm
        open={askSample}
        message="داده‌های نمونه (درآمد و خرج و بدهی تستی) دوباره ساخته شوند؟"
        yesLabel="بله، بساز"
        onYes={() => {
          resetAll(true);
          toast("داده‌های نمونه ساخته شد 🎲");
          setAskSample(false);
        }}
        onNo={() => setAskSample(false)}
      />

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
