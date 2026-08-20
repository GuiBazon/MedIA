import React, { useMemo, useState } from "react";
import { useClinic } from "../store";
import {
  DIAS_SEMANA, DiaSemana, ESPECIALIDADES, HOJE, Jornada, MESES_CURTO, addDaysISO, diaSemanaDe, fmtDataMedia, fromISO,
  isBusyExterno, pad, slotsDoDia,
} from "../data";
import { CountUp, Reveal, SectionHead } from "./ui";
import { IcChevD, IcDb, IcPlus, IcQueue, IcX } from "./icons";

type JEd = Record<DiaSemana, { on: boolean; inicio: string; fim: string; duracao: number }>;
const initJ = (js: Jornada[]): JEd => {
  const r = {} as JEd;
  for (const d of DIAS_SEMANA) {
    const j = js.find((x) => x.dia === d);
    r[d] = j ? { on: true, inicio: j.inicio, fim: j.fim, duracao: j.duracao } : { on: false, inicio: "08:00", fim: "12:00", duracao: 30 };
  }
  return r;
};

export default function AdminPanel() {
  const { state, dispatch } = useClinic();
  const [aberto, setAberto] = useState<number | null>(null);
  const [eds, setEds] = useState<Record<number, JEd>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [novo, setNovo] = useState({ nome: "", crm: "", espId: 1, valor: 250 });

  /* KPIs */
  const kpis = useMemo(() => {
    let total = 0, ocup = 0, agHoje = 0;
    for (const med of state.medicos) {
      const slots = slotsDoDia(med, HOJE);
      total += slots.length;
      for (const h of slots) {
        const st = state.ags.some((a) => a.medicoId === med.id && a.dataISO === HOJE && a.hora === h && a.status !== "CANCELADO");
        if (st) agHoje++;
        if (st || isBusyExterno(med.id, HOJE, h, state.freed, state.extra)) ocup++;
      }
    }
    const fila = state.fila.filter((f) => f.status === "AGUARDANDO" || f.status === "NOTIFICADO").length;
    return { ocup: total ? Math.round((ocup / total) * 100) : 0, agHoje, fila };
  }, [state.medicos, state.ags, state.freed, state.extra, state.fila]);

  /* ocupação 7 dias */
  const semana = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const iso = addDaysISO(HOJE, i);
      let total = 0, ocup = 0;
      for (const med of state.medicos) {
        const slots = slotsDoDia(med, iso);
        total += slots.length;
        ocup += slots.filter((h) =>
          state.ags.some((a) => a.medicoId === med.id && a.dataISO === iso && a.hora === h && a.status !== "CANCELADO") ||
          isBusyExterno(med.id, iso, h, state.freed, state.extra)).length;
      }
      const d = fromISO(iso);
      return { iso, label: `${["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()]} ${d.getDate()} ${MESES_CURTO[d.getMonth()]}`, pct: total ? Math.round((ocup / total) * 100) : 0, dom: diaSemanaDe(iso) === null };
    });
  }, [state.medicos, state.ags, state.freed, state.extra]);

  /* fila */
  const grupos = useMemo(() => {
    const g = new Map<string, typeof state.fila>();
    for (const f of [...state.fila].sort((a, b) => a.dataISO.localeCompare(b.dataISO) || a.posicao - b.posicao)) {
      const k = `${f.medicoId}|${f.dataISO}`;
      g.set(k, [...(g.get(k) ?? []), f]);
    }
    return [...g.entries()];
  }, [state.fila]);

  const notificado = state.fila.find((f) => f.status === "NOTIFICADO");
  const simulavel = !notificado && state.fila.some((f) => f.status === "AGUARDANDO");

  const simularDesistencia = () => {
    const alvo = state.fila.filter((f) => f.status === "AGUARDANDO").sort((a, b) => a.dataISO.localeCompare(b.dataISO) || a.posicao - b.posicao)[0];
    if (!alvo) return;
    const med = state.medicos.find((m) => m.id === alvo.medicoId)!;
    const slot = slotsDoDia(med, alvo.dataISO).find(
      (h) => isBusyExterno(med.id, alvo.dataISO, h, state.freed, state.extra) &&
        !state.freed.includes(`${med.id}|${alvo.dataISO}|${h}`) &&
        !state.ags.some((a) => a.medicoId === med.id && a.dataISO === alvo.dataISO && a.hora === h),
    );
    if (!slot) {
      dispatch({ t: "toast", texto: "Sem vaga ocupada para liberar nesse dia", tom: "erro" });
      return;
    }
    dispatch({ t: "freeSlot", key: `${med.id}|${alvo.dataISO}|${slot}`, medicoId: med.id, dataISO: alvo.dataISO });
    dispatch({ t: "toast", texto: `Desistência registrada: vaga ${slot} liberada → 1º da fila notificado`, tom: "info" });
  };

  const salvarJornada = (medicoId: number) => {
    const ed = eds[medicoId];
    const jornadas: Jornada[] = DIAS_SEMANA.filter((d) => ed[d].on).map((d) => ({ dia: d, inicio: ed[d].inicio, fim: ed[d].fim, duracao: ed[d].duracao }));
    dispatch({ t: "setJornadas", medicoId, jornadas });
    dispatch({ t: "toast", texto: jornadas.length ? "Jornada atualizada — a agenda do app já reflete a mudança" : "Atenção: médico ficou sem jornada", tom: jornadas.length ? "ok" : "erro" });
    setAberto(null);
  };

  const addMedico = () => {
    if (!novo.nome.trim() || !novo.crm.trim()) {
      dispatch({ t: "toast", texto: "Preencha nome e registro", tom: "erro" });
      return;
    }
    const id = Math.max(...state.medicos.map((m) => m.id)) + 1;
    dispatch({
      t: "addMedico",
      med: {
        id, nome: novo.nome.trim(), crm: novo.crm.trim(), espId: novo.espId, valor: novo.valor,
        jornadas: DIAS_SEMANA.slice(0, 5).map((d) => ({ dia: d, inicio: "08:00", fim: "12:00", duracao: 30 })),
      },
    });
    dispatch({ t: "toast", texto: `${novo.nome} cadastrado com jornada SEG–SEX 08h–12h` });
    setNovo({ nome: "", crm: "", espId: 1, valor: 250 });
    setFormOpen(false);
  };

  const pill = (st: string) =>
    st === "AGUARDANDO" ? "bg-cream text-ink/60" : st === "NOTIFICADO" ? "bg-amber text-deep" : st === "EXPIRADO" ? "bg-coralsoft text-coral" : "bg-jadesoft text-jadedark";

  return (
    <section id="gestao" className="relative scroll-mt-14 py-20 sm:scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead num="03" kicker="Gestão da clínica"
          title={<>Ocupação, jornadas e fila:<br />a recepção no controle.</>}
          lead="O painel administrativo lê o mesmo banco do app. Configure jornadas, cadastre profissionais e acompanhe a fila de espera preenchendo as vagas que aparecem — sem uma ligação sequer." />

        {/* KPIs assimétricos */}
        <Reveal delay={80}>
          <div className="mt-10 flex flex-wrap items-end gap-x-10 gap-y-6 rounded-3xl border border-line bg-paper p-6 shadow-sm sm:p-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/45">ocupação de hoje</p>
              <p className="font-display text-6xl font-extrabold leading-none text-pine"><CountUp to={kpis.ocup} suffix="%" /></p>
              <div className="mt-2.5 h-2 w-44 overflow-hidden rounded-full bg-line">
                <div className={`h-full rounded-full transition-all duration-1000 ${kpis.ocup > 85 ? "bg-amber" : "bg-jade"}`} style={{ width: `${kpis.ocup}%` }} />
              </div>
            </div>
            <div className="h-16 w-px bg-line" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/45">consultas hoje</p>
              <p className="font-display text-4xl font-extrabold leading-none"><CountUp to={kpis.agHoje} /></p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/45">na fila agora</p>
              <p className="font-display text-4xl font-extrabold leading-none text-amber"><CountUp to={kpis.fila} /></p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/45">no-show no mês</p>
              <p className="font-display text-4xl font-extrabold leading-none text-coral"><CountUp to={11} suffix="%" /></p>
              <p className="mt-1 font-mono text-[10px] font-bold text-jade">▼ 8 pts vs. semestre anterior</p>
            </div>
            <div className="ml-auto hidden max-w-[220px] lg:block">
              <p className="text-[12px] leading-relaxed text-ink/55">Lembretes automáticos da Lia cortam faltas pela raiz — e a fila cobre o resto.</p>
            </div>
          </div>
        </Reveal>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          {/* coluna esquerda */}
          <div className="space-y-6">
            {/* ocupação semanal */}
            <Reveal delay={120}>
              <div className="rounded-3xl border border-line bg-paper p-6">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-lg font-extrabold">Ocupação · próximos 7 dias</h3>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink/40">todas as agendas</span>
                </div>
                <div className="mt-5 flex h-44 items-end gap-2.5 sm:gap-3.5">
                  {semana.map((d, i) => (
                    <div key={d.iso} className="group flex flex-1 flex-col items-center gap-1.5" title={`${d.label}: ${d.pct}% ocupado`}>
                      <span className={`font-mono text-[10.5px] font-bold ${d.pct > 85 ? "text-amber" : "text-ink/60"}`}>{d.dom ? "—" : `${d.pct}%`}</span>
                      <div className="flex h-28 w-full max-w-[46px] items-end overflow-hidden rounded-xl bg-cream">
                        <div className={`bar-grow w-full rounded-xl transition-colors ${d.iso === HOJE ? "bg-pine" : d.pct > 85 ? "bg-amber/85" : "bg-jade/75"} group-hover:brightness-110`}
                          style={{ height: `${Math.max(4, d.pct)}%`, animationDelay: `${i * 70}ms` }} />
                      </div>
                      <span className={`font-mono text-[9.5px] uppercase ${d.iso === HOJE ? "font-bold text-jade" : "text-ink/45"}`}>{d.label}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 rounded-xl bg-cream/70 px-3.5 py-2.5 font-mono text-[10.5px] text-ink/55">
                  ▲ barras acima de 85% ficam âmbar — sinal de ativar a fila de espera naquele dia.
                </p>
              </div>
            </Reveal>

            {/* médicos & jornadas */}
            <Reveal delay={160}>
              <div className="rounded-3xl border border-line bg-paper p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-extrabold">Corpo clínico & jornadas</h3>
                  <button onClick={() => setFormOpen((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold transition-colors ${formOpen ? "bg-cream text-ink/60" : "bg-pine text-paper hover:bg-jade"}`}>
                    {formOpen ? <IcX className="h-4 w-4" /> : <IcPlus className="h-4 w-4" />} {formOpen ? "Fechar" : "Cadastrar médico"}
                  </button>
                </div>

                {formOpen && (
                  <div className="pop-in mt-4 grid gap-2.5 rounded-2xl border border-dashed border-jade/50 bg-jadesoft/40 p-4 sm:grid-cols-2">
                    <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Nome completo (Dra./Dr.)"
                      className="rounded-xl border border-line bg-paper px-3 py-2.5 text-[13px] outline-none focus:border-jade" />
                    <input value={novo.crm} onChange={(e) => setNovo({ ...novo, crm: e.target.value })} placeholder="CRM-SP 000.000"
                      className="rounded-xl border border-line bg-paper px-3 py-2.5 font-mono text-[13px] outline-none focus:border-jade" />
                    <select value={novo.espId} onChange={(e) => setNovo({ ...novo, espId: +e.target.value })}
                      className="rounded-xl border border-line bg-paper px-3 py-2.5 text-[13px] outline-none focus:border-jade">
                      {ESPECIALIDADES.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                    </select>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-ink/50">R$</span>
                      <input type="number" value={novo.valor} onChange={(e) => setNovo({ ...novo, valor: +e.target.value })}
                        className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[13px] outline-none focus:border-jade" />
                    </div>
                    <button onClick={addMedico} className="rounded-xl bg-jade py-2.5 text-[13px] font-bold text-paper hover:bg-jadedark sm:col-span-2">
                      Cadastrar com jornada padrão SEG–SEX 08h–12h
                    </button>
                  </div>
                )}

                <div className="mt-4 divide-y divide-line">
                  {state.medicos.map((m) => {
                    const esp = ESPECIALIDADES.find((e) => e.id === m.espId);
                    const open = aberto === m.id;
                    const ed = eds[m.id] ?? initJ(m.jornadas);
                    return (
                      <div key={m.id}>
                        <button onClick={() => { setAberto(open ? null : m.id); setEds((p) => ({ ...p, [m.id]: initJ(m.jornadas) })); }}
                          className="flex w-full items-center gap-3 py-3.5 text-left">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pine font-display text-[12px] font-bold text-mint">
                            {m.nome.replace("Dra. ", "").replace("Dr. ", "").split(" ").map((x) => x[0]).slice(0, 2).join("")}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-bold">{m.nome}</span>
                            <span className="block font-mono text-[10px] text-ink/50">{m.crm} · {esp?.nome}</span>
                          </span>
                          <span className="hidden flex-wrap justify-end gap-1 sm:flex sm:max-w-[240px]">
                            {m.jornadas.length === 0 && <span className="rounded-full bg-coralsoft px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-coral">sem jornada</span>}
                            {m.jornadas.map((j) => (
                              <span key={j.dia} className="rounded-full bg-cream px-2 py-0.5 font-mono text-[9px] text-ink/60">{j.dia} {j.inicio.slice(0, 2)}–{j.fim.slice(0, 2)}h</span>
                            ))}
                          </span>
                          <IcChevD className={`h-4 w-4 shrink-0 text-ink/40 transition-transform ${open ? "rotate-180" : ""}`} />
                        </button>
                        {open && (
                          <div className="pop-in mb-4 rounded-2xl border border-line bg-cream/60 p-4">
                            <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink/45">Jornada de atendimento · duração da consulta por dia</p>
                            <div className="mt-3 space-y-2">
                              {DIAS_SEMANA.map((d) => {
                                const jd = ed[d];
                                return (
                                  <div key={d} className={`flex flex-wrap items-center gap-2.5 rounded-xl border p-2.5 transition-colors ${jd.on ? "border-jade/40 bg-paper" : "border-line bg-paper/50"}`}>
                                    <button onClick={() => setEds((p) => ({ ...p, [m.id]: { ...ed, [d]: { ...jd, on: !jd.on } } }))}
                                      className={`w-14 rounded-lg py-1.5 text-center font-mono text-[11px] font-bold transition-colors ${jd.on ? "bg-pine text-paper" : "bg-cream text-ink/40"}`}>
                                      {d}
                                    </button>
                                    {jd.on ? (
                                      <>
                                        <input type="time" value={jd.inicio} onChange={(e) => setEds((p) => ({ ...p, [m.id]: { ...ed, [d]: { ...jd, inicio: e.target.value } } }))}
                                          className="rounded-lg border border-line bg-paper px-2 py-1.5 font-mono text-[12px] outline-none focus:border-jade" />
                                        <span className="text-ink/35">→</span>
                                        <input type="time" value={jd.fim} onChange={(e) => setEds((p) => ({ ...p, [m.id]: { ...ed, [d]: { ...jd, fim: e.target.value } } }))}
                                          className="rounded-lg border border-line bg-paper px-2 py-1.5 font-mono text-[12px] outline-none focus:border-jade" />
                                        <select value={jd.duracao} onChange={(e) => setEds((p) => ({ ...p, [m.id]: { ...ed, [d]: { ...jd, duracao: +e.target.value } } }))}
                                          className="rounded-lg border border-line bg-paper px-2 py-1.5 font-mono text-[12px] outline-none focus:border-jade">
                                          {[20, 30, 45, 60].map((x) => <option key={x} value={x}>{x} min</option>)}
                                        </select>
                                        <span className="ml-auto font-mono text-[9.5px] text-ink/45">
                                          {Math.max(0, Math.floor(((+jd.fim.slice(0, 2) * 60 + +jd.fim.slice(3)) - (+jd.inicio.slice(0, 2) * 60 + +jd.inicio.slice(3))) / jd.duracao))} consultas/dia
                                        </span>
                                      </>
                                    ) : (
                                      <span className="font-mono text-[10px] text-ink/35">folga</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <button onClick={() => salvarJornada(m.id)} className="mt-3 w-full rounded-xl bg-jade py-2.5 text-[13px] font-bold text-paper transition-colors hover:bg-jadedark">
                              Salvar jornada de {m.nome}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Reveal>
          </div>

          {/* fila de espera */}
          <Reveal delay={200}>
            <div className="flex h-full flex-col rounded-3xl bg-deep p-6 text-paper shadow-xl shadow-pine/20">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-display text-lg font-extrabold"><IcQueue className="h-5 w-5 text-amber" /> Fila de espera · RN02</h3>
                <span className="rounded-full bg-paper/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-mint/70">1s = 1min · demo</span>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-mint/65">
                Abriu vaga? O sistema avisa <strong className="text-mint">somente o 1º colocado</strong>, que tem <strong className="text-mint">60 minutos</strong> para confirmar. Expirou, passa ao próximo — automaticamente.
              </p>

              <div className="mt-4 flex gap-2">
                <button onClick={simularDesistencia} disabled={!simulavel}
                  className="flex-1 rounded-xl bg-amber py-2.5 text-[12.5px] font-extrabold text-deep transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35">
                  Simular desistência
                </button>
                <button onClick={() => notificado && dispatch({ t: "expireNow", waitId: notificado.id })} disabled={!notificado}
                  className="flex-1 rounded-xl border border-linedark py-2.5 text-[12.5px] font-bold text-mint transition-colors hover:bg-paper/10 disabled:cursor-not-allowed disabled:opacity-35">
                  Pular janela de 1h
                </button>
              </div>

              <div className="thin-scroll-dark mt-4 flex-1 space-y-4 overflow-y-auto pr-1" style={{ maxHeight: "430px" }}>
                {grupos.map(([k, entries]) => {
                  const [medId, iso] = k.split("|");
                  const med = state.medicos.find((m) => m.id === +medId);
                  return (
                    <div key={k} className="rounded-2xl border border-linedark bg-pine/60 p-3.5">
                      <div className="flex items-baseline justify-between">
                        <p className="text-[13px] font-bold">{med?.nome}</p>
                        <p className="font-mono text-[10px] text-mintdark">{fmtDataMedia(iso)}</p>
                      </div>
                      <div className="mt-2.5 space-y-1.5">
                        {entries.map((f) => (
                          <div key={f.id} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${f.status === "NOTIFICADO" ? "bg-amber/15 ring-1 ring-amber/50" : "bg-paper/5"}`}>
                            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-[11px] font-extrabold ${f.status === "NOTIFICADO" ? "bg-amber text-deep" : f.posicao === 1 ? "bg-paper/15 text-mint" : "bg-paper/5 text-mint/50"}`}>
                              {f.posicao}º
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12.5px] font-bold leading-tight">
                                {f.paciente} {f.voce && <span className="rounded-full bg-jade/25 px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase text-mint">você</span>}
                              </p>
                              <p className="font-mono text-[9px] uppercase tracking-wide text-mint/50">
                                {f.status === "NOTIFICADO" && f.vagaKey ? `vaga ${f.vagaKey.split("|")[2]} ofertada` : f.status === "AGUARDANDO" ? "na espera" : f.status.toLowerCase()}
                              </p>
                            </div>
                            {f.status === "NOTIFICADO" ? (
                              <span className="shrink-0 rounded-lg bg-amber px-2 py-1 font-mono text-[11px] font-extrabold tabular-nums text-deep">
                                {f.janelaRestante} min
                              </span>
                            ) : (
                              <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[8.5px] font-bold uppercase ${pill(f.status)}`}>
                                {f.status === "AGUARDANDO" ? "aguardando" : f.status === "EXPIRADO" ? "expirou" : "confirmou"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {grupos.length === 0 && <p className="py-8 text-center font-mono text-[11px] text-mint/45">Nenhuma inscrição na fila.</p>}
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-linedark pt-3.5 font-mono text-[10px] text-mint/50">
                <IcDb className="h-4 w-4 shrink-0 text-jade" />
                Escrito em fila_espera · UPDATE transacional a cada promoção
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
