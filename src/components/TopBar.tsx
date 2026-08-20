import React, { useEffect, useState } from "react";
import { IcLogo } from "./icons";
import { pad } from "../data";

const LINKS = [
  ["#demo", "Demo ao vivo"],
  ["#medico", "Painel médico"],
  ["#gestao", "Gestão"],
  ["#regras", "Regras"],
  ["#pitch", "Pitch"],
] as const;

export default function TopBar() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5 sm:px-6">
        <a href="#demo" className="flex items-center gap-2.5">
          <IcLogo className="h-8 w-8" />
          <span className="font-display text-lg font-extrabold tracking-tight">
            Fácil<span className="text-jade">Med</span>
          </span>
        </a>
        <nav className="ml-6 hidden items-center gap-5 md:flex">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 transition-colors hover:text-jade">
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-jade/35 bg-jadesoft px-3 py-1 font-mono text-[10px] font-semibold text-jadedark sm:flex">
            <span className="pulse-dot h-2 w-2 rounded-full bg-jade" />
            ollama · llama3 · local
          </span>
          <span className="rounded-full border border-line bg-cream px-3 py-1 font-mono text-[11px] font-semibold tabular-nums text-ink/70">
            {pad(agora.getHours())}:{pad(agora.getMinutes())}<span className="text-ink/40">:{pad(agora.getSeconds())}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
