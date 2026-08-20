import React, { useMemo } from "react";
import { useClinic } from "../store";
import { HOJE, isBusyExterno, slotsDoDia } from "../data";
import { CountUp, Ecg, Reveal, Ticker, Underline } from "./ui";
import PhoneApp from "./PhoneApp";
import { IcCheck, IcChip, IcPhone, IcQueue, IcShield } from "./icons";

export default function Hero() {
  const { state } = useClinic();

  const stats = useMemo(() => {
    let total = 0, ocupados = 0;
    for (const med of state.medicos) {
      const slots = slotsDoDia(med, HOJE);
      total += slots.length;
      ocupados += slots.filter(
        (h) => isBusyExterno(med.id, HOJE, h, state.freed, state.extra) ||
          state.ags.some((a) => a.medicoId === med.id && a.dataISO === HOJE && a.hora === h && a.status !== "CANCELADO"),
      ).length;
    }
    const filaAtiva = state.fila.filter((f) => f.status === "AGUARDANDO" || f.status === "NOTIFICADO").length;
    return { ocup: total ? Math.round((ocupados / total) * 100) : 0, ocupados, filaAtiva };
  }, [state.medicos, state.ags, state.freed, state.extra, state.fila]);

  const tickerItems = useMemo(() => {
    const items: string[] = [];
    for (const med of state.medicos) {
      const curto = med.nome.replace("Dra. ", "").replace("Dr. ", "").split(" ").slice(0, 2).join(" ");
      const slots = slotsDoDia(med, HOJE).slice(0, 4);
      slots.forEach((h, i) => {
        const busy = isBusyExterno(med.id, HOJE, h, state.freed, state.extra) ||
          state.ags.some((a) => a.medicoId === med.id && a.dataISO === HOJE && a.hora === h && a.status !== "CANCELADO");
        items.push(`${h} ${curto} — ${busy ? (i % 3 === 2 ? "fila 2" : "ocupado") : "vago"}`);
      });
    }
    return items.slice(0, 18);
  }, [state.medicos, state.ags, state.freed, state.extra]);

  return (
    <section id="demo" className="relative overflow-hidden">
      <Ecg className="pointer-events-none absolute left-0 top-24 h-10 w-full opacity-60" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.04fr_0.96fr] lg:gap-6 lg:pt-14">
        {/* coluna narrativa */}
        <div className="relative z-10">
          <Reveal>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-pine px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-mint">SENAI · projeto integrador</span>
              <span className="rounded-full border border-jade/40 bg-jadesoft px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-jadedark">demo 100% funcional ↓</span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-6 font-display text-[42px] font-extrabold leading-[0.98] tracking-tight sm:text-6xl xl:text-[72px]">
              A fila da clínica<br />
              <Underline>anda sozinha.</Underline>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink/70">
              O <strong className="text-ink">FácilMed</strong> substitui a linha ocupada da recepção por uma
              <strong className="text-ink"> secretária virtual que roda na própria clínica</strong> (Ollama, custo zero de nuvem),
              preenche cancelamentos com a <strong className="text-ink">fila de espera inteligente</strong> e abre a porta da
              saúde digital para a terceira idade com o <strong className="text-ink">Modo Simplificado</strong>.
            </p>
          </Reveal>
          <Reveal delay={220}>
            <ul className="mt-6 space-y-2.5">
              {[
                { ic: <IcChip className="h-4 w-4" />, t: "IA local com function calling — agenda, cancela e remarca direto no banco" },
                { ic: <IcQueue className="h-4 w-4" />, t: "Fila de espera sequencial: só o 1º é notificado, com janela de 60 minutos" },
                { ic: <IcShield className="h-4 w-4" />, t: "Trava de 30 min para cancelamentos + bloqueio transacional de horários" },
              ].map((x, i) => (
                <li key={i} className="flex items-start gap-3 text-[14.5px] text-ink/80">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-jadesoft text-jade">{x.ic}</span>
                  <span>{x.t}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* vitais ao vivo */}
          <Reveal delay={300}>
            <div className="mt-9 flex flex-wrap items-stretch gap-x-8 gap-y-5">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/45">consultas hoje</p>
                <p className="font-display text-5xl font-extrabold leading-none text-pine"><CountUp to={stats.ocupados} /></p>
                <p className="mt-1 flex items-center gap-1 text-[11.5px] font-bold text-jade"><IcCheck className="h-3.5 w-3.5" /> sincronizadas com o app</p>
              </div>
              <div className="hidden w-px bg-line sm:block" />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/45">ocupação hoje</p>
                <p className="font-display text-3xl font-extrabold leading-tight"><CountUp to={stats.ocup} suffix="%" /></p>
                <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-jade transition-all duration-1000" style={{ width: `${stats.ocup}%` }} />
                </div>
              </div>
              <div className="hidden w-px bg-line sm:block" />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/45">resposta da IA</p>
                <p className="font-display text-3xl font-extrabold leading-tight"><CountUp to={1.1} decimals={1} suffix="s" /></p>
                <p className="mt-1 text-[11px] text-ink/55">no servidor da clínica</p>
              </div>
              <div className="hidden w-px bg-line sm:block" />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/45">na fila agora</p>
                <p className="font-display text-3xl font-extrabold leading-tight text-amber"><CountUp to={stats.filaAtiva} /></p>
                <p className="mt-1 text-[11px] text-ink/55">janela de 60 min ativa</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={380} className="mt-9 border-y border-line">
            <Ticker items={tickerItems} />
          </Reveal>
        </div>

        {/* telefone */}
        <div className="relative z-10">
          <Reveal delay={150} className="relative">
            <div className="deco float-a absolute -left-3 top-16 z-20 hidden rotate-[-4deg] rounded-xl border border-line bg-paper px-3 py-2 shadow-lg lg:block" style={{ ["--rot" as string]: "-4deg" }}>
              <p className="font-mono text-[10px] font-bold text-jade">✓ 09:30 confirmada pela Lia</p>
            </div>
            <div className="deco float-b absolute -right-2 top-44 z-20 hidden rotate-[3deg] rounded-xl border border-line bg-paper px-3 py-2 shadow-lg lg:block" style={{ ["--rot" as string]: "3deg" }}>
              <p className="font-mono text-[10px] font-bold text-amber">fila → 1º colocado notificado</p>
            </div>
            <div className="deco float-a absolute -left-6 bottom-28 z-20 hidden rotate-[2deg] rounded-xl border border-line bg-paper px-3 py-2 shadow-lg lg:block" style={{ ["--rot" as string]: "2deg" }}>
              <p className="font-mono text-[10px] font-bold text-coral">RN01 · trava de 30 min</p>
            </div>
            <PhoneApp />
            <p className="mx-auto mt-4 flex max-w-[350px] items-center justify-center gap-2 text-center font-mono text-[10.5px] text-ink/50">
              <IcPhone className="h-4 w-4 shrink-0 text-jade" />
              App do paciente — toque, navegue e converse com a secretária IA. Tudo aqui é real.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
