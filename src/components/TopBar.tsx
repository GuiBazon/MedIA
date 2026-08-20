import React, { useEffect, useState } from "react";
import { IcLogo } from "./icons";
import { pad } from "../data";

const LINKS = [
  ["#ia", "IA · Lia"],
  ["#demo", "App paciente"],
  ["#medico", "Médico"],
  ["#gestao", "Gestão"],
  ["#acessibilidade", "Acessibilidade"],
  ["#secretaria", "Secretaria"],
  ["#regras", "Regras"],
  ["#pitch", "Pitch"],
] as const;

export default function TopBar() {
  const [agora, setAgora] = useState(() => new Date());
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <a href="#demo" className="flex shrink-0 items-center gap-2.5" onClick={() => setMenu(false)}>
          <IcLogo className="h-8 w-8" />
          <span className="font-display text-lg font-extrabold tracking-tight">
            Fácil<span className="text-jade">Med</span>
          </span>
        </a>
        <nav className="ml-6 hidden items-center gap-4 lg:flex">
          {LINKS.map(([href, label], i) => (
            <a
              key={href}
              href={href}
              className={`font-mono text-[10.5px] uppercase tracking-[0.13em] transition-colors hover:text-jade ${i === 0 ? "rounded-full bg-jade px-2.5 py-1 font-bold text-paper hover:bg-jadedark hover:text-paper" : "text-ink/55"}`}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-jade/35 bg-jadesoft px-3 py-1 font-mono text-[10px] font-semibold text-jadedark sm:flex">
            <span className="pulse-dot h-2 w-2 rounded-full bg-jade" />
            ollama · local
          </span>
          <span className="hidden rounded-full border border-line bg-cream px-3 py-1 font-mono text-[11px] font-semibold tabular-nums text-ink/70 sm:block">
            {pad(agora.getHours())}:{pad(agora.getMinutes())}<span className="text-ink/40">:{pad(agora.getSeconds())}</span>
          </span>
          <button
            onClick={() => setMenu((v) => !v)}
            aria-label={menu ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menu}
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-cream text-ink/70 transition-colors hover:border-jade hover:text-jade lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {menu ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h10" />}
            </svg>
          </button>
        </div>
      </div>
      {menu && (
        <nav className="pop-in border-t border-line bg-paper px-4 pb-4 pt-2 lg:hidden">
          <div className="grid grid-cols-2 gap-2">
            {LINKS.map(([href, label]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenu(false)}
                className="rounded-xl border border-line bg-cream px-3.5 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink/70 transition-colors active:bg-jadesoft"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
