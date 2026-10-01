"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CopyKey, Lang } from "@/lib/copy";
import type { ErrorCode, Order, PayWith, Payout, Quote } from "@/lib/engine";

export type Signal = "good" | "weak" | "off";
export type Surface = "android" | "ussd";

export type Held = {
  idempotencyKey: string;
  payWith: PayWith;
  quote: Quote;
};

const HELD_KEY = "mukuru-home-held-v1";
const LANG_KEY = "mukuru-home-lang";
const ICONS_KEY = "mukuru-home-icons";

export type Fx = { rateMilli: number; midMilli: number };

type SubmitResult =
  | { ok: true; order: Order }
  | { ok: false; error: ErrorCode | "offline" | "busy"; held?: boolean };

type CorridorValue = {
  signal: Signal;
  setSignal: (signal: Signal) => void;
  surface: Surface;
  setSurface: (surface: Surface) => void;
  loading: boolean;
  loadError: boolean;
  busy: boolean;
  balanceZarCents: number;
  orders: Order[];
  openQuote: Quote | null;
  held: Held | null;
  notice: CopyKey | null;
  lang: Lang;
  setLang: (lang: Lang) => void;
  icons: boolean;
  setIcons: (icons: boolean) => void;
  fx: Fx | null;
  demoId: number;
  clearNotice: () => void;
  requestQuote: (amountZarCents: number, payout: Payout) => Promise<Quote | null>;
  submitOrder: (quote: Quote, pin: string, payWith: PayWith) => Promise<SubmitResult>;
  releaseHeld: () => Promise<void>;
  markPaid: (ref: string) => Promise<boolean>;
  markCollected: (ref: string) => Promise<boolean>;
  resetDemo: () => Promise<void>;
};

const CorridorContext = createContext<CorridorValue | null>(null);

export function useCorridor() {
  const value = useContext(CorridorContext);
  if (!value) throw new Error("useCorridor must be used inside the desk");
  return value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function CorridorProvider({ children }: { children: ReactNode }) {
  const [signal, setSignalState] = useState<Signal>("good");
  const [surface, setSurface] = useState<Surface>("android");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [balanceZarCents, setBalance] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [openQuote, setOpenQuote] = useState<Quote | null>(null);
  const [held, setHeld] = useState<Held | null>(null);
  const [notice, setNotice] = useState<CopyKey | null>(null);
  const [lang, setLangState] = useState<Lang>("en");
  const [icons, setIconsState] = useState(false);
  const [fx, setFx] = useState<Fx | null>(null);
  const [demoId, setDemoId] = useState(0);

  const signalRef = useRef(signal);
  const heldRef = useRef(held);
  const ordersRef = useRef(orders);
  const pinRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  signalRef.current = signal;
  heldRef.current = held;
  ordersRef.current = orders;

  function setSignal(next: Signal) {
    setSignalState(next);
    signalRef.current = next;
  }

  function setLang(next: Lang) {
    setLangState(next);
    localStorage.setItem(LANG_KEY, next);
    void fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: next }),
    });
  }

  function setIcons(next: boolean) {
    setIconsState(next);
    localStorage.setItem(ICONS_KEY, next ? "1" : "0");
  }

  function rememberHeld(next: Held | null) {
    setHeld(next);
    heldRef.current = next;
    if (next) localStorage.setItem(HELD_KEY, JSON.stringify(next));
    else localStorage.removeItem(HELD_KEY);
  }

  function applyPayload(payload: {
    balanceZarCents: number;
    orders: Order[];
    openQuote: Quote | null;
    fx?: Fx | null;
  }) {
    setBalance(payload.balanceZarCents);
    setOrders(payload.orders);
    ordersRef.current = payload.orders;
    setOpenQuote(payload.openQuote);
    if (payload.fx) setFx(payload.fx);
  }

  async function refresh() {
    try {
      const response = await fetch("/api/corridor", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/";
        return;
      }
      if (!response.ok) throw new Error("load");
      const payload = await response.json();
      applyPayload(payload);
      if (payload.account?.lang === "en" || payload.account?.lang === "sn") {
        setLangState(payload.account.lang);
      }
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  function radio(): Signal {
    return signalRef.current;
  }

  async function netFetch(input: string, init?: RequestInit) {
    if (radio() === "off") throw new Error("offline");
    if (radio() === "weak") {
      await sleep(2600);
      if (radio() === "off") throw new Error("offline");
    }
    return fetch(input, init);
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HELD_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Held;
        if (parsed?.quote?.id && parsed.idempotencyKey) {
          setHeld(parsed);
          heldRef.current = parsed;
        }
      }
    } catch {
      localStorage.removeItem(HELD_KEY);
    }
    const storedLang = localStorage.getItem(LANG_KEY);
    if (storedLang === "en" || storedLang === "sn") setLangState(storedLang);
    if (localStorage.getItem(ICONS_KEY) === "1") setIconsState(true);
    void refresh();
    // Load once. refresh closes over the latest setters and must not re-run every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let timer = 0;
    let stopped = false;
    async function tick() {
      if (stopped) return;
      if (signalRef.current !== "off") {
        try {
          const response = await fetch("/api/corridor", { cache: "no-store" });
          if (response.status === 401) {
            window.location.href = "/";
            return;
          }
          if (response.ok) {
            const payload = await response.json();
            applyPayload(payload);
            setLoadError(false);
          }
        } catch {
          setLoadError(true);
        }
      }
      const moving = ordersRef.current.some(
        (order) => order.status === "sent" || order.status === "in_transit",
      );
      timer = window.setTimeout(tick, moving ? 2000 : 8000);
    }
    timer = window.setTimeout(tick, 8000);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (signal === "off" || !heldRef.current || !pinRef.current || busyRef.current) return;
    void submitOrder(heldRef.current.quote, pinRef.current, heldRef.current.payWith);
    // submitOrder is stable enough for this demo; the signal edge is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal]);

  async function requestQuote(amountZarCents: number, payout: Payout) {
    setNotice(null);
    if (signalRef.current === "off") {
      setNotice("noSignalLock");
      return null;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const response = await netFetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountZarCents, payout }),
      });
      const body = await response.json();
      if (!response.ok) {
        setNotice("badAmount");
        return null;
      }
      setOpenQuote(body.quote);
      setNotice(signalRef.current === "weak" ? "rateLockedSlow" : null);
      return body.quote as Quote;
    } catch {
      setNotice("signalDropped");
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function submitOrder(quote: Quote, pin: string, payWith: PayWith): Promise<SubmitResult> {
    if (busyRef.current) return { ok: false, error: "busy" };
    const existing = heldRef.current?.quote.id === quote.id ? heldRef.current.idempotencyKey : crypto.randomUUID();
    const nextHeld: Held = { idempotencyKey: existing, payWith, quote };
    rememberHeld(nextHeld);
    pinRef.current = pin;
    busyRef.current = true;
    setBusy(true);
    setNotice(signalRef.current === "weak" ? "thinSignal" : null);
    try {
      const response = await netFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          pin,
          idempotencyKey: nextHeld.idempotencyKey,
          payWith,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        if (body.error === "bad_pin") {
          pinRef.current = null;
          setNotice("badPin");
          return { ok: false, error: "bad_pin" };
        }
        rememberHeld(null);
        pinRef.current = null;
        if (body.error === "quote_expired") {
          setOpenQuote(null);
          setNotice("quoteExpired");
        } else if (body.error === "insufficient") {
          setNotice("insufficient");
        } else if (body.error === "quote_used") {
          setOpenQuote(null);
          setNotice("quoteUsed");
          await refresh();
        } else {
          setNotice("sendFailed");
        }
        return { ok: false, error: body.error ?? "bad_request" };
      }
      rememberHeld(null);
      pinRef.current = null;
      setOpenQuote(null);
      setBalance(body.balanceZarCents);
      setOrders((current) => [body.order, ...current.filter((order) => order.ref !== body.order.ref)]);
      setNotice(null);
      return { ok: true, order: body.order };
    } catch {
      setNotice("heldNotice");
      return { ok: false, error: "offline", held: true };
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function releaseHeld() {
    rememberHeld(null);
    pinRef.current = null;
    setNotice(null);
    await refresh();
  }

  async function markPaid(ref: string) {
    const response = await fetch(`/api/orders/${ref}/pay`, { method: "POST" });
    if (!response.ok) return false;
    const body = await response.json();
    setOrders((current) => current.map((order) => (order.ref === ref ? body.order : order)));
    return true;
  }

  async function markCollected(ref: string) {
    const response = await fetch(`/api/orders/${ref}/collect`, { method: "POST" });
    if (!response.ok) return false;
    const body = await response.json();
    setOrders((current) => current.map((order) => (order.ref === ref ? body.order : order)));
    return true;
  }

  async function resetDemo() {
    rememberHeld(null);
    pinRef.current = null;
    setNotice(null);
    setSurface("android");
    setSignal("good");
    const response = await fetch("/api/reset", { method: "POST" });
    if (!response.ok) {
      setLoadError(true);
      return;
    }
    const payload = await response.json();
    applyPayload({ ...payload, openQuote: null });
    setLoadError(false);
    setLoading(false);
    setDemoId((value) => value + 1);
  }

  const value = useMemo<CorridorValue>(
    () => ({
      signal,
      setSignal,
      surface,
      setSurface,
      loading,
      loadError,
      busy,
      balanceZarCents,
      orders,
      openQuote,
      held,
      notice,
      lang,
      setLang,
      icons,
      setIcons,
      fx,
      demoId,
      clearNotice: () => setNotice(null),
      requestQuote,
      submitOrder,
      releaseHeld,
      markPaid,
      markCollected,
      resetDemo,
    }),
    // The actions close over refs deliberately. State listed here refreshes the snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signal, surface, loading, loadError, busy, balanceZarCents, orders, openQuote, held, notice, lang, icons, fx, demoId],
  );

  return <CorridorContext.Provider value={value}>{children}</CorridorContext.Provider>;
}
