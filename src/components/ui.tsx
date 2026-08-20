import React, { useEffect, useRef, useState } from "react";
import { hashStr } from "../data";

/* ---------- prefers-reduced-motion ---------- */
export const usePRM = () => {
  const [prm, setPrm] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrm(mq.matches);
    const fn = () => setPrm(mq.matches);
    mq.addEventListener?.("change", fn);
    return () => mq.removeEventListener?.("change", fn);
  }, []);
  return prm;
};

/* ---------- scroll reveal ---------- */
export const Reveal = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("is-in"), ob.unobserve(e.target))),
      { threshold: 0.12 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return (
    <div ref={ref} className={`rv ${className}`} style={{ ["--rvd" as string]: `${delay}ms` }}>
      {children}
    </div>
  );
};

/* ---------- contador animado ---------- */
export const CountUp = ({ to, decimals = 0, prefix = "", suffix = "", dur = 1200 }: { to: number; decimals?: number; prefix?: string; suffix?: string; dur?: number }) => {
  const prm = usePRM();
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(prm ? to : 0);
  useEffect(() => {
    if (prm) { setV(to); return; }
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const ob = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      ob.disconnect();
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / dur);
        setV(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    ob.observe(el);
    return () => { ob.disconnect(); cancelAnimationFrame(raf); };
  }, [to, prm, dur]);
  return <span ref={ref}>{prefix}{v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
};

/* ---------- cabeçalho de seção ---------- */
export const SectionHead = ({ num, kicker, title, lead, dark = false }: { num: string; kicker: string; title: React.ReactNode; lead?: string; dark?: boolean }) => (
  <Reveal className="max-w-3xl">
    <p className={`font-mono text-[11px] sm:text-xs tracking-[0.28em] uppercase ${dark ? "text-mintdark" : "text-jade"}`}>[ {num} · {kicker} ]</p>
    <h2 className={`font-display font-extrabold tracking-tight mt-4 text-3xl sm:text-5xl leading-[1.04] ${dark ? "text-paper" : "text-ink"}`}>{title}</h2>
    {lead && <p className={`mt-5 text-base sm:text-lg leading-relaxed ${dark ? "text-mint/75" : "text-ink/70"}`}>{lead}</p>}
  </Reveal>
);

/* ---------- linha de ECG ---------- */
export const Ecg = ({ className = "", stroke = "#0c8a64" }: { className?: string; stroke?: string }) => {
  const seg = "M0 20 H36 L44 20 50 7 56 33 62 20 H104 L110 20 114 12 118 26 122 20 H160";
  return (
    <svg viewBox="0 0 640 40" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d={`${seg} ${seg.replace(/M0 20/g, "M160 20").replace("M0 20", "")}`} opacity="0.16" stroke={stroke} strokeWidth="1.6" fill="none" transform="translate(0 0)" />
      <path d={seg} opacity="0.16" stroke={stroke} strokeWidth="1.6" fill="none" transform="translate(160 0)" />
      <path d={seg} opacity="0.16" stroke={stroke} strokeWidth="1.6" fill="none" transform="translate(320 0)" />
      <path d={seg} opacity="0.16" stroke={stroke} strokeWidth="1.6" fill="none" transform="translate(480 0)" />
      <path d={seg} pathLength={1} className="ecg-live" stroke={stroke} strokeWidth="2" fill="none" />
      <path d={seg} pathLength={1} className="ecg-live" stroke={stroke} strokeWidth="2" fill="none" transform="translate(160 0)" style={{ animationDelay: "-0.85s" }} />
      <path d={seg} pathLength={1} className="ecg-live" stroke={stroke} strokeWidth="2" fill="none" transform="translate(320 0)" style={{ animationDelay: "-1.7s" }} />
      <path d={seg} pathLength={1} className="ecg-live" stroke={stroke} strokeWidth="2" fill="none" transform="translate(480 0)" style={{ animationDelay: "-2.55s" }} />
    </svg>
  );
};

/* ---------- QR falso (comprovante) ---------- */
export const FakeQR = ({ seed, className = "" }: { seed: string; className?: string }) => {
  const n = 13;
  const cells: boolean[] = [];
  for (let i = 0; i < n * n; i++) cells.push((hashStr(seed + i) & 3) > 1);
  const corner = (x: number, y: number) => (
    <g key={`${x}${y}`}>
      <rect x={x} y={y} width="3" height="3" fill="none" stroke="#0f231d" strokeWidth="0.55" />
      <rect x={x + 1} y={y + 1} width="1" height="1" fill="#0f231d" />
    </g>
  );
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} className={className} aria-hidden="true">
      <rect x="-1" y="-1" width={n + 2} height={n + 2} fill="#f3f7f3" />
      {cells.map((on, i) => {
        const x = i % n, y = Math.floor(i / n);
        const inCorner = (x < 4 && y < 4) || (x > n - 5 && y < 4) || (x < 4 && y > n - 5);
        return on && !inCorner ? <rect key={i} x={x} y={y} width="0.92" height="0.92" fill="#0f231d" /> : null;
      })}
      {corner(0, 0)}{corner(n - 3, 0)}{corner(0, n - 3)}
    </svg>
  );
};

/* ---------- letreiro de disponibilidade ---------- */
export const Ticker = ({ items }: { items: string[] }) => (
  <div className="marquee-mask overflow-hidden">
    <div className="marquee-inner flex w-max items-center gap-8 py-2">
      {[0, 1].map((k) => (
        <div key={k} className="flex items-center gap-8" aria-hidden={k === 1}>
          {items.map((it, i) => (
            <span key={i} className="flex items-center gap-2 font-mono text-xs text-ink/60 whitespace-nowrap">
              <span className={`h-1.5 w-1.5 rounded-full ${it.includes("vago") ? "bg-jade" : it.includes("fila") ? "bg-amber" : "bg-coral/70"}`} />
              {it}
            </span>
          ))}
        </div>
      ))}
    </div>
  </div>
);

/* ---------- destaque sublinhado ---------- */
export const Underline = ({ children, color = "#0c8a64" }: { children: React.ReactNode; color?: string }) => (
  <span className="relative inline-block whitespace-nowrap">
    {children}
    <svg className="absolute left-0 -bottom-[0.16em] w-full" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
      <path d="M2 5.5 C 25 2, 60 2.5, 98 5" stroke={color} strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.85" />
    </svg>
  </span>
);
