import React, { useEffect, useMemo, useRef, useState } from "react";
import { useClinic, podeCancelar } from "../store";
import {
  Agendamento, DayStatus, ESPECIALIDADES, MESES, MESES_CURTO, MIN_CANCEL, Notif, dayStatus, diaSemanaDe, fmtBRL,
  fmtDataLonga, fmtDataMedia, hashStr, HOJE, isBusyExterno, minutesUntil, pad, slotsDoDia, PacientePerfil, LembreteConfig,
} from "../data";
import Chat from "./Chat";
import { FakeQR } from "./ui";
import {
  IcAlert, IcBack, IcBell, IcBone, IcCalendar, IcChat, IcCheck, IcChevD, IcChevL, IcChevR, IcClinica, IcClock,
  IcDoc, IcDownload, IcGear, IcHeart, IcIdCard, IcKid, IcLock, IcPhone, IcPlus, IcQueue, IcSkin, IcSpark, IcTooth, IcWallet, IcX,
  IcEdit,
} from "./icons";

const ESP_ICON: Record<number, (p: { className?: string }) => React.ReactNode> = {
  1: IcHeart, 2: IcClinica, 3: IcTooth, 4: IcBone, 5: IcSkin, 6: IcKid,
};

const saudacao = () => {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};

/* ================= modais dentro do telefone ================= */
const Sheet = ({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="absolute inset-0 z-30 flex items-end bg-deep/55 backdrop-blur-[2px]">
    <div className="pop-in w-full rounded-t-3xl border-t border-line bg-paper p-4 pb-6 shadow-2xl" style={{ maxHeight: "88%" }}>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-display text-base font-bold">{titulo}</h4>
        <button onClick={onClose} aria-label="Fechar" className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink/60 hover:bg-cream"><IcX className="h-4 w-4" /></button>
      </div>
      <div className="thin-scroll overflow-y-auto" style={{ maxHeight: "calc(88vh - 120px)" }}>{children}</div>
    </div>
  </div>
);

/* ================= wizard de agendamento ================= */
type WStep = "esp" | "doc" | "cal" | "hora" | "pag" | "ok";
const Wizard = ({ espInicial, onClose, gotoConsultas }: { espInicial?: number; onClose: () => void; gotoConsultas: () => void }) => {
  const { state, dispatch } = useClinic();
  const acc = state.perfil.acessibilidade;
  const simp = acc.modoSimplificado;
  const [step, setStep] = useState<WStep>(espInicial ? "doc" : "esp");
  const [espId, setEspId] = useState<number | null>(espInicial ?? null);
  const [medicoId, setMedicoId] = useState<number | null>(null);
  const [mesOff, setMesOff] = useState(0);
  const [dataISO, setDataISO] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"CONVENIO" | "PARTICULAR" | null>(null);
  const [cart, setCart] = useState(state.perfil.carteirinha || "");
  const [proto, setProto] = useState("");
  const [raceErr, setRaceErr] = useState(false);

  const med = state.medicos.find((m) => m.id === medicoId) ?? null;
  const esp = ESPECIALIDADES.find((e) => e.id === espId);

  useEffect(() => {
    if (espId && !medicoId) {
      const m = state.medicos.find((x) => x.espId === espId);
      if (m) setMedicoId(m.id);
    }
  }, [espId, medicoId, state.medicos]);

  const busy = (iso: string, h: string) =>
    !!med && (isBusyExterno(med.id, iso, h, state.freed, state.extra) ||
      state.ags.some((a) => a.medicoId === med.id && a.dataISO === iso && a.hora === h && a.status === "AGENDADO"));

  const dias = useMemo(() => {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + mesOff);
    const primeiro = base.getDay();
    const total = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const cells: ({ iso: string; d: number } | null)[] = [];
    for (let i = 0; i < primeiro; i++) cells.push(null);
    for (let d = 1; d <= total; d++) {
      const iso = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(d)}`;
      cells.push({ iso, d });
    }
    return cells;
  }, [mesOff]);

  const mesNome = (() => {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + mesOff);
    return `${MESES[base.getMonth()]} ${base.getFullYear()}`;
  })();

  const voltar = () => {
    if (step === "doc") setStep("esp");
    else if (step === "cal") setStep("doc");
    else if (step === "hora") setStep("cal");
    else if (step === "pag") { setRaceErr(false); setStep("hora"); }
    else onClose();
  };

  const confirmar = () => {
    if (!med || !dataISO || !hora || !tipo) return;
    if (busy(dataISO, hora)) { setRaceErr(true); return; }
    /* RN03 — simulação determinística de corrida transacional no 1º horário livre */
    const livres = slotsDoDia(med, dataISO).filter((h) => !busy(dataISO, h));
    if (livres[0] === hora && hashStr(`${med.id}|${dataISO}|${hora}`) % 5 === 0) {
      dispatch({ t: "raceLost", key: `${med.id}|${dataISO}|${hora}` });
      setRaceErr(true);
      return;
    }
    const p = `FM-${hashStr(`${med.id}${dataISO}${hora}${Date.now()}`).toString(36).slice(0, 5).toUpperCase()}`;
    dispatch({
      t: "addAg",
      ag: {
        id: Date.now(), paciente: state.perfil.nome || "Maria Aparecida", voce: true, medicoId: med.id, dataISO, hora, tipo,
        carteirinha: tipo === "CONVENIO" ? cart || undefined : undefined, status: "AGENDADO", protocolo: p,
      },
    });
    setProto(p);
    setStep("ok");
  };

  const cellCls = (st: DayStatus, sel: boolean) => {
    const base = "grid h-9 w-9 place-items-center rounded-xl text-[12.5px] font-bold transition-all duration-150 sm:h-10 sm:w-10";
    if (st === "passado") return `${base} bg-deep/85 text-paper/35 cursor-not-allowed`;
    if (st === "sem") return `${base} border border-dashed border-line text-ink/25 cursor-not-allowed`;
    if (st === "cheio") return `${base} bg-ink/10 text-ink/35 line-through cursor-not-allowed`;
    return `${base} border-2 ${sel ? "border-pine bg-pine text-paper scale-105" : "border-jade/60 bg-jadesoft text-jadedark hover:scale-110 hover:bg-jade hover:text-paper"}`;
  };

  const Titulo = ({ children }: { children: React.ReactNode }) => (
    <h3 className={`font-display font-bold text-ink ${simp ? "text-xl" : "text-base"}`}>{children}</h3>
  );

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-paper screen-in">
      <div className="flex items-center gap-2 border-b border-line bg-cream/60 px-3 py-2.5">
        <button onClick={voltar} aria-label="Voltar" className="grid h-8 w-8 place-items-center rounded-full border border-line bg-paper text-ink/70 transition-colors hover:bg-jadesoft"><IcBack className="h-4 w-4" /></button>
        <div className="flex-1">
          <p className="font-display text-sm font-bold leading-tight">Nova consulta</p>
          <p className="font-mono text-[9.5px] uppercase tracking-widest text-ink/45">
            {step === "esp" ? "1 · especialidade" : step === "doc" ? "2 · profissional" : step === "cal" ? "3 · dia" : step === "hora" ? "4 · horário" : step === "pag" ? "5 · pagamento" : "confirmada"}
          </p>
        </div>
        <div className="flex gap-1">
          {["esp", "doc", "cal", "hora", "pag"].map((s, i) => (
            <span key={s} className={`h-1.5 w-4 rounded-full transition-colors ${["esp", "doc", "cal", "hora", "pag"].indexOf(step) >= i ? "bg-jade" : "bg-line"}`} />
          ))}
        </div>
      </div>

      <div className="thin-scroll flex-1 overflow-y-auto p-3.5">
        {step === "esp" && (
          <div className="pop-in">
            <Titulo>Qual especialidade você procura?</Titulo>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {ESPECIALIDADES.map((e) => {
                const Icon = ESP_ICON[e.id];
                return (
                  <button key={e.id} onClick={() => { setEspId(e.id); setStep("doc"); }}
                    className="group rounded-2xl border border-line bg-paper p-3 text-left transition-all hover:-translate-y-0.5 hover:border-jade/50 hover:shadow-md">
                    <span className="grid h-9 w-9 place-items-center rounded-xl text-paper transition-transform group-hover:scale-110" style={{ background: e.cor }}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className={`mt-2 font-display font-bold leading-tight ${simp ? "text-base" : "text-[13px]"}`}>{e.nome}</p>
                    <p className="text-[10.5px] text-ink/50">{e.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "doc" && med && esp && (
          <div className="pop-in">
            <Titulo>Profissionais de {esp.nome}</Titulo>
            <button onClick={() => setStep("cal")}
              className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-line bg-paper p-3 text-left transition-all hover:-translate-y-0.5 hover:border-jade/50 hover:shadow-md">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-pine font-display text-sm font-bold text-mint">
                {med.nome.replace("Dra. ", "").replace("Dr. ", "").split(" ").map((x) => x[0]).slice(0, 2).join("")}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block font-display font-bold leading-tight ${simp ? "text-base" : "text-[14px]"}`}>{med.nome}</span>
                <span className="block font-mono text-[10px] text-ink/50">{med.crm} · {esp.nome} · {med.unidade || "Unidade Central"}</span>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-ambersoft px-2 py-0.5 font-mono text-[10px] font-semibold text-amber">
                  ★ 4,9 · {fmtBRL(med.valor)}
                </span>
              </span>
              <IcChevR className="h-4 w-4 shrink-0 text-ink/35" />
            </button>
            <p className="mt-2.5 rounded-xl border border-dashed border-line bg-cream/60 p-2.5 text-[11px] leading-relaxed text-ink/55">
              Agenda sincronizada com o painel da clínica em tempo real — o horário que você reservar some daqui e de lá ao mesmo tempo.
            </p>
          </div>
        )}

        {step === "cal" && med && (
          <div className="pop-in">
            <Titulo>Escolha o dia</Titulo>
            <div className="mt-3 rounded-2xl border border-line bg-paper p-3">
              <div className="flex items-center justify-between">
                <button onClick={() => setMesOff((v) => Math.max(0, v - 1))} disabled={mesOff === 0} aria-label="Mês anterior"
                  className="grid h-8 w-8 place-items-center rounded-full border border-line disabled:opacity-30 hover:bg-cream"><IcChevL className="h-4 w-4" /></button>
                <p className="font-display text-[13px] font-bold capitalize">{mesNome}</p>
                <button onClick={() => setMesOff((v) => Math.min(2, v + 1))} disabled={mesOff === 2} aria-label="Próximo mês"
                  className="grid h-8 w-8 place-items-center rounded-full border border-line disabled:opacity-30 hover:bg-cream"><IcChevR className="h-4 w-4" /></button>
              </div>
              <div className="mt-2.5 grid grid-cols-7 gap-1 text-center font-mono text-[9.5px] uppercase text-ink/40">
                {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <span key={i} className="py-1">{d}</span>)}
              </div>
              <div className="grid grid-cols-7 place-items-center gap-1">
                {(dias as ({ iso: string; d: number } | null)[]).map((c, i) => {
                  if (!c) return <span key={i} />;
                  const st = dayStatus(med, c.iso, state.ags, state.freed, state.extra);
                  return (
                    <button key={i} disabled={st === "passado" || st === "sem" || st === "cheio"}
                      onClick={() => { setDataISO(c.iso); setStep("hora"); }}
                      className={cellCls(st, dataISO === c.iso)} aria-label={`Dia ${c.d}`}>
                      {c.d}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-2.5 font-mono text-[9px] text-ink/55">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-jadesoft ring-1 ring-jade/60" /> com vagas</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-ink/15" /> lotado</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-deep/85" /> passado</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded border border-dashed border-ink/30" /> sem atendimento</span>
              </div>
            </div>
          </div>
        )}

        {step === "hora" && med && dataISO && (
          <div className="pop-in">
            <Titulo>Horários · {fmtDataMedia(dataISO)}</Titulo>
            <p className="mt-1 text-[11px] text-ink/55">Consultas de {diaSemanaDe(dataISO) ? (med.jornadas.find((j) => j.dia === diaSemanaDe(dataISO))?.duracao ?? 30) : 30} min com {med.nome}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {slotsDoDia(med, dataISO).map((h) => {
                const b = busy(dataISO, h);
                return (
                  <button key={h} disabled={b} onClick={() => setHora(h)}
                    className={`rounded-xl border-2 py-2.5 font-mono text-[13px] font-semibold transition-all ${
                      b ? "cursor-not-allowed border-line bg-cream text-ink/30 line-through"
                        : hora === h ? "border-pine bg-pine text-paper scale-[1.04]"
                          : "border-jade/50 bg-jadesoft text-jadedark hover:scale-105 hover:bg-jade hover:text-paper"}`}>
                    {h}
                  </button>
                );
              })}
            </div>
            {slotsDoDia(med, dataISO).every((h) => busy(dataISO, h)) && (
              <div className="mt-3 rounded-xl border border-amber/50 bg-ambersoft p-3 text-[11.5px] leading-relaxed text-ink/70">
                <strong>Dia lotado!</strong> Pelo app, peça à <strong>Lia (chat IA)</strong> para entrar na fila de espera — ela avisa o 1º colocado assim que abrir vaga.
              </div>
            )}
          </div>
        )}

        {step === "pag" && med && dataISO && hora && (
          <div className="pop-in">
            <Titulo>Tipo de atendimento</Titulo>
            <div className="mt-3 space-y-2">
              <button onClick={() => setTipo("CONVENIO")}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all ${tipo === "CONVENIO" ? "border-pine bg-jadesoft" : "border-line bg-paper hover:border-jade/50"}`}>
                <IcIdCard className="h-6 w-6 shrink-0 text-jade" />
                <span className="flex-1">
                  <span className={`block font-display font-bold ${simp ? "text-base" : "text-[13.5px]"}`}>Convênio</span>
                  <span className="block text-[11px] text-ink/55">{state.perfil.plano || "Plano Vida+ ativo"}</span>
                </span>
                <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${tipo === "CONVENIO" ? "border-jade bg-jade text-paper" : "border-ink/25"}`}>{tipo === "CONVENIO" && <IcCheck className="h-3 w-3" />}</span>
              </button>
              {tipo === "CONVENIO" && (
                <div className="pop-in rounded-2xl border border-line bg-cream/70 p-3">
                  <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50">Nº da carteirinha</label>
                  <input value={cart} onChange={(e) => setCart(e.target.value)} placeholder="0042 8871 3345 09"
                    className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 font-mono text-[13px] outline-none focus:border-jade" />
                </div>
              )}
              <button onClick={() => setTipo("PARTICULAR")}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all ${tipo === "PARTICULAR" ? "border-pine bg-jadesoft" : "border-line bg-paper hover:border-jade/50"}`}>
                <IcWallet className="h-6 w-6 shrink-0 text-amber" />
                <span className="flex-1">
                  <span className={`block font-display font-bold ${simp ? "text-base" : "text-[13.5px]"}`}>Particular</span>
                  <span className="block font-mono text-[12px] font-bold text-jadedark">{fmtBRL(med.valor)} · na recepção</span>
                </span>
                <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${tipo === "PARTICULAR" ? "border-jade bg-jade text-paper" : "border-ink/25"}`}>{tipo === "PARTICULAR" && <IcCheck className="h-3 w-3" />}</span>
              </button>
            </div>

            <div className="mt-3 rounded-2xl border border-line bg-cream/70 p-3 text-[11.5px]">
              <p className="font-mono text-[9.5px] uppercase tracking-widest text-ink/45">Resumo</p>
              <p className="mt-1"><strong>{med.nome}</strong> · {esp?.nome}</p>
              <p>{fmtDataLonga(dataISO)} · <strong>{hora}</strong></p>
            </div>

            {raceErr ? (
              <div className="pop-in mt-3 rounded-2xl border-2 border-coral/60 bg-coralsoft p-3.5">
                <p className="flex items-center gap-2 font-display text-[13px] font-bold text-coral"><IcLock className="h-4.5 w-4.5" /> Horário reservado por outro paciente</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink/70">
                  <strong>RN03 · Prevenção de conflito:</strong> a transação foi bloqueada no banco — duas pessoas jamais ficam com o mesmo horário. Escolha outro ao lado.
                </p>
                <button onClick={() => { setRaceErr(false); setHora(null); setStep("hora"); }}
                  className="mt-2.5 w-full rounded-xl bg-pine py-2.5 text-[12.5px] font-bold text-paper hover:bg-jade">Escolher outro horário</button>
              </div>
            ) : (
              <button onClick={confirmar} disabled={!tipo || (tipo === "CONVENIO" && cart.replace(/\D/g, "").length < 8)}
                className="mt-3 w-full rounded-2xl bg-jade py-3.5 font-display text-[14px] font-bold text-paper shadow-lg shadow-jade/25 transition-all hover:-translate-y-0.5 hover:bg-jadedark disabled:opacity-40 disabled:shadow-none">
                Confirmar agendamento
              </button>
            )}
          </div>
        )}

        {step === "ok" && med && dataISO && hora && (
          <div className="pop-in text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-jadesoft text-jade"><IcCheck className="h-8 w-8" /></span>
            <h3 className="mt-3 font-display text-lg font-extrabold">Consulta confirmada!</h3>
            <p className="mt-1 text-[12px] text-ink/60">Protocolo <span className="font-mono font-bold text-jadedark">{proto}</span></p>
            <div className="mx-auto mt-3 max-w-[220px] rounded-2xl border border-line bg-paper p-3">
              <FakeQR seed={proto} className="mx-auto h-28 w-28" />
              <div className="mt-2 border-t border-dashed border-line pt-2 text-left text-[11px] leading-relaxed">
                <p><strong>{med.nome}</strong></p>
                <p className="text-ink/60">{fmtDataLonga(dataISO)} · {hora}</p>
                <p className="text-ink/60">{tipo === "CONVENIO" ? (state.perfil.plano || "Convênio Vida+") : `Particular · ${fmtBRL(med.valor)}`}</p>
              </div>
            </div>
            <p className="mt-2.5 text-[11px] text-ink/55">Lembrete automático 24h e 2h antes. 📲</p>
            <button onClick={() => { onClose(); gotoConsultas(); }} className="mt-3 w-full rounded-2xl bg-pine py-3 font-display text-[13.5px] font-bold text-paper hover:bg-jade">Ver minhas consultas</button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ================= wizard de reagendamento ================= */
const ReagendarWizard = ({ ag, onClose }: { ag: Agendamento; onClose: () => void }) => {
  const { state, dispatch } = useClinic();
  const med = state.medicos.find((m) => m.id === ag.medicoId);
  const [dataISO, setDataISO] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [mesOff, setMesOff] = useState(0);

  const dias = useMemo(() => {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + mesOff);
    const primeiro = base.getDay();
    const total = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const cells: ({ iso: string; d: number } | null)[] = [];
    for (let i = 0; i < primeiro; i++) cells.push(null);
    for (let d = 1; d <= total; d++) {
      const iso = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(d)}`;
      cells.push({ iso, d });
    }
    return cells;
  }, [mesOff]);

  const mesNome = (() => {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + mesOff);
    return `${MESES[base.getMonth()]} ${base.getFullYear()}`;
  })();

  const busy = (iso: string, h: string) =>
    !!med && (isBusyExterno(med.id, iso, h, state.freed, state.extra) ||
      state.ags.some((a) => a.id !== ag.id && a.medicoId === med.id && a.dataISO === iso && a.hora === h && a.status === "AGENDADO"));

  const salvar = () => {
    if (!dataISO || !hora) return;
    dispatch({ t: "reagendarAg", id: ag.id, novaDataISO: dataISO, novaHora: hora, por: "Paciente (App)" });
    dispatch({ t: "toast", texto: `Reagendado para ${fmtDataMedia(dataISO)} às ${hora}! Horário antigo liberado. 🎉` });
    onClose();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-line bg-cream/70 p-3 text-[12px]">
        <p className="font-mono text-[9.5px] uppercase tracking-widest text-ink/45">Consulta Atual</p>
        <p className="font-bold text-ink">{med?.nome} · {fmtDataMedia(ag.dataISO)} às {ag.hora}</p>
      </div>

      <p className="font-display text-[13.5px] font-bold text-ink">Selecione o novo dia:</p>
      <div className="rounded-2xl border border-line bg-paper p-3">
        <div className="flex items-center justify-between">
          <button onClick={() => setMesOff((v) => Math.max(0, v - 1))} disabled={mesOff === 0} className="grid h-7 w-7 place-items-center rounded-full border border-line disabled:opacity-30"><IcChevL className="h-3.5 w-3.5" /></button>
          <p className="font-display text-[12px] font-bold capitalize">{mesNome}</p>
          <button onClick={() => setMesOff((v) => Math.min(2, v + 1))} disabled={mesOff === 2} className="grid h-7 w-7 place-items-center rounded-full border border-line disabled:opacity-30"><IcChevR className="h-3.5 w-3.5" /></button>
        </div>
        <div className="mt-2 grid grid-cols-7 place-items-center gap-1">
          {dias.map((c, i) => {
            if (!c) return <span key={i} />;
            const st = med ? dayStatus(med, c.iso, state.ags, state.freed, state.extra) : "sem";
            const sel = dataISO === c.iso;
            return (
              <button key={i} disabled={st === "passado" || st === "sem" || st === "cheio"}
                onClick={() => { setDataISO(c.iso); setHora(null); }}
                className={`grid h-8 w-8 place-items-center rounded-xl font-mono text-[11px] font-bold ${
                  sel ? "bg-pine text-paper" : st === "cheio" || st === "passado" || st === "sem" ? "text-ink/25 line-through" : "bg-jadesoft text-jadedark hover:bg-jade hover:text-paper"
                }`}>
                {c.d}
              </button>
            );
          })}
        </div>
      </div>

      {dataISO && med && (
        <div className="pop-in space-y-2">
          <p className="font-display text-[13px] font-bold">Novo horário em {fmtDataMedia(dataISO)}:</p>
          <div className="grid grid-cols-3 gap-2">
            {slotsDoDia(med, dataISO).map((h) => {
              const b = busy(dataISO, h);
              return (
                <button key={h} disabled={b} onClick={() => setHora(h)}
                  className={`rounded-xl border py-2 font-mono text-[12px] font-bold ${
                    b ? "border-line bg-cream text-ink/30 line-through" : hora === h ? "border-pine bg-pine text-paper" : "border-jade/50 bg-jadesoft text-jadedark"
                  }`}>
                  {h}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-xl border border-line py-2.5 text-[12px] font-bold text-ink/70">Cancelar</button>
        <button onClick={salvar} disabled={!dataISO || !hora} className="flex-1 rounded-xl bg-jade py-2.5 text-[12px] font-bold text-paper disabled:opacity-40">Confirmar Reagendamento</button>
      </div>
    </div>
  );
};

/* ================= cadastro em 3 etapas ================= */
const CadastroModal = ({ onClose }: { onClose: () => void }) => {
  const { state, dispatch } = useClinic();
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<PacientePerfil>({ ...state.perfil });

  const salvar = () => {
    dispatch({ t: "setProfile", perfil: form });
    dispatch({ t: "toast", texto: "Cadastro atualizado com sucesso! 🎉" });
    onClose();
  };

  return (
    <Sheet titulo={`Cadastro do Paciente · Etapa ${etapa} de 3`} onClose={onClose}>
      <div className="space-y-3.5">
        {/* barra de etapas */}
        <div className="flex gap-1.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${etapa >= i ? "bg-jade" : "bg-line"}`} />
          ))}
        </div>

        {etapa === 1 && (
          <div className="pop-in space-y-3">
            <p className="font-display text-[14px] font-bold text-ink">Etapa 1: Dados Pessoais Obrigatórios</p>
            <label className="block text-[11px] font-bold text-ink/80">Nome Completo
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="mt-1 w-full rounded-xl border border-line bg-cream/70 px-3 py-2 text-[13px] font-semibold text-ink outline-none focus:border-jade focus:bg-paper" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] font-bold text-ink/80">Data de Nascimento
                <input type="date" value={form.nascimento} onChange={(e) => setForm({ ...form, nascimento: e.target.value })} className="mt-1 w-full rounded-xl border border-line bg-cream/70 px-3 py-2 text-[13px] font-semibold text-ink outline-none focus:border-jade focus:bg-paper" />
              </label>
              <label className="block text-[11px] font-bold text-ink/80">CPF
                <input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} className="mt-1 w-full rounded-xl border border-line bg-cream/70 px-3 py-2 text-[13px] font-semibold text-ink outline-none focus:border-jade focus:bg-paper" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] font-bold text-ink/80">Telefone / WhatsApp
                <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="mt-1 w-full rounded-xl border border-line bg-cream/70 px-3 py-2 text-[13px] font-semibold text-ink outline-none focus:border-jade focus:bg-paper" />
              </label>
              <label className="block text-[11px] font-bold text-ink/80">Senha de Acesso
                <input type="password" value={form.senha || ""} onChange={(e) => setForm({ ...form, senha: e.target.value })} className="mt-1 w-full rounded-xl border border-line bg-cream/70 px-3 py-2 text-[13px] font-semibold text-ink outline-none focus:border-jade focus:bg-paper" />
              </label>
            </div>
          </div>
        )}

        {etapa === 2 && (
          <div className="pop-in space-y-3">
            <p className="font-display text-[14px] font-bold text-ink">Etapa 2: Dados Opcionais e Responsável</p>
            <label className="block text-[11px] font-bold text-ink/80">E-mail (opcional)
              <input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="exemplo@email.com" className="mt-1 w-full rounded-xl border border-line bg-cream/70 px-3 py-2 text-[13px] font-semibold text-ink outline-none focus:border-jade focus:bg-paper" />
            </label>
            <label className="block text-[11px] font-bold text-ink/80">Plano / Convênio de Saúde
              <input value={form.plano} onChange={(e) => setForm({ ...form, plano: e.target.value })} className="mt-1 w-full rounded-xl border border-line bg-cream/70 px-3 py-2 text-[13px] font-semibold text-ink outline-none focus:border-jade focus:bg-paper" />
            </label>
            <label className="block text-[11px] font-bold text-ink/80">Número da Carteirinha
              <input value={form.carteirinha || ""} onChange={(e) => setForm({ ...form, carteirinha: e.target.value })} className="mt-1 w-full rounded-xl border border-line bg-cream/70 px-3 py-2 text-[13px] font-semibold text-ink outline-none focus:border-jade focus:bg-paper" />
            </label>
            <div className="border-t border-line pt-2">
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink/60">Responsável Autorizado (Acompanhante)</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <input placeholder="Nome do responsável" value={form.responsavelNome || ""} onChange={(e) => setForm({ ...form, responsavelNome: e.target.value })} className="w-full rounded-xl border border-line bg-cream/70 px-3 py-2 text-[12px] font-semibold text-ink outline-none focus:border-jade focus:bg-paper" />
                <input placeholder="Telefone do responsável" value={form.responsavelTelefone || ""} onChange={(e) => setForm({ ...form, responsavelTelefone: e.target.value })} className="w-full rounded-xl border border-line bg-cream/70 px-3 py-2 text-[12px] font-semibold text-ink outline-none focus:border-jade focus:bg-paper" />
              </div>
            </div>
          </div>
        )}

        {etapa === 3 && (
          <div className="pop-in space-y-2.5">
            <p className="font-display text-[14px] font-bold text-ink">Etapa 3: Preferências de Acessibilidade</p>
            <p className="text-[12px] font-semibold text-ink/75">Selecione e combine quantas opções desejar:</p>
            <div className="space-y-2">
              {[
                ["textoMaior", "Texto Maior", "Aumenta o tamanho da fonte em todas as telas"],
                ["altoContraste", "Alto Contraste", "Bordas reforçadas e fundo escuro/claro nítido"],
                ["botoesGrandes", "Botões Grandes", "Alvos de toque ampliados para facilitar o clique"],
                ["respostasFaladas", "Respostas Faladas (TTS)", "Lia lê mensagens e orientações em voz alta"],
                ["modoSimplificado", "Modo Simplificado", "Fluxos diretos e linguagem sem termos técnicos"],
                ["leitorDeTela", "Otimizado para Leitor de Tela", "Rótulos semânticos e navegação acessível"],
              ].map(([key, titulo, desc]) => {
                const k = key as keyof typeof form.acessibilidade;
                const ativo = form.acessibilidade[k];
                return (
                  <button key={key} type="button" onClick={() => setForm({ ...form, acessibilidade: { ...form.acessibilidade, [k]: !ativo } })}
                    className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition-all ${ativo ? "border-jade bg-jadesoft text-jadedark font-bold shadow-sm" : "border-line bg-paper text-ink/80 hover:bg-cream"}`}>
                    <div>
                      <p className="text-[13px] font-bold leading-tight">{titulo}</p>
                      <p className="text-[11px] text-ink/70">{desc}</p>
                    </div>
                    <span className={`grid h-5 w-5 place-items-center rounded-md border ${ativo ? "border-jade bg-jade text-paper" : "border-line bg-paper"}`}>
                      {ativo && <IcCheck className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {etapa > 1 ? (
            <button onClick={() => setEtapa((e) => (e - 1) as any)} className="rounded-xl border border-line px-4 py-2.5 text-[12.5px] font-bold text-ink/75 hover:bg-cream">Voltar</button>
          ) : (
            <button onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-[12.5px] font-bold text-ink/75 hover:bg-cream">Cancelar</button>
          )}
          {etapa < 3 ? (
            <button onClick={() => setEtapa((e) => (e + 1) as any)} className="flex-1 rounded-xl bg-pine py-2.5 text-[12.5px] font-bold text-paper hover:bg-jade">Próxima Etapa →</button>
          ) : (
            <button onClick={salvar} className="flex-1 rounded-xl bg-jade py-2.5 text-[12.5px] font-bold text-paper shadow-md hover:bg-jadedark">Concluir e Salvar</button>
          )}
        </div>
      </div>
    </Sheet>
  );
};

/* ================= app do paciente ================= */
export default function PhoneApp() {
  const { state, dispatch } = useClinic();
  const acc = state.perfil.acessibilidade;
  const simp = acc.modoSimplificado;
  const isTxtLarge = acc.textoMaior || simp;
  const isBtnLarge = acc.botoesGrandes || simp;
  const isContrast = acc.altoContraste;

  const [tab, setTab] = useState<"home" | "chat" | "consultas" | "ajustes">("home");
  const [wizard, setWizard] = useState<{ aberto: boolean; espId?: number }>({ aberto: false });
  const [reagendando, setReagendando] = useState<Agendamento | null>(null);
  const [cadastroOpen, setCadastroOpen] = useState(false);
  const [lembreteSheet, setLembreteSheet] = useState(false);
  const [sheet, setSheet] = useState<"comprovante" | "relatorio" | "cancelar" | "bloqueado" | "offlineInfo" | null>(null);
  const [selAg, setSelAg] = useState<Agendamento | null>(null);
  const [seg, setSeg] = useState<"prox" | "hist" | "rel">("prox");
  const [pop, setPop] = useState<Notif | null>(null);
  const [relogio, setRelogio] = useState(() => new Date());
  const prevCount = useRef(state.notifs.length);

  useEffect(() => {
    const t = setInterval(() => setRelogio(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (state.notifs.length > prevCount.current) {
      setPop(state.notifs[0]);
      const t = setTimeout(() => setPop(null), 5800);
      prevCount.current = state.notifs.length;
      return () => clearTimeout(t);
    }
    prevCount.current = state.notifs.length;
  }, [state.notifs]);

  const proxima = useMemo(
    () => state.ags.filter((a) => a.voce && a.status === "AGENDADO" && minutesUntil(a.dataISO, a.hora) > -30)
      .sort((a, b) => `${a.dataISO}${a.hora}`.localeCompare(`${b.dataISO}${b.hora}`))[0],
    [state.ags],
  );
  const historico = useMemo(
    () => state.ags.filter((a) => a.voce && a.status !== "AGENDADO").sort((a, b) => b.dataISO.localeCompare(a.dataISO)),
    [state.ags],
  );
  const naoLidas = state.notifs.filter((n) => !n.lida).length;
  const minhaFila = state.fila.filter((f) => f.voce && (f.status === "AGUARDANDO" || f.status === "NOTIFICADO"));
  const medDe = (id: number) => state.medicos.find((m) => m.id === id);
  const espDe = (medId: number) => ESPECIALIDADES.find((e) => e.id === medDe(medId)?.espId);

  const pedirCancelamento = (ag: Agendamento) => {
    if (state.offline) {
      setSheet("offlineInfo");
      return;
    }
    setSelAg(ag);
    setSheet(podeCancelar(ag) ? "cancelar" : "bloqueado");
  };

  const abrirAgendamento = (espId?: number) => {
    if (state.offline) {
      setSheet("offlineInfo");
      return;
    }
    setWizard({ aberto: true, espId });
  };

  const NavBtn = ({ id, icon, label, badge }: { id: typeof tab; icon: React.ReactNode; label: string; badge?: number }) => (
    <button onClick={() => { setTab(id); setWizard({ aberto: false }); }} aria-label={label}
      className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors ${tab === id ? "text-jade font-extrabold" : "text-ink/40 hover:text-ink/70"}`}>
      <span className="relative">
        {icon}
        {!!badge && <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 font-mono text-[8.5px] font-bold text-paper">{badge}</span>}
      </span>
      <span className={`font-bold ${isTxtLarge ? "text-[11.5px]" : "text-[9.5px]"} ${tab === id ? "" : "opacity-80"}`}>{label}</span>
      <span className={`h-1 w-6 rounded-full transition-all ${tab === id ? "bg-jade" : "bg-transparent"}`} />
    </button>
  );

  return (
    <div className={`relative mx-auto w-full max-w-[calc(100vw-2rem)] sm:max-w-[350px] ${simp ? "simp" : ""} ${isContrast ? "ring-4 ring-jade" : ""}`}>
      {/* moldura */}
      <div className="rounded-[2.2rem] border border-ink/20 bg-deep p-[7px] shadow-[0_36px_80px_-24px_rgba(10,33,28,0.55)] sm:rounded-[2.7rem] sm:p-[9px]">
        <div className="relative flex h-[550px] max-h-[76dvh] flex-col overflow-hidden rounded-[1.8rem] bg-paper sm:h-[630px] sm:max-h-[80dvh] sm:rounded-[2.15rem]">
          {/* notch + statusbar */}
          <div className="relative z-40 flex items-center justify-between bg-paper px-6 pb-1 pt-2.5">
            <span className="absolute left-1/2 top-1.5 h-4 w-20 -translate-x-1/2 rounded-full bg-deep sm:h-5 sm:w-24" />
            <span className="font-mono text-[10.5px] font-semibold">{pad(relogio.getHours())}:{pad(relogio.getMinutes())}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => dispatch({ t: "setOffline", offline: !state.offline })}
                title={state.offline ? "Modo Offline ativo (clique para ficar online)" : "Conexão ativa (clique para simular offline)"}
                className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[8.5px] font-bold ${state.offline ? "bg-coral text-paper" : "bg-jadesoft text-jadedark"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${state.offline ? "bg-paper" : "bg-jade pulse-dot"}`} />
                {state.offline ? "OFFLINE" : "4G"}
              </button>
              <span className="flex items-center gap-1 text-ink/70">
                <svg viewBox="0 0 22 11" className="h-3 w-6" aria-hidden="true"><rect x="0.5" y="0.5" width="18" height="10" rx="2.5" fill="none" stroke="currentColor" /><rect x="2.5" y="2.5" width="12" height="6" rx="1" fill="currentColor" /><rect x="19.8" y="3.5" width="1.8" height="4" rx="0.8" fill="currentColor" /></svg>
              </span>
            </div>
          </div>

          {/* notificação pop */}
          {pop && (
            <div className="pop-in absolute left-3 right-3 top-9 z-40 rounded-2xl border border-line bg-paper/95 p-3 shadow-xl backdrop-blur">
              <div className="flex items-start gap-2.5">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-paper ${pop.tipo === "vaga" ? "bg-jade" : pop.tipo === "alerta" ? "bg-coral" : "bg-pine"}`}>
                  {pop.tipo === "vaga" ? <IcQueue className="h-4.5 w-4.5" /> : <IcBell className="h-4.5 w-4.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[12.5px] font-bold leading-tight">{pop.titulo}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-ink/65">{pop.texto}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pop.waitId && (() => {
                      const f = state.fila.find((x) => x.id === pop.waitId);
                      return f && f.status === "NOTIFICADO" ? (
                        <button onClick={() => { dispatch({ t: "confirmFila", waitId: f.id }); dispatch({ t: "toast", texto: "Vaga confirmada! Consulta adicionada. 🎉" }); setPop(null); setTab("consultas"); }}
                          className="rounded-lg bg-jade px-2.5 py-1 text-[10.5px] font-bold text-paper hover:bg-jadedark">
                          Confirmar vaga agora · {f.janelaRestante} min
                        </button>
                      ) : null;
                    })()}
                    {pop.tipo === "lembrete" && proxima && (
                      <>
                        <button onClick={() => { dispatch({ t: "confirmarPresenca", id: proxima.id }); dispatch({ t: "toast", texto: "Presença confirmada! Obrigado. ✓" }); setPop(null); }}
                          className="rounded-lg bg-jade px-2.5 py-1 text-[10px] font-bold text-paper">
                          Confirmar Presença
                        </button>
                        <button onClick={() => { setReagendando(proxima); setPop(null); }}
                          className="rounded-lg border border-line bg-cream px-2 py-1 text-[10px] font-bold text-ink/70">
                          Reagendar
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <button onClick={() => setPop(null)} aria-label="Dispensar" className="text-ink/40 hover:text-ink"><IcX className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          {/* telas */}
          <div className="relative flex-1 overflow-hidden">
            {tab === "home" && (
              <div className="thin-scroll h-full overflow-y-auto px-4 pb-4 screen-in">
                {state.offline && (
                  <div className="mt-2 flex items-center justify-between rounded-xl bg-coralsoft px-3 py-1.5 text-[11px] font-bold text-coral">
                    <span>📴 Modo Offline ativo</span>
                    <button onClick={() => setSheet("offlineInfo")} className="underline">O que funciona?</button>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <div>
                    <p className={`font-semibold text-ink/70 ${isTxtLarge ? "text-[14px]" : "text-[12px]"}`}>{saudacao()},</p>
                    <h2 className={`font-display font-extrabold leading-tight text-ink ${isTxtLarge ? "text-2xl" : "text-[21px]"}`}>{state.perfil.nome.split(" ").slice(0, 2).join(" ")}</h2>
                    <p className="deco mt-0.5 font-mono text-[9.5px] font-bold uppercase tracking-widest text-ink/60">
                      {fmtDataLonga(HOJE)}
                    </p>
                  </div>
                  <button onClick={() => setCadastroOpen(true)} title="Editar perfil"
                    className={`grid place-items-center rounded-2xl bg-pine font-display font-bold text-mint shadow-md hover:scale-105 ${isTxtLarge ? "h-13 w-13 text-base" : "h-10 w-10 text-xs"}`}>
                    {state.perfil.nome.split(" ").map((x) => x[0]).slice(0, 2).join("")}
                  </button>
                </div>

                {/* próxima consulta com ações diretas */}
                {proxima ? (
                  <div className={`mt-3.5 rounded-3xl bg-pine p-4 text-paper shadow-xl shadow-pine/25 ${isBtnLarge ? "p-5" : ""}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.22em] text-mint">Próxima consulta</p>
                      <div className="flex items-center gap-1.5">
                        {proxima.confirmada ? (
                          <span className="rounded-full bg-jade/40 border border-jade/50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-paper">✓ confirmada</span>
                        ) : (
                          <button onClick={() => { dispatch({ t: "confirmarPresenca", id: proxima.id }); dispatch({ t: "toast", texto: "Presença confirmada com sucesso! ✓" }); }}
                            className="rounded-full bg-amber px-2.5 py-0.5 font-mono text-[9px] font-black uppercase text-paper hover:brightness-110 shadow-sm">
                            ● confirmar presença
                          </button>
                        )}
                        {proxima.dataISO === HOJE && (
                          <span className="flex items-center gap-1 rounded-full bg-jade px-2 py-0.5 font-mono text-[8.5px] font-bold uppercase text-paper">
                            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-paper" /> hoje
                          </span>
                        )}
                      </div>
                    </div>
                    <p className={`mt-2 font-display font-bold leading-tight text-paper ${isTxtLarge ? "text-xl" : "text-[17px]"}`}>{medDe(proxima.medicoId)?.nome}</p>
                    <p className="text-[12px] font-medium text-mint">{espDe(proxima.medicoId)?.nome} · {medDe(proxima.medicoId)?.unidade || "Unidade Central"}</p>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className={`font-mono font-extrabold text-mint ${isTxtLarge ? "text-2xl" : "text-[23px]"}`}>{proxima.hora}</p>
                        <p className="text-[11.5px] font-semibold capitalize text-mint/90">{fmtDataMedia(proxima.dataISO)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[9.5px] font-bold text-mint/80">protocolo</p>
                        <p className="font-mono text-[12px] font-extrabold text-mint">{proxima.protocolo}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                      <button onClick={() => { setSelAg(proxima); setSheet("comprovante"); }}
                        className={`rounded-xl bg-paper/20 py-2.5 font-extrabold text-paper backdrop-blur transition-colors hover:bg-paper/30 ${isTxtLarge ? "text-[13px]" : "text-[11.5px]"}`}>Comprovante</button>
                      <button onClick={() => setReagendando(proxima)}
                        className={`rounded-xl bg-paper/20 py-2.5 font-extrabold text-paper backdrop-blur transition-colors hover:bg-paper/30 ${isTxtLarge ? "text-[13px]" : "text-[11.5px]"}`}>Reagendar</button>
                      <button onClick={() => pedirCancelamento(proxima)}
                        className={`rounded-xl bg-coral/30 border border-coral/60 py-2.5 font-extrabold text-paper transition-colors hover:bg-coral/50 ${isTxtLarge ? "text-[13px]" : "text-[11.5px]"}`}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3.5 rounded-3xl border border-dashed border-line bg-cream/70 p-4 text-center">
                    <p className={`font-display font-bold text-ink ${isTxtLarge ? "text-lg" : "text-[15px]"}`}>Nenhuma consulta futura</p>
                    <p className="text-[12px] font-medium text-ink/70">Que tal marcar uma agora?</p>
                  </div>
                )}

                {/* fila de espera */}
                {minhaFila.length > 0 && (
                  <div className="mt-2.5 rounded-2xl border border-amber/50 bg-ambersoft p-3">
                    <p className="flex items-center gap-1.5 font-display text-[12.5px] font-bold text-ink"><IcQueue className="h-4 w-4 text-amber" /> Fila de espera viva (RN02)</p>
                    {minhaFila.map((f) => (
                      <div key={f.id} className="mt-1.5 flex items-center justify-between text-[11.5px]">
                        <span className="font-semibold text-ink/80">{fmtDataMedia(f.dataISO)} · {medDe(f.medicoId)?.nome}</span>
                        {f.status === "NOTIFICADO" ? (
                          <button onClick={() => { dispatch({ t: "confirmFila", waitId: f.id }); dispatch({ t: "toast", texto: "Vaga confirmada! 🎉" }); setTab("consultas"); }}
                            className="rounded-lg bg-jade px-2.5 py-1 font-bold text-paper shadow-sm hover:bg-jadedark">Confirmar · {f.janelaRestante} min</button>
                        ) : (
                          <span className="font-mono font-bold text-amber">{f.posicao}º na fila</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ações principais */}
                {simp ? (
                  <div className="mt-4 space-y-2.5">
                    <button onClick={() => abrirAgendamento()}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-jade py-4 font-display text-lg font-extrabold text-paper shadow-lg shadow-jade/30 active:scale-[0.98]">
                      <IcPlus className="h-5 w-5" /> AGENDAR CONSULTA
                    </button>
                    {proxima && (
                      <button onClick={() => setReagendando(proxima)}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-pine bg-paper py-4 font-display text-lg font-extrabold text-pine active:scale-[0.98]">
                        <IcClock className="h-5 w-5" /> REAGENDAR CONSULTA
                      </button>
                    )}
                    <button onClick={() => setTab("chat")}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-pine bg-paper py-4 font-display text-lg font-extrabold text-pine active:scale-[0.98]">
                      <IcChat className="h-5 w-5" /> FALAR COM A LIA (IA)
                    </button>
                    <button onClick={() => setTab("consultas")}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-cream py-3 font-display text-base font-bold text-ink">
                      <IcCalendar className="h-5 w-5" /> MINHAS CONSULTAS
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button onClick={() => abrirAgendamento()}
                        className={`flex items-center justify-center gap-1.5 rounded-2xl bg-jade py-3 font-display text-[13px] font-bold text-paper shadow-lg shadow-jade/25 transition-all hover:-translate-y-0.5 hover:bg-jadedark ${isBtnLarge ? "py-4 text-[14px]" : ""}`}>
                        <IcPlus className="h-4.5 w-4.5" /> Nova consulta
                      </button>
                      <button onClick={() => setTab("chat")}
                        className={`flex items-center justify-center gap-1.5 rounded-2xl border-2 border-pine/70 bg-paper py-3 font-display text-[13px] font-bold text-pine transition-all hover:-translate-y-0.5 hover:bg-jadedoft ${isBtnLarge ? "py-4 text-[14px]" : ""}`}>
                        <IcSpark className="h-4.5 w-4.5" /> Secretária IA
                      </button>
                    </div>
                    <p className="mt-3.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-ink/60">Especialidades rápidas</p>
                    <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
                      {ESPECIALIDADES.map((e) => {
                        const Icon = ESP_ICON[e.id];
                        return (
                          <button key={e.id} onClick={() => abrirAgendamento(e.id)}
                            className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-paper py-2 pl-2 pr-3.5 text-[12.5px] font-bold text-ink shadow-sm transition-all hover:-translate-y-0.5 hover:border-jade/60 hover:shadow-md">
                            <span className="grid h-6 w-6 place-items-center rounded-full text-paper" style={{ background: e.cor }}><Icon className="h-3.5 w-3.5" /></span>
                            {e.nome}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === "chat" && <div className="h-full screen-in"><Chat /></div>}

            {tab === "consultas" && (
              <div className="thin-scroll h-full overflow-y-auto px-4 pb-4 screen-in">
                <h2 className={`pt-2 font-display font-extrabold text-ink ${isTxtLarge ? "text-2xl" : "text-[20px]"}`}>Minhas consultas</h2>
                <div className="mt-2.5 flex rounded-xl border border-line bg-cream p-1">
                  {([["prox", "Próximas"], ["hist", "Histórico"], ["rel", "Relatórios"]] as const).map(([k, l]) => (
                    <button key={k} onClick={() => setSeg(k)}
                      className={`flex-1 rounded-lg py-1.5 font-bold transition-colors ${seg === k ? "bg-pine text-paper shadow-sm" : "text-ink/70 hover:text-ink"} ${isTxtLarge ? "text-[14px]" : "text-[12px]"}`}>{l}</button>
                  ))}
                </div>

                {seg === "prox" && (
                  <div className="mt-3 space-y-2">
                    {state.ags.filter((a) => a.voce && a.status === "AGENDADO").sort((a, b) => `${a.dataISO}${a.hora}`.localeCompare(`${b.dataISO}${b.hora}`)).map((a) => {
                      const trancada = !podeCancelar(a);
                      return (
                        <div key={a.id} className="pop-in flex gap-3 rounded-2xl border border-line bg-paper p-3 shadow-sm">
                          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-jadesoft text-center">
                            <div><p className="font-mono text-[17px] font-extrabold leading-none text-jadedark">{a.dataISO.slice(8)}</p><p className="font-mono text-[9px] font-bold uppercase text-jadedark/80">{MESES_CURTO[+a.dataISO.slice(5, 7) - 1]}</p></div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`font-display font-bold leading-tight text-ink ${isTxtLarge ? "text-[16px]" : "text-[13.5px]"}`}>{medDe(a.medicoId)?.nome}</p>
                            <p className="text-[11px] font-medium text-ink/70">{espDe(a.medicoId)?.nome} · {a.hora} · <span className="font-mono font-bold text-ink">{a.protocolo}</span></p>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wide ${a.dataISO === HOJE ? "bg-jadesoft text-jadedark border border-jade/30" : "bg-cream text-ink/75 border border-line"}`}>
                                <IcClock className="h-3 w-3" /> {a.dataISO === HOJE ? "hoje" : fmtDataMedia(a.dataISO)}
                              </span>
                              {a.confirmada && <span className="rounded-full bg-jadesoft border border-jade/40 px-2 py-0.5 font-mono text-[9.5px] font-bold text-jadedark">✓ confirmada</span>}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <button onClick={() => { setSelAg(a); setSheet("comprovante"); }} className="rounded-lg border border-line px-2.5 py-1 text-[10.5px] font-bold text-ink/80 hover:bg-cream">Comprovante</button>
                              <button onClick={() => setReagendando(a)} className="rounded-lg border border-line px-2.5 py-1 text-[10.5px] font-bold text-ink/80 hover:bg-cream">Reagendar</button>
                              <button onClick={() => pedirCancelamento(a)}
                                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10.5px] font-bold ${trancada ? "bg-coralsoft text-coral border border-coral/30" : "border border-coral/50 text-coral hover:bg-coralsoft"}`}>
                                {trancada && <IcLock className="h-3 w-3" />} {trancada ? `< 30 min` : "Cancelar"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {state.ags.filter((a) => a.voce && a.status === "AGENDADO").length === 0 && (
                      <p className="py-6 text-center text-[12.5px] font-medium text-ink/65">Nenhuma consulta futura. Marque uma na aba Início! 💚</p>
                    )}
                  </div>
                )}

                {seg === "hist" && (
                  <div className="mt-3 space-y-2">
                    {historico.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-3 shadow-sm">
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${a.status === "CONCLUIDO" ? "bg-jadesoft text-jade border border-jade/30" : a.status === "NAO_COMPARECEU" ? "bg-coralsoft text-coral border border-coral/30" : "bg-cream text-ink/60 border border-line"}`}>
                          {a.status === "CONCLUIDO" ? <IcCheck className="h-4.5 w-4.5" /> : a.status === "NAO_COMPARECEU" ? <IcAlert className="h-4.5 w-4.5" /> : <IcX className="h-4.5 w-4.5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold leading-tight text-ink">{medDe(a.medicoId)?.nome}</p>
                          <p className="font-mono text-[10.5px] font-semibold text-ink/70">{fmtDataMedia(a.dataISO)} · {a.hora}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase ${a.status === "CONCLUIDO" ? "bg-jadesoft text-jadedark border border-jade/30" : a.status === "NAO_COMPARECEU" ? "bg-coralsoft text-coral border border-coral/30" : "bg-cream text-ink/70 border border-line"}`}>
                          {a.status === "CONCLUIDO" ? "realizada" : a.status === "NAO_COMPARECEU" ? "faltou" : "cancelada"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {seg === "rel" && (
                  <div className="mt-3 space-y-2">
                    {historico.filter((a) => a.relatorio).map((a) => (
                      <button key={a.id} onClick={() => { setSelAg(a); setSheet("relatorio"); }}
                        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper p-3 text-left transition-all hover:-translate-y-0.5 hover:border-jade/50 hover:shadow-md">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-steelsoft text-steel border border-steel/30"><IcDoc className="h-5 w-5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-bold leading-tight text-ink">{a.relatorio!.titulo}</span>
                          <span className="block font-mono text-[10px] font-semibold text-ink/70">{medDe(a.medicoId)?.nome} · {a.relatorio!.emissao}</span>
                        </span>
                        <IcChevR className="h-4 w-4 shrink-0 text-ink/40" />
                      </button>
                    ))}
                    {historico.filter((a) => a.relatorio).length === 0 && (
                      <p className="py-6 text-center text-[12.5px] font-medium text-ink/65">Relatórios dos seus atendimentos aparecem aqui.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "ajustes" && (
              <div className="thin-scroll h-full overflow-y-auto px-4 pb-4 screen-in">
                <h2 className={`pt-2 font-display font-extrabold text-ink ${isTxtLarge ? "text-2xl" : "text-[20px]"}`}>Ajustes & Perfil</h2>
                
                {/* Perfil card com botão para abrir cadastro */}
                <div className="mt-2.5 flex items-center justify-between rounded-2xl border border-line bg-paper p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-pine font-display font-bold text-mint shadow-sm">
                      {state.perfil.nome.split(" ").map((x) => x[0]).slice(0, 2).join("")}
                    </span>
                    <div>
                      <p className="text-[13.5px] font-bold text-ink">{state.perfil.nome}</p>
                      <p className="font-mono text-[10.5px] font-semibold text-ink/70">CPF {state.perfil.cpf} · {state.perfil.plano}</p>
                    </div>
                  </div>
                  <button onClick={() => setCadastroOpen(true)} className="grid h-8 w-8 place-items-center rounded-xl border border-line bg-cream hover:bg-jadesoft text-ink shadow-sm" title="Editar cadastro em etapas">
                    <IcEdit className="h-4 w-4" />
                  </button>
                </div>

                {/* Preferências de acessibilidade combináveis */}
                <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-ink/70">Acessibilidade Combinável</p>
                <div className="mt-2 space-y-1.5">
                  {([
                    ["textoMaior", "Texto Maior", acc.textoMaior],
                    ["altoContraste", "Alto Contraste", acc.altoContraste],
                    ["botoesGrandes", "Botões Grandes", acc.botoesGrandes],
                    ["respostasFaladas", "Respostas Faladas (TTS)", acc.respostasFaladas],
                    ["modoSimplificado", "Modo Simplificado", acc.modoSimplificado],
                  ] as const).map(([k, label, ativo]) => (
                    <button key={k} onClick={() => dispatch({ t: "setAccessibility", key: k, val: !ativo })}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all ${ativo ? "border-jade bg-jadesoft text-jadedark font-bold shadow-sm" : "border-line bg-paper text-ink font-semibold hover:bg-cream"}`}>
                      <span className="text-[12.5px]">{label}</span>
                      <span className={`h-4 w-4 rounded border grid place-items-center ${ativo ? "border-jade bg-jade text-paper" : "border-line bg-paper"}`}>
                        {ativo && <IcCheck className="h-3 w-3" />}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Lembretes configuráveis */}
                <div className="mt-4 flex items-center justify-between">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-ink/70">Configurar Lembretes</p>
                  <button onClick={() => setLembreteSheet(true)} className="text-[11px] font-bold text-jade hover:underline">configurar</button>
                </div>
                <div className="mt-1.5 rounded-xl border border-line bg-cream p-2.5 text-[12px] text-ink/85">
                  <p>Lembretes: <strong>24h</strong>, <strong>2h antes</strong> e <strong>no dia</strong> via {state.lembretes.canalWhatsapp ? "WhatsApp e App" : "App"}.</p>
                </div>

                {/* Notificações recentes */}
                <div className="mt-4 flex items-center justify-between">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-ink/70">Notificações</p>
                  <button onClick={() => dispatch({ t: "markLidas" })} className="text-[11px] font-bold text-jade hover:underline">marcar lidas</button>
                </div>
                <div className="mt-1.5 space-y-2">
                  {state.notifs.map((n) => {
                    const f = n.waitId ? state.fila.find((x) => x.id === n.waitId) : undefined;
                    return (
                      <div key={n.id} className={`rounded-2xl border p-3 shadow-sm ${n.lida ? "border-line bg-paper text-ink" : "border-jade/60 bg-jadesoft text-jadedark font-semibold"}`}>
                        <div className="flex items-start gap-2">
                          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.lida ? "bg-ink/30" : "bg-jade pulse-dot"}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[12.5px] font-bold leading-tight">{n.titulo}</p>
                            <p className="mt-0.5 text-[11px] leading-snug text-ink/75">{n.texto}</p>
                            {f && f.status === "NOTIFICADO" && f.voce && (
                              <button onClick={() => { dispatch({ t: "confirmFila", waitId: f.id }); dispatch({ t: "toast", texto: "Vaga confirmada! 🎉" }); }}
                                className="mt-1.5 rounded-lg bg-jade px-3 py-1.5 text-[11px] font-bold text-paper hover:bg-jadedark shadow-sm">
                                Confirmar vaga · restam {f.janelaRestante} min
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="deco mt-4 rounded-xl border border-dashed border-line bg-cream/70 p-2.5 text-center font-mono text-[9.5px] font-semibold text-ink/65">
                  IA inteligente (Kimi) · atendimento humanizado · v1.0
                </p>
              </div>
            )}

            {wizard.aberto && <Wizard espInicial={wizard.espId} onClose={() => setWizard({ aberto: false })} gotoConsultas={() => setTab("consultas")} />}
            {reagendando && (
              <Sheet titulo="Reagendar Consulta" onClose={() => setReagendando(null)}>
                <ReagendarWizard ag={reagendando} onClose={() => setReagendando(null)} />
              </Sheet>
            )}
            {cadastroOpen && <CadastroModal onClose={() => setCadastroOpen(false)} />}
            {lembreteSheet && (
              <Sheet titulo="Lembretes de Consulta" onClose={() => setLembreteSheet(false)}>
                <div className="space-y-3">
                  <p className="text-[12.5px] text-ink/70">Escolha quando e por onde você deseja receber seus alertas:</p>
                  <div className="space-y-2">
                    {[
                      ["aviso24h", "24 horas antes da consulta"],
                      ["aviso2h", "2 horas antes da consulta"],
                      ["avisoDia", "No dia pela manhã"],
                      ["canalApp", "Notificação Push no App"],
                      ["canalWhatsapp", "Mensagem via WhatsApp"],
                      ["canalSMS", "Alerta via SMS"],
                    ].map(([key, label]) => {
                      const k = key as keyof LembreteConfig;
                      const on = state.lembretes[k];
                      return (
                        <button key={key} onClick={() => dispatch({ t: "setLembretes", lembretes: { [k]: !on } })}
                          className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left ${on ? "border-jade bg-jadesoft text-jadedark font-bold" : "border-line bg-paper"}`}>
                          <span className="text-[12px]">{label}</span>
                          <span className={`h-4 w-4 rounded border grid place-items-center ${on ? "border-jade bg-jade text-paper" : "border-line"}`}>
                            {on && <IcCheck className="h-3 w-3" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => { dispatch({ t: "toast", texto: "Preferências de lembrete salvas ✓" }); setLembreteSheet(false); }}
                    className="w-full rounded-xl bg-pine py-3 text-[13px] font-bold text-paper hover:bg-jade">
                    Salvar Preferências
                  </button>
                </div>
              </Sheet>
            )}

            {/* sheets */}
            {sheet === "offlineInfo" && (
              <Sheet titulo="Modo Offline" onClose={() => setSheet(null)}>
                <div className="space-y-3 text-[12.5px] leading-relaxed">
                  <div className="rounded-2xl border border-coral/40 bg-coralsoft p-3">
                    <p className="font-bold text-coral">📴 O que necessita de conexão:</p>
                    <p className="mt-1 text-ink/70">Novos agendamentos, remarcações e cancelamentos precisam sincronizar com o banco da clínica para evitar conflitos (RN03).</p>
                  </div>
                  <div className="rounded-2xl border border-jade/40 bg-jadesoft p-3">
                    <p className="font-bold text-jadedark">✓ O que continua funcionando offline:</p>
                    <p className="mt-1 text-ink/70">Consultas previamente sincronizadas, comprovantes salvos, relatórios e leitor de tela/áudio local.</p>
                  </div>
                  <button onClick={() => { dispatch({ t: "setOffline", offline: false }); setSheet(null); dispatch({ t: "toast", texto: "Conectado novamente! Dados sincronizados." }); }}
                    className="w-full rounded-xl bg-jade py-3 text-[13px] font-bold text-paper">
                    Reconectar agora (Ficar Online)
                  </button>
                </div>
              </Sheet>
            )}

            {sheet === "comprovante" && selAg && (
              <Sheet titulo="Comprovante" onClose={() => setSheet(null)}>
                <div className="text-center">
                  <FakeQR seed={selAg.protocolo} className="mx-auto h-32 w-32" />
                  <p className="mt-2 font-mono text-[12px] font-bold text-jadedark">{selAg.protocolo}</p>
                </div>
                <div className="mt-3 space-y-1.5 rounded-2xl border border-dashed border-line bg-cream/60 p-3 text-[12px]">
                  <p className="flex justify-between"><span className="text-ink/55">Paciente</span><strong>{selAg.paciente}</strong></p>
                  <p className="flex justify-between"><span className="text-ink/55">Profissional</span><strong>{medDe(selAg.medicoId)?.nome}</strong></p>
                  <p className="flex justify-between"><span className="text-ink/55">Data</span><strong className="capitalize">{fmtDataLonga(selAg.dataISO)}</strong></p>
                  <p className="flex justify-between"><span className="text-ink/55">Horário</span><strong>{selAg.hora}</strong></p>
                  <p className="flex justify-between"><span className="text-ink/55">Atendimento</span><strong>{selAg.tipo === "CONVENIO" ? `Convênio · ${selAg.carteirinha ?? state.perfil.plano}` : `Particular · ${fmtBRL(medDe(selAg.medicoId)?.valor ?? 0)}`}</strong></p>
                </div>
                <button onClick={() => { dispatch({ t: "toast", texto: "Comprovante salvo no celular", tom: "info" }); setSheet(null); }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-pine py-3 text-[13px] font-bold text-paper hover:bg-jade">
                  <IcDownload className="h-4.5 w-4.5" /> Salvar no celular
                </button>
              </Sheet>
            )}

            {sheet === "relatorio" && selAg?.relatorio && (
              <Sheet titulo={selAg.relatorio.titulo} onClose={() => setSheet(null)}>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">{medDe(selAg.medicoId)?.nome} · {selAg.relatorio.emissao}</p>
                <p className="mt-2.5 text-[13px] leading-relaxed text-ink/80">{selAg.relatorio.texto}</p>
                <button onClick={() => { dispatch({ t: "toast", texto: "Download do PDF iniciado (demo)", tom: "info" }); setSheet(null); }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-pine py-3 text-[13px] font-bold text-paper hover:bg-jade">
                  <IcDownload className="h-4.5 w-4.5" /> Baixar PDF
                </button>
              </Sheet>
            )}

            {sheet === "cancelar" && selAg && (
              <Sheet titulo="Cancelar consulta?" onClose={() => setSheet(null)}>
                <p className="text-[13px] leading-relaxed text-ink/75">
                  <strong>{medDe(selAg.medicoId)?.nome}</strong> · {fmtDataLonga(selAg.dataISO)} às {selAg.hora}.
                  A vaga será oferecida imediatamente ao 1º da fila de espera.
                </p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setSheet(null)} className="flex-1 rounded-2xl border border-line py-3 text-[13px] font-bold text-ink/70 hover:bg-cream">Manter</button>
                  <button onClick={() => { dispatch({ t: "cancelAg", id: selAg.id }); dispatch({ t: "toast", texto: "Consulta cancelada. Vaga repassada à fila.", tom: "info" }); setSheet(null); }}
                    className="flex-1 rounded-2xl bg-coral py-3 text-[13px] font-bold text-paper hover:brightness-110">Cancelar consulta</button>
                </div>
              </Sheet>
            )}

            {sheet === "bloqueado" && selAg && (
              <Sheet titulo="Cancelamento bloqueado" onClose={() => setSheet(null)}>
                <div className="rounded-2xl border-2 border-coral/50 bg-coralsoft p-3.5">
                  <p className="flex items-center gap-2 font-display text-[13.5px] font-bold text-coral"><IcLock className="h-5 w-5" /> Regra RN01 · Trava de 30 minutos</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink/75">
                    Faltam menos de <strong>{MIN_CANCEL} minutos</strong> para a consulta de <strong>{fmtDataMedia(selAg.dataISO)} às {selAg.hora}</strong>.
                    O cancelamento automático está bloqueado para proteger a agenda do profissional.
                  </p>
                </div>
                <a href="tel:+551140028922" className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-pine py-3 text-[13px] font-bold text-paper hover:bg-jade">
                  <IcPhone className="h-4.5 w-4.5" /> Ligar para a recepção
                </a>
                <p className="mt-2 text-center font-mono text-[10px] text-ink/45">(11) 4002-8922 · atendimento humano</p>
              </Sheet>
            )}
          </div>

          {/* navegação */}
          <nav className="z-10 flex border-t border-line bg-paper/95 px-1 pb-2.5 pt-1 backdrop-blur">
            <NavBtn id="home" label="Início" icon={<IcCalendar className="h-5 w-5" />} />
            <NavBtn id="chat" label="Lia IA" icon={<IcChat className="h-5 w-5" />} />
            <NavBtn id="consultas" label="Consultas" icon={<IcDoc className="h-5 w-5" />} />
            <NavBtn id="ajustes" label="Ajustes" icon={<IcGear className="h-5 w-5" />} badge={naoLidas} />
          </nav>
        </div>
      </div>
    </div>
  );
}

