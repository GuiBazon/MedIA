import React, { useEffect, useMemo, useState } from "react";
import { useClinic } from "../store";
import {
  Agendamento, ESPECIALIDADES, HOJE, MESES_CURTO, addDaysISO, fmtDataLonga, fmtDataMedia, fromISO, isBusyExterno,
  pad, slotsDoDia,
} from "../data";
import { Reveal, SectionHead } from "./ui";
import { IcCheck, IcChevL, IcChevR, IcClock, IcEdit, IcX, IcAlert } from "./icons";

export default function DoctorPanel() {
  const { state, dispatch } = useClinic();
  const [medicoId, setMedicoId] = useState(1);
  const [weekOff, setWeekOff] = useState(0);
  const [view, setView] = useState<"semana" | "dia">("semana");
  const [diaISO, setDiaISO] = useState(HOJE);
  const [sel, setSel] = useState<Agendamento | null>(null);
  const [notas, setNotas] = useState("");

  const med = state.medicos.find((m) => m.id === medicoId)!;

  const segunda = useMemo(() => {
    const d = fromISO(HOJE);
    const dow = (d.getDay() + 6) % 7;
    return addDaysISO(HOJE, -dow + weekOff * 7);
  }, [weekOff]);

  const dias = useMemo(() => Array.from({ length: 6 }, (_, i) => addDaysISO(segunda, i)), [segunda]);

  useEffect(() => {
    if (sel) {
      const atual = state.ags.find((a) => a.id === sel.id);
      if (atual) setSel(atual);
    }
  }, [state.ags]); // eslint-disable-line react-hooks/exhaustive-deps

  const doDia = (iso: string) => {
    const slots = slotsDoDia(med, iso);
    const ags = state.ags.filter((a) => a.medicoId === med.id && a.dataISO === iso && a.status !== "CANCELADO");
    return { slots, ags };
  };

  const statSemana = useMemo(() => {
    let total = 0, ocup = 0;
    for (const iso of dias) {
      const { slots, ags } = doDia(iso);
      total += slots.length;
      ocup += slots.filter((h) => ags.some((a) => a.hora === h) || isBusyExterno(med.id, iso, h, state.freed, state.extra)).length;
    }
    return { total, ocup };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias, med, state.ags, state.freed, state.extra]);

  const hojeStats = useMemo(() => {
    const { slots, ags } = doDia(HOJE);
    const ocup = slots.filter((h) => ags.some((a) => a.hora === h) || isBusyExterno(med.id, HOJE, h, state.freed, state.extra)).length;
    return { livres: slots.length - ocup, ags: ags.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [med, state.ags, state.freed, state.extra]);

  return (
    <section id="medico" className="relative bg-deep py-20 text-paper">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-jade/60 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead dark num="02" kicker="Painel do médico"
          title={<>A agenda do consultório,<br />sem planilha e sem susto.</>}
          lead="Cada reserva feita no app — pela interface ou pela Lia — aparece aqui no mesmo segundo. O médico abre o prontuário, registra a evolução e bate o status da consulta." />

        {/* controles */}
        <Reveal delay={100}>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-xl border border-linedark bg-pine px-3 py-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-mintdark">médico</span>
              <select value={medicoId} onChange={(e) => setMedicoId(+e.target.value)}
                className="bg-transparent font-display text-[13.5px] font-bold text-paper outline-none [&>option]:text-ink">
                {state.medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-1.5 rounded-xl border border-linedark bg-pine p-1">
              <button onClick={() => setWeekOff((v) => v - 1)} aria-label="Semana anterior" className="grid h-8 w-8 place-items-center rounded-lg text-mint/70 hover:bg-paper/10 hover:text-paper"><IcChevL className="h-4 w-4" /></button>
              <span className="px-1 font-mono text-[11.5px] text-mint">{fmtDataMedia(dias[0])} — {fmtDataMedia(dias[5])}</span>
              <button onClick={() => setWeekOff((v) => v + 1)} aria-label="Próxima semana" className="grid h-8 w-8 place-items-center rounded-lg text-mint/70 hover:bg-paper/10 hover:text-paper"><IcChevR className="h-4 w-4" /></button>
            </div>
            <div className="flex rounded-xl border border-linedark bg-pine p-1">
              {(["semana", "dia"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={`rounded-lg px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide transition-colors ${view === v ? "bg-jade text-paper" : "text-mint/60 hover:text-paper"}`}>
                  {v === "semana" ? "Semana" : "Dia"}
                </button>
              ))}
            </div>
            <div className="ml-auto hidden items-center gap-4 font-mono text-[11px] text-mint/70 lg:flex">
              <span>hoje: <strong className="text-paper">{hojeStats.ags} consultas</strong> · <strong className="text-jade">{hojeStats.livres} livres</strong></span>
              <span>semana: <strong className="text-amber">{statSemana.total ? Math.round((statSemana.ocup / statSemana.total) * 100) : 0}%</strong> ocupada</span>
            </div>
          </div>
        </Reveal>

        <Reveal delay={180}>
          <div className="relative mt-6">
            {view === "semana" ? (
              <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-2">
                <div className="grid min-w-[860px] grid-cols-6 gap-2.5">
                  {dias.map((iso) => {
                    const { slots, ags } = doDia(iso);
                    const ocup = slots.filter((h) => ags.some((a) => a.hora === h) || isBusyExterno(med.id, iso, h, state.freed, state.extra)).length;
                    const d = fromISO(iso);
                    const hoje = iso === HOJE;
                    return (
                      <button key={iso} onClick={() => { setDiaISO(iso); setView("dia"); }}
                        className={`group rounded-2xl border p-3 text-left transition-all hover:-translate-y-1 hover:border-jade/70 ${hoje ? "border-jade/70 bg-pine shadow-lg shadow-jade/10" : "border-linedark bg-pine/50 hover:bg-pine"}`}>
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-[10px] uppercase tracking-widest text-mintdark">
                            {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()]} {d.getDate()} {MESES_CURTO[d.getMonth()]}
                          </p>
                          {hoje && <span className="rounded-full bg-jade px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase text-paper">hoje</span>}
                        </div>
                        <div className="mt-2.5 space-y-1.5">
                          {slots.length === 0 && <p className="rounded-lg border border-dashed border-linedark px-2 py-2 text-center font-mono text-[10px] text-mint/40">sem atendimento</p>}
                          {ags.sort((a, b) => a.hora.localeCompare(b.hora)).map((a) => (
                            <div key={a.id}
                              className={`rounded-lg px-2 py-1.5 transition-colors ${a.status === "CONCLUIDO" ? "bg-jade/15 text-mint/70" : a.status === "NAO_COMPARECEU" ? "bg-coral/20 text-coralsoft line-through" : "bg-paper/10 text-paper group-hover:bg-paper/15"}`}>
                              <p className="font-mono text-[10px] font-bold text-jade">{a.hora}</p>
                              <p className="truncate text-[11px] font-bold leading-tight">{a.paciente}</p>
                            </div>
                          ))}
                          {slots.filter((h) => !ags.some((a) => a.hora === h) && isBusyExterno(med.id, iso, h, state.freed, state.extra)).slice(0, 2).map((h) => (
                            <div key={h} className="rounded-lg bg-paper/5 px-2 py-1.5">
                              <p className="font-mono text-[10px] font-bold text-mint/40">{h}</p>
                              <p className="truncate text-[11px] text-mint/45">convênio</p>
                            </div>
                          ))}
                        </div>
                        {slots.length > 0 && (
                          <p className="mt-2.5 border-t border-linedark pt-2 font-mono text-[9.5px] text-mint/55">
                            {slots.length - ocup} horários livres · {slots.length} no dia
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
                <div className="no-scrollbar flex gap-2 overflow-x-auto lg:flex-col">
                  {dias.map((iso) => {
                    const d = fromISO(iso);
                    return (
                      <button key={iso} onClick={() => setDiaISO(iso)}
                        className={`shrink-0 rounded-xl border px-3.5 py-2.5 text-left font-mono text-[11.5px] transition-colors ${diaISO === iso ? "border-jade bg-jade/15 text-paper" : "border-linedark bg-pine/50 text-mint/60 hover:text-paper"}`}>
                        {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()]} · {pad(d.getDate())}/{pad(d.getMonth() + 1)}
                      </button>
                    );
                  })}
                </div>
                <div className="rounded-2xl border border-linedark bg-pine/50 p-4">
                  <p className="font-display text-[15px] font-bold capitalize">{fmtDataLonga(diaISO)}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-mintdark">{med.nome} · {ESPECIALIDADES.find((e) => e.id === med.espId)?.nome}</p>
                  <div className="mt-3.5 grid gap-1.5 sm:grid-cols-2">
                    {slotsDoDia(med, diaISO).map((h) => {
                      const ag = state.ags.find((a) => a.medicoId === med.id && a.dataISO === diaISO && a.hora === h && a.status !== "CANCELADO");
                      const ext = !ag && isBusyExterno(med.id, diaISO, h, state.freed, state.extra);
                      return ag ? (
                        <button key={h} onClick={() => { setSel(ag); setNotas(ag.anotacoes ?? ""); }}
                          className={`flex items-center gap-3 rounded-xl border border-linedark bg-paper/8 px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-jade/60 hover:bg-paper/15`}>
                          <span className="font-mono text-[12.5px] font-bold text-jade">{h}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] font-bold">{ag.paciente}</span>
                            <span className="font-mono text-[9px] uppercase tracking-wide text-mint/50">{ag.tipo === "CONVENIO" ? "convênio" : "particular"} · {ag.protocolo}</span>
                          </span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[8.5px] font-bold uppercase ${ag.status === "CONCLUIDO" ? "bg-jade/25 text-mint" : ag.status === "NAO_COMPARECEU" ? "bg-coral/25 text-coralsoft" : "bg-paper/15 text-mint/80"}`}>
                            {ag.status === "CONCLUIDO" ? "concluída" : ag.status === "NAO_COMPARECEU" ? "faltou" : "agendada"}
                          </span>
                          <IcEdit className="h-3.5 w-3.5 shrink-0 text-mint/40" />
                        </button>
                      ) : (
                        <div key={h} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${ext ? "border-linedark bg-paper/5" : "border-dashed border-linedark"}`}>
                          <span className="font-mono text-[12.5px] font-bold text-mint/45">{h}</span>
                          <span className="flex-1" />
                          {ext ? (
                            <span className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase text-mint/40"><IcClock className="h-3.5 w-3.5" /> ocupado · convênio</span>
                          ) : (
                            <span className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase text-jade"><IcCheck className="h-3.5 w-3.5" /> livre no app</span>
                          )}
                        </div>
                      );
                    })}
                    {slotsDoDia(med, diaISO).length === 0 && (
                      <p className="rounded-xl border border-dashed border-linedark px-4 py-8 text-center font-mono text-[11px] text-mint/45 sm:col-span-2">Sem jornada configurada neste dia.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* prontuário */}
            {sel && (
              <div className="absolute inset-y-0 right-0 z-30 w-full max-w-[360px]">
                <div className="pop-in flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper text-ink shadow-2xl">
                  <div className="flex items-center justify-between border-b border-line bg-cream/70 px-4 py-3">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink/45">prontuário simplificado</p>
                      <h3 className="font-display text-[15.5px] font-extrabold leading-tight">{sel.paciente}</h3>
                    </div>
                    <button onClick={() => setSel(null)} aria-label="Fechar prontuário" className="grid h-8 w-8 place-items-center rounded-full border border-line hover:bg-cream"><IcX className="h-4 w-4" /></button>
                  </div>
                  <div className="thin-scroll flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-2 gap-2 text-[12px]">
                      <div className="rounded-xl bg-cream/70 p-2.5"><p className="font-mono text-[8.5px] uppercase text-ink/40">quando</p><p className="font-bold capitalize">{fmtDataMedia(sel.dataISO)} · {sel.hora}</p></div>
                      <div className="rounded-xl bg-cream/70 p-2.5"><p className="font-mono text-[8.5px] uppercase text-ink/40">atendimento</p><p className="font-bold">{sel.tipo === "CONVENIO" ? "Convênio" : "Particular"}</p></div>
                    </div>
                    <label className="mt-4 block font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink/45">Evolução da consulta</label>
                    <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={6}
                      placeholder="Queixas, exame físico, conduta, prescrição…"
                      className="mt-1.5 w-full resize-none rounded-xl border border-line bg-paper p-3 text-[13px] leading-relaxed outline-none focus:border-jade" />
                    <button onClick={() => { dispatch({ t: "saveNotas", id: sel.id, texto: notas }); dispatch({ t: "toast", texto: "Prontuário salvo ✓" }); }}
                      className="mt-2 w-full rounded-xl bg-pine py-2.5 text-[13px] font-bold text-paper transition-colors hover:bg-jade">Salvar prontuário</button>
                    <p className="mt-4 font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink/45">Status da consulta</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button onClick={() => { dispatch({ t: "setStatusAg", id: sel.id, status: "CONCLUIDO" }); dispatch({ t: "toast", texto: "Consulta concluída" }); }}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border-2 py-2.5 text-[12px] font-bold transition-colors ${sel.status === "CONCLUIDO" ? "border-jade bg-jadesoft text-jadedark" : "border-line text-ink/65 hover:border-jade/60"}`}>
                        <IcCheck className="h-4 w-4" /> Concluir
                      </button>
                      <button onClick={() => { dispatch({ t: "setStatusAg", id: sel.id, status: "NAO_COMPARECEU" }); dispatch({ t: "toast", texto: "Falta registrada — alimenta o índice de no-show", tom: "info" }); }}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border-2 py-2.5 text-[12px] font-bold transition-colors ${sel.status === "NAO_COMPARECEU" ? "border-coral bg-coralsoft text-coral" : "border-line text-ink/65 hover:border-coral/60"}`}>
                        <IcAlert className="h-4 w-4" /> Não veio
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Reveal>

        <Reveal delay={240}>
          <p className="mt-5 flex items-center gap-2 font-mono text-[10.5px] text-mint/50">
            <span className="pulse-dot h-2 w-2 rounded-full bg-jade" />
            Reservas feitas agora no telefone acima entram nesta agenda em tempo real — experimente marcar com a Lia e volte aqui.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
