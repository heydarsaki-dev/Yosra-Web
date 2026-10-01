/**
 * Realtime — کانال خصوصی Apinator برای اطلاع لحظه‌ای «دیتابیس آنلاین عوض شد».
 *
 * پروتکل Pusher-compatible طبق AsyncAPI رسمی:
 *   wss://ws-{region}.apinator.io/app/{app_key}
 * پیام‌ها: {event, channel?, data} که data خودش یک JSON-string است.
 *
 * طرح:
 *  - هر دو طرف (وب و اندروید) به کانال خصوصی private-yosra-sync وصل می‌شوند.
 *  - امضای auth کانال خصوصی لوکال حساب می‌شود: "key:hex(hmac(secret, socketId:channel)"
 *  - بعد از هر push موفق به گیت‌هاب، یک ایونت client-db-updated روی همان
 *    سوکت ارسال می‌شود (بدون REST و بدون app_id).
 *  - با دریافت ایونت، طرف دیگر سینک عادی (pull/merge) را اجرا می‌کند.
 *  - اگر سوکت قطع باشد، همان پولینگ ۲۰ ثانیه‌ای پشتیبان است.
 *
 * نکتهٔ امنیتی: سکرت در باندل مرورگر قابل‌مشاهده است؛ ولی payload فقط یک
 * «خبر» است (from/at) و دادهٔ مالی یا توکن گیت‌هاب منتقل نمی‌شود.
 */

export const RT_CHANNEL = "private-yosra-sync";
export const RT_EVENT = "client-db-updated";

export interface RtConfig {
  key: string;
  secret: string;
  region: string;
}

export function rtConfig(): RtConfig | null {
  const key = process.env.NEXT_PUBLIC_APINATOR_KEY ?? "";
  const secret = process.env.NEXT_PUBLIC_APINATOR_SECRET ?? "";
  const region = process.env.NEXT_PUBLIC_APINATOR_REGION ?? "eu";
  if (!key || !secret) return null;
  return { key, secret, region };
}

export async function hmacHex(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** امضای auth کانال خصوصی: "appkey:hex(hmac(secret, socketId:channel))" */
export async function channelAuth(cfg: RtConfig, socketId: string, channel: string): Promise<string> {
  const sig = await hmacHex(cfg.secret, `${socketId}:${channel}`);
  return `${cfg.key}:${sig}`;
}

export function buildSubscribe(channel: string, auth?: string): string {
  const inner: Record<string, string> = { channel };
  if (auth) inner.auth = auth;
  return JSON.stringify({ event: "realtime:subscribe", data: JSON.stringify(inner) });
}

export function buildUnsubscribe(channel: string): string {
  return JSON.stringify({ event: "realtime:unsubscribe", data: JSON.stringify({ channel }) });
}

export function buildClientEvent(channel: string, name: string, payload: unknown): string {
  return JSON.stringify({ event: name, channel, data: JSON.stringify(payload) });
}

export function buildPong(): string {
  return JSON.stringify({ event: "realtime:pong", data: "{}" });
}

export interface RtMessage {
  event: string;
  channel?: string;
  data: string;
}

export function parseMessage(raw: string): RtMessage | null {
  try {
    const o = JSON.parse(raw) as { event?: unknown; channel?: unknown; data?: unknown };
    if (typeof o?.event !== "string" || typeof o?.data !== "string") return null;
    return {
      event: o.event,
      channel: typeof o.channel === "string" ? o.channel : undefined,
      data: o.data,
    };
  } catch {
    return null;
  }
}

export function parseData<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export interface RtPayload {
  from: string;
  at: number;
}

export interface RtCallbacks {
  onRemoteUpdate: (payload: RtPayload) => void;
  onStatus?: (connected: boolean) => void;
}

export type SocketFactory = (url: string) => WebSocket;

let testFactory: SocketFactory | null = null;
/** فقط برای تست — جایگزینی سازندهٔ سوکت */
export function __setSocketFactoryForTests(f: SocketFactory | null): void {
  testFactory = f;
}

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return (crypto as { randomUUID: () => string }).randomUUID();
    }
  } catch {
    /* fallback */
  }
  return `w-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

const DEVICE_KEY = "yosra-device-id";
function deviceId(): string {
  try {
    const prev = localStorage.getItem(DEVICE_KEY);
    if (prev) return prev;
    const id = randomId();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return randomId();
  }
}

/**
 * کلاینت WebSocket با reconnect خودکار.
 * پیام‌های نامعتبر نادیده گرفته می‌شوند؛ خطا هیچ‌وقت throw نمی‌کند.
 */
export class RtClient {
  readonly id: string;
  private cfg: RtConfig;
  private cb: RtCallbacks;
  private factory: SocketFactory | null;
  private ws: WebSocket | null = null;
  private socketId = "";
  private subscribed = false;
  private closed = false;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  // خبری که هنگام قطع بودن سوکت داده شده — به محض وصل شدن ارسال می‌شود
  private pendingNotify = false;

  constructor(cfg: RtConfig, cb: RtCallbacks, factory: SocketFactory | null = null) {
    this.cfg = cfg;
    this.cb = cb;
    this.factory = factory;
    this.id = deviceId();
  }

  get url(): string {
    return `wss://ws-${this.cfg.region}.apinator.io/app/${this.cfg.key}`;
  }

  get isSubscribed(): boolean {
    return this.subscribed;
  }

  connect(): void {
    this.closed = false;
    this.open();
  }

  disconnect(): void {
    this.closed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
    this.subscribed = false;
  }

  private makeSocket(url: string): WebSocket | null {
    try {
      const f = this.factory ?? testFactory ?? ((u: string) => new WebSocket(u));
      return f(url);
    } catch {
      return null;
    }
  }

  private open(): void {
    if (this.closed) return;
    const ws = this.makeSocket(this.url);
    if (!ws) {
      this.schedule();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
    };
    ws.onmessage = (ev: { data: unknown }) => {
      void this.handle(String(ev.data));
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      this.socketId = "";
      this.subscribed = false;
      try {
        this.cb.onStatus?.(false);
      } catch {
        /* ignore */
      }
      this.schedule();
    };
  }

  private schedule(): void {
    if (this.closed) return;
    if (this.timer) clearTimeout(this.timer);
    const wait = Math.min(1000 * 2 ** this.retry, 30000);
    this.retry += 1;
    this.timer = setTimeout(() => this.open(), wait);
  }

  private send(s: string): void {
    try {
      if (this.ws && this.ws.readyState === 1) this.ws.send(s);
    } catch {
      /* best-effort */
    }
  }

  private async handle(raw: string): Promise<void> {
    const m = parseMessage(raw);
    if (!m) return;
    if (m.event === "realtime:connection_established") {
      const d = parseData<{ socket_id?: unknown }>(m.data);
      if (!d || typeof d.socket_id !== "string" || !d.socket_id) return;
      this.socketId = d.socket_id;
      try {
        const auth = await channelAuth(this.cfg, d.socket_id, RT_CHANNEL);
        this.send(buildSubscribe(RT_CHANNEL, auth));
      } catch {
        /* ignore */
      }
    } else if (m.event === "realtime:subscription_succeeded" && m.channel === RT_CHANNEL) {
      this.subscribed = true;
      try {
        this.cb.onStatus?.(true);
      } catch {
        /* ignore */
      }
      // خبرِ جامانده در دوران قطعی همین حالا ارسال شود
      if (this.pendingNotify) {
        this.pendingNotify = false;
        this.notify();
      }
    } else if (m.event === "realtime:subscription_error") {
      try {
        console.warn("[rt] subscribe error", m.data);
      } catch {
        /* ignore */
      }
      // auth رد شد → اتصال مجدد با backoff (شاید سکرت تازه شده باشد)
      try {
        this.ws?.close();
      } catch {
        /* ignore */
      }
    } else if (m.event === "realtime:ping") {
      this.send(buildPong());
    } else if (m.event === RT_EVENT && m.channel === RT_CHANNEL) {
      const p = parseData<{ from?: unknown; at?: unknown }>(m.data);
      if (!p || p.from === this.id) return;
      try {
        this.cb.onRemoteUpdate({ from: String(p.from ?? ""), at: Number(p.at ?? 0) });
      } catch {
        /* ignore */
      }
    }
  }

  /** اطلاع به طرف دیگر که دیتابیس آنلاین را عوض کردیم (best-effort، بلاک نمی‌کند) */
  notify(): void {
    if (!this.subscribed) {
      this.pendingNotify = true; // به محض سابسکرایب ارسال می‌شود
      return;
    }
    const ok = (() => {
      try {
        this.send(buildClientEvent(RT_CHANNEL, RT_EVENT, { from: this.id, at: Date.now() }));
        return this.ws?.readyState === 1;
      } catch {
        return false;
      }
    })();
    if (!ok) this.pendingNotify = true;
  }
}
