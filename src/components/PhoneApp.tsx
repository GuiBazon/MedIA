import React, { useEffect, useMemo, useRef, useState } from "react";
import { useClinic, podeCancelar } from "../store";
import {
  Agendamento, DayStatus, ESPECIALIDADES, MESES, MESES_CURTO, MIN_CANCEL, Notif, dayStatus, diaSemanaDe, fmtBRL,
  fmtDataLonga, fmtDataMedia, hashStr, HOJE, isBusyExterno, minutesUntil, pad, slotsDoDia,
} from "../data";
import Chat from "./Chat";
import { FakeQR } from "./ui";
import {
  IcAlert, IcBack, IcBell, IcBone, IcCalendar, IcChat, IcCheck, IcChevD, IcChevL, IcChevR, IcClinica, IcClock,
  IcDoc, IcDownload, IcGear, IcHeart, IcIdCard, IcKid, IcLock, IcPhone, IcPlus, IcQueue, IcSkin, IcSpark, IcTooth, IcWallet, IcX,
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
    <div className="pop-in w-full rounded-t-3xl border-t border-line bg-paper p-4 pb-6 shadow-2xl" style={{ maxHeight: "82%" }}>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-display text-base font-bold">{titulo}</h4>
        <button onClick={onClose} aria-label="Fechar" className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink/60 hover:bg-cream"><IcX className="h-4 w-4" /></button>
      </div>
      <div className="thin-scroll overflow-y-auto" style={{ maxHeight: "calc(82vh - 120px)" }}>{children}</div>
    </div>
  </div>
);

/* ================= wizard de agendamento ================= */
type WStep = "esp" | "doc" | "cal" | "hora" | "pag" | "ok";
const Wizard = ({ espInicial, onClose, gotoConsultas }: { espInicial?: number; onClose: () => void; gotoConsultas: () => void }) => {
  const { state, dispatch } = useClinic();
  const simp = state.mode === "SIMPLIFICADO";
  const [step, setStep] = useState<WStep>(espInicial ? "doc" : "esp");
  const [espId, setEspId] = useState<number | null>(espInicial ?? null);
  const [medicoId, setMedicoId] = useState<number | null>(null);
  const [mesOff, setMesOff] = useState(0);
  const [dataISO, setDataISO] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"CONVENIO" | "PARTICULAR" | null>(null);
  const [cart, setCart] = useState("");
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
        id: Date.now(), paciente: "Maria Aparecida", voce: true, medicoId: med.id, dataISO, hora, tipo,
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
                <span className="block font-mono text-[10px] text-ink/50">{med.crm} · {esp.nome}</span>
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
                  <span className="block text-[11px] text-ink/55">Plano Vida+ ativo no seu cadastro</span>
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
                <p className="text-ink/60">{tipo === "CONVENIO" ? "Convênio Vida+" : `Particular · ${fmtBRL(med.valor)}`}</p>
              </div>
            </div>
            <p className="mt-2.5 text-[11px] text-ink/55">Lembrete automático 24h e 1h antes. 📲</p>
            <button onClick={() => { onClose(); gotoConsultas(); }} className="mt-3 w-full rounded-2xl bg-pine py-3 font-display text-[13.5px] font-bold text-paper hover:bg-jade">Ver minhas consultas</button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ================= app do paciente ================= */
export default function PhoneApp() {
  const { state, dispatch } = useClinic();
  const simp = state.mode === "SIMPLIFICADO";
  const [tab, setTab] = useState<"home" | "chat" | "consultas" | "ajustes">("home");
  const [wizard, setWizard] = useState<{ aberto: boolean; espId?: number }>({ aberto: false });
  const [sheet, setSheet] = useState<"comprovante" | "relatorio" | "cancelar" | "bloqueado" | null>(null);
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
      const t = setTimeout(() => setPop(null), 5200);
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
    setSelAg(ag);
    setSheet(podeCancelar(ag) ? "cancelar" : "bloqueado");
  };

  const NavBtn = ({ id, icon, label, badge }: { id: typeof tab; icon: React.ReactNode; label: string; badge?: number }) => (
    <button onClick={() => { setTab(id); setWizard({ aberto: false }); }} aria-label={label}
      className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors ${tab === id ? "text-jade" : "text-ink/40 hover:text-ink/70"}`}>
      <span className="relative">
        {icon}
        {!!badge && <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 font-mono text-[8.5px] font-bold text-paper">{badge}</span>}
      </span>
      <span className={`font-bold ${simp ? "text-[11.5px]" : "text-[9.5px]"} ${tab === id ? "" : "opacity-80"}`}>{label}</span>
      <span className={`h-1 w-6 rounded-full transition-all ${tab === id ? "bg-jade" : "bg-transparent"}`} />
    </button>
  );

  return (
    <div className={`relative mx-auto w-full max-w-[350px] ${simp ? "simp" : ""}`}>
      {/* moldura */}
      <div className="rounded-[2.7rem] border border-ink/20 bg-deep p-[9px] shadow-[0_36px_80px_-24px_rgba(10,33,28,0.55)]">
        <div className="relative flex h-[min(600px,78dvh)] flex-col overflow-hidden rounded-[2.15rem] bg-paper sm:h-[min(640px,80dvh)]">
          {/* notch + statusbar */}
          <div className="relative z-40 flex items-center justify-between bg-paper px-6 pb-1 pt-2.5">
            <span className="absolute left-1/2 top-1.5 h-5 w-24 -translate-x-1/2 rounded-full bg-deep" />
            <span className="font-mono text-[10.5px] font-semibold">{pad(relogio.getHours())}:{pad(relogio.getMinutes())}</span>
            <span className="flex items-center gap-1.5 text-ink/70">
              <svg viewBox="0 0 14 10" className="h-2.5 w-3.5" fill="currentColor" aria-hidden="true"><rect x="0" y="6" width="2.4" height="4" rx="0.6" /><rect x="3.6" y="4" width="2.4" height="6" rx="0.6" /><rect x="7.2" y="2" width="2.4" height="8" rx="0.6" /><rect x="10.8" y="0" width="2.4" height="10" rx="0.6" /></svg>
              <svg viewBox="0 0 22 11" className="h-3 w-6" aria-hidden="true"><rect x="0.5" y="0.5" width="18" height="10" rx="2.5" fill="none" stroke="currentColor" /><rect x="2.5" y="2.5" width="12" height="6" rx="1" fill="currentColor" /><rect x="19.8" y="3.5" width="1.8" height="4" rx="0.8" fill="currentColor" /></svg>
            </span>
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
                  {pop.waitId && (() => {
                    const f = state.fila.find((x) => x.id === pop.waitId);
                    return f && f.status === "NOTIFICADO" ? (
                      <button onClick={() => { dispatch({ t: "confirmFila", waitId: f.id }); dispatch({ t: "toast", texto: "Vaga confirmada! Consulta adicionada. 🎉" }); setPop(null); setTab("consultas"); }}
                        className="mt-1.5 rounded-lg bg-jade px-3 py-1.5 text-[11px] font-bold text-paper hover:bg-jadedark">
                        Confirmar vaga agora · restam {f.janelaRestante} min
                      </button>
                    ) : null;
                  })()}
                </div>
                <button onClick={() => setPop(null)} aria-label="Dispensar" className="text-ink/40 hover:text-ink"><IcX className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          {/* telas */}
          <div className="relative flex-1 overflow-hidden">
            {tab === "home" && (
              <div className="thin-scroll h-full overflow-y-auto px-4 pb-4 screen-in">
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <p className={`text-ink/55 ${simp ? "text-[15px]" : "text-[12px]"}`}>{saudacao()},</p>
                    <h2 className={`font-display font-extrabold leading-tight ${simp ? "text-3xl" : "text-[22px]"}`}>Maria Aparecida</h2>
                    <p className="deco mt-0.5 font-mono text-[9.5px] uppercase tracking-widest text-ink/40">
                      {fmtDataLonga(HOJE)}
                    </p>
                  </div>
                  <span className={`grid place-items-center rounded-2xl bg-pine font-display font-bold text-mint ${simp ? "h-14 w-14 text-lg" : "h-11 w-11 text-sm"}`}>MA</span>
                </div>

                {/* próxima consulta */}
                {proxima ? (
                  <div className={`mt-3.5 rounded-3xl bg-pine p-4 text-paper shadow-lg shadow-pine/25 ${simp ? "p-5" : ""}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-mintdark">Próxima consulta</p>
                      {proxima.dataISO === HOJE && (
                        <span className="flex items-center gap-1.5 rounded-full bg-jade/25 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-mint">
                          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-jade" /> hoje
                        </span>
                      )}
                    </div>
                    <p className={`mt-2 font-display font-bold leading-tight ${simp ? "text-2xl" : "text-[16.5px]"}`}>{medDe(proxima.medicoId)?.nome}</p>
                    <p className="text-[11.5px] text-mint/75">{espDe(proxima.medicoId)?.nome}{proxima.encaixe ? " · encaixe" : ""}</p>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className={`font-mono font-bold text-mint ${simp ? "text-3xl" : "text-[26px]"}`}>{proxima.hora}</p>
                        <p className="text-[11px] capitalize text-mint/75">{fmtDataMedia(proxima.dataISO)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[9px] text-mint/55">protocolo</p>
                        <p className="font-mono text-[11px] font-bold text-mint">{proxima.protocolo}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => { setSelAg(proxima); setSheet("comprovante"); }}
                        className={`flex-1 rounded-xl bg-paper/12 py-2.5 font-bold text-paper backdrop-blur transition-colors hover:bg-paper/25 ${simp ? "text-[15px]" : "text-[12px]"}`}>Comprovante</button>
                      <button onClick={() => pedirCancelamento(proxima)}
                        className={`flex-1 rounded-xl border border-mint/30 py-2.5 font-bold text-mint transition-colors hover:bg-paper/10 ${simp ? "text-[15px]" : "text-[12px]"}`}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3.5 rounded-3xl border border-dashed border-line bg-cream/60 p-4 text-center">
                    <p className={`font-display font-bold ${simp ? "text-lg" : "text-[14px]"}`}>Nenhuma consulta futura</p>
                    <p className="text-[11.5px] text-ink/55">Que tal marcar uma agora?</p>
                  </div>
                )}

                {/* fila de espera */}
                {minhaFila.length > 0 && (
                  <div className="mt-2.5 rounded-2xl border border-amber/50 bg-ambersoft p-3">
                    <p className="flex items-center gap-1.5 font-display text-[12px] font-bold text-ink"><IcQueue className="h-4 w-4 text-amber" /> Fila de espera</p>
                    {minhaFila.map((f) => (
                      <div key={f.id} className="mt-1.5 flex items-center justify-between text-[11px]">
                        <span className="text-ink/70">{fmtDataMedia(f.dataISO)} · {medDe(f.medicoId)?.nome}</span>
                        {f.status === "NOTIFICADO" ? (
                          <button onClick={() => { dispatch({ t: "confirmFila", waitId: f.id }); dispatch({ t: "toast", texto: "Vaga confirmada! 🎉" }); setTab("consultas"); }}
                            className="rounded-lg bg-jade px-2 py-1 font-bold text-paper">Confirmar · {f.janelaRestante} min</button>
                        ) : (
                          <span className="font-mono font-bold text-amber">{f.posicao}º na fila</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ações */}
                {simp ? (
                  <div className="mt-4 space-y-3">
                    <button onClick={() => setWizard({ aberto: true })}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-jade py-5 font-display text-xl font-extrabold text-paper shadow-lg shadow-jade/30 active:scale-[0.98]">
                      <IcPlus className="h-6 w-6" /> MARCAR CONSULTA
                    </button>
                    <button onClick={() => setTab("consultas")}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-pine bg-paper py-5 font-display text-xl font-extrabold text-pine active:scale-[0.98]">
                      <IcCalendar className="h-6 w-6" /> MINHAS CONSULTAS
                    </button>
                    <button onClick={() => setTab("chat")}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-pine bg-paper py-5 font-display text-xl font-extrabold text-pine active:scale-[0.98]">
                      <IcChat className="h-6 w-6" /> FALAR COM A LIA
                    </button>
                    <p className="rounded-2xl border-2 border-line bg-cream p-3 text-center text-[14px] font-bold">Prefere falar com uma pessoa? Ligue: (11) 4002-8922</p>
                  </div>
                ) : (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button onClick={() => setWizard({ aberto: true })}
                        className="flex items-center justify-center gap-1.5 rounded-2xl bg-jade py-3.5 font-display text-[13.5px] font-bold text-paper shadow-lg shadow-jade/25 transition-all hover:-translate-y-0.5 hover:bg-jadedark">
                        <IcPlus className="h-4.5 w-4.5" /> Nova consulta
                      </button>
                      <button onClick={() => setTab("chat")}
                        className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-pine/70 bg-paper py-3.5 font-display text-[13.5px] font-bold text-pine transition-all hover:-translate-y-0.5 hover:bg-jadesoft">
                        <IcSpark className="h-4.5 w-4.5" /> Secretária IA
                      </button>
                    </div>
                    <p className="mt-4 font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink/40">Agendar direto</p>
                    <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
                      {ESPECIALIDADES.map((e) => {
                        const Icon = ESP_ICON[e.id];
                        return (
                          <button key={e.id} onClick={() => setWizard({ aberto: true, espId: e.id })}
                            className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-paper py-2 pl-2 pr-3.5 text-[12px] font-bold transition-all hover:-translate-y-0.5 hover:border-jade/60 hover:shadow-md">
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
                <h2 className={`pt-2 font-display font-extrabold ${simp ? "text-2xl" : "text-[19px]"}`}>Minhas consultas</h2>
                <div className="mt-2.5 flex rounded-xl border border-line bg-cream p-1">
                  {([["prox", "Próximas"], ["hist", "Histórico"], ["rel", "Relatórios"]] as const).map(([k, l]) => (
                    <button key={k} onClick={() => setSeg(k)}
                      className={`flex-1 rounded-lg py-1.5 font-bold transition-colors ${seg === k ? "bg-pine text-paper" : "text-ink/50 hover:text-ink"} ${simp ? "text-[13.5px]" : "text-[11.5px]"}`}>{l}</button>
                  ))}
                </div>

                {seg === "prox" && (
                  <div className="mt-3 space-y-2">
                    {state.ags.filter((a) => a.voce && a.status === "AGENDADO").sort((a, b) => `${a.dataISO}${a.hora}`.localeCompare(`${b.dataISO}${b.hora}`)).map((a) => {
                      const trancada = !podeCancelar(a);
                      return (
                        <div key={a.id} className="pop-in flex gap-3 rounded-2xl border border-line bg-paper p-3 shadow-sm">
                          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-jadesoft text-center">
                            <div><p className="font-mono text-[16px] font-bold leading-none text-jadedark">{a.dataISO.slice(8)}</p><p className="font-mono text-[8.5px] uppercase text-jadedark/70">{MESES_CURTO[+a.dataISO.slice(5, 7) - 1]}</p></div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`font-display font-bold leading-tight ${simp ? "text-[15px]" : "text-[13px]"}`}>{medDe(a.medicoId)?.nome}</p>
                            <p className="text-[10.5px] text-ink/55">{espDe(a.medicoId)?.nome} · {a.hora} · <span className="font-mono">{a.protocolo}</span></p>
                            <p className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide ${a.dataISO === HOJE ? "bg-jadesoft text-jadedark" : "bg-cream text-ink/55"}`}>
                              <IcClock className="h-3 w-3" /> {a.dataISO === HOJE ? "hoje" : fmtDataMedia(a.dataISO)}
                            </p>
                            <div className="mt-2 flex gap-1.5">
                              <button onClick={() => { setSelAg(a); setSheet("comprovante"); }} className="rounded-lg border border-line px-2.5 py-1 text-[10.5px] font-bold text-ink/70 hover:bg-cream">Comprovante</button>
                              <button onClick={() => pedirCancelamento(a)}
                                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10.5px] font-bold ${trancada ? "bg-coralsoft text-coral" : "border border-coral/40 text-coral hover:bg-coralsoft"}`}>
                                {trancada && <IcLock className="h-3 w-3" />} {trancada ? `< 30 min` : "Cancelar"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {state.ags.filter((a) => a.voce && a.status === "AGENDADO").length === 0 && (
                      <p className="py-6 text-center text-[12px] text-ink/50">Nenhuma consulta futura. Marque uma na aba Início! 💚</p>
                    )}
                  </div>
                )}

                {seg === "hist" && (
                  <div className="mt-3 space-y-2">
                    {historico.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-3">
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${a.status === "CONCLUIDO" ? "bg-jadesoft text-jade" : a.status === "NAO_COMPARECEU" ? "bg-coralsoft text-coral" : "bg-cream text-ink/45"}`}>
                          {a.status === "CONCLUIDO" ? <IcCheck className="h-4.5 w-4.5" /> : a.status === "NAO_COMPARECEU" ? <IcAlert className="h-4.5 w-4.5" /> : <IcX className="h-4.5 w-4.5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-bold leading-tight">{medDe(a.medicoId)?.nome}</p>
                          <p className="font-mono text-[10px] text-ink/50">{fmtDataMedia(a.dataISO)} · {a.hora}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[8.5px] font-bold uppercase ${a.status === "CONCLUIDO" ? "bg-jadesoft text-jadedark" : a.status === "NAO_COMPARECEU" ? "bg-coralsoft text-coral" : "bg-cream text-ink/50"}`}>
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
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-steelsoft text-steel"><IcDoc className="h-5 w-5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12.5px] font-bold leading-tight">{a.relatorio!.titulo}</span>
                          <span className="block font-mono text-[9.5px] text-ink/50">{medDe(a.medicoId)?.nome} · {a.relatorio!.emissao}</span>
                        </span>
                        <IcChevR className="h-4 w-4 shrink-0 text-ink/30" />
                      </button>
                    ))}
                    {historico.filter((a) => a.relatorio).length === 0 && (
                      <p className="py-6 text-center text-[12px] text-ink/50">Relatórios dos seus atendimentos aparecem aqui.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "ajustes" && (
              <div className="thin-scroll h-full overflow-y-auto px-4 pb-4 screen-in">
                <h2 className={`pt-2 font-display font-extrabold ${simp ? "text-2xl" : "text-[19px]"}`}>Ajustes</h2>
                <div className="mt-2.5 flex items-center gap-3 rounded-2xl border border-line bg-paper p-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-pine font-display font-bold text-mint">MA</span>
                  <div><p className="text-[13.5px] font-bold">Maria Aparecida</p><p className="font-mono text-[10px] text-ink/50">CPF {`***.482.917-**`} · Vida+</p></div>
                </div>

                <p className="mt-4 font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink/40">Modo de interface</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([["PADRAO", "Padrão", "Visual completo da clínica"], ["SIMPLIFICADO", "Simplificado", "Letras grandes e alto contraste"]] as const).map(([m, t, d]) => (
                    <button key={m} onClick={() => { dispatch({ t: "setMode", mode: m }); dispatch({ t: "toast", texto: `Modo ${t} ativado`, tom: "info" }); }}
                      className={`rounded-2xl border-2 p-3 text-left transition-all ${state.mode === m ? "border-jade bg-jadesoft shadow-md" : "border-line bg-paper hover:border-jade/40"}`}>
                      <p className={`font-display font-bold ${simp ? "text-[15px]" : "text-[13px]"}`}>{t}</p>
                      <p className="mt-0.5 text-[10px] leading-snug text-ink/55">{d}</p>
                      {state.mode === m && <p className="mt-1.5 flex items-center gap-1 font-mono text-[9px] font-bold uppercase text-jade"><IcCheck className="h-3 w-3" /> ativo</p>}
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink/40">Notificações</p>
                  <button onClick={() => dispatch({ t: "markLidas" })} className="text-[10.5px] font-bold text-jade hover:underline">marcar lidas</button>
                </div>
                <div className="mt-2 space-y-2">
                  {state.notifs.map((n) => {
                    const f = n.waitId ? state.fila.find((x) => x.id === n.waitId) : undefined;
                    return (
                      <div key={n.id} className={`rounded-2xl border p-3 ${n.lida ? "border-line bg-paper" : "border-jade/50 bg-jadesoft/60"}`}>
                        <div className="flex items-start gap-2">
                          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.lida ? "bg-ink/20" : "bg-jade pulse-dot"}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-bold leading-tight">{n.titulo}</p>
                            <p className="mt-0.5 text-[10.5px] leading-snug text-ink/60">{n.texto}</p>
                            {f && f.status === "NOTIFICADO" && f.voce && (
                              <button onClick={() => { dispatch({ t: "confirmFila", waitId: f.id }); dispatch({ t: "toast", texto: "Vaga confirmada! 🎉" }); }}
                                className="mt-1.5 rounded-lg bg-jade px-3 py-1.5 text-[10.5px] font-bold text-paper hover:bg-jadedark">
                                Confirmar vaga · restam {f.janelaRestante} min
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="deco mt-4 rounded-xl border border-dashed border-line bg-cream/60 p-2.5 text-center font-mono text-[9px] text-ink/45">
                  IA 100% local (Ollama) · seus dados não saem da clínica · v1.0
                </p>
              </div>
            )}

            {wizard.aberto && <Wizard espInicial={wizard.espId} onClose={() => setWizard({ aberto: false })} gotoConsultas={() => setTab("consultas")} />}

            {/* sheets */}
            {sheet === "comprovante" && selAg && (
              <Sheet titulo="Comprovante" onClose={() => setSheet(null)}>
                <div className="text-center">
                  <FakeQR seed={selAg.protocolo} className="mx-auto h-32 w-32" />
                  <p className="mt-2 font-mono text-[12px] font-bold text-jadedark">{selAg.protocolo}</p>
                </div>
                <div className="mt-3 space-y-1.5 rounded-2xl border border-dashed border-line bg-cream/60 p-3 text-[12px]">
                  <p className="flex justify-between"><span className="text-ink/55">Paciente</span><strong>Maria Aparecida</strong></p>
                  <p className="flex justify-between"><span className="text-ink/55">Profissional</span><strong>{medDe(selAg.medicoId)?.nome}</strong></p>
                  <p className="flex justify-between"><span className="text-ink/55">Data</span><strong className="capitalize">{fmtDataLonga(selAg.dataISO)}</strong></p>
                  <p className="flex justify-between"><span className="text-ink/55">Horário</span><strong>{selAg.hora}</strong></p>
                  <p className="flex justify-between"><span className="text-ink/55">Atendimento</span><strong>{selAg.tipo === "CONVENIO" ? `Convênio · ${selAg.carteirinha ?? "Vida+"}` : `Particular · ${fmtBRL(medDe(selAg.medicoId)?.valor ?? 0)}`}</strong></p>
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
