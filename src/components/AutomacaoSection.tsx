import React, { useMemo, useState } from "react";
import { useClinic } from "../store";
import { HOJE, addDaysISO, fmtDataMedia, ESPECIALIDADES } from "../data";
import { Reveal, SectionHead, CountUp } from "./ui";
import { IcBell, IcPhone, IcChat, IcAlert, IcCalendar, IcQueue, IcDoc, IcCheck, IcEdit, IcClock } from "./icons";

const wave = (className?: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}><path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10v4M21 12h.5" /></svg>
);

/* ---------- confirmações + contato rápido ---------- */
const Confirmacoes = () => {
  const { state } = useClinic();
  const hoje = state.ags.filter((a) => a.dataISO === HOJE);
  const [feito, setFeito] = useState<Record<number, string>>({});
  const pendentes = hoje.filter((a) => a.status === "AGENDADO");
  const st = (a: typeof hoje[0]) => a.status === "CANCELADO" ? ["cancelada", "bg-coralsoft text-coral"] : a.status === "CONCLUIDO" ? ["concluída", "bg-jadesoft text-jadedark"] : feito[a.id] ? ["confirmada", "bg-jadesoft text-jadedark"] : ["aguardando", "bg-ambersoft text-ink"];
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-display text-[16px] font-extrabold"><IcBell className="h-5 w-5 text-amber" /> Confirmações do dia</p>
        <span className="rounded-full bg-ambersoft px-2.5 py-1 font-mono text-[10px] font-bold text-ink">{pendentes.length - Object.keys(feito).length} pendentes</span>
      </div>
      <div className="mt-4 space-y-2.5">
        {hoje.slice(0, 4).map((a) => {
          const [label, cls] = st(a);
          const med = state.medicos.find((m) => m.id === a.medicoId)?.nome ?? "";
          return (
            <div key={a.id} className="flex items-center gap-3 rounded-xl border border-line bg-cream px-3.5 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pine font-display text-[11px] font-extrabold text-mint">{a.paciente.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-extrabold">{a.paciente} <span className="font-mono text-[10px] font-normal text-ink/45">· {a.hora} {med.replace("Dra. ", "").replace("Dr. ", "")}</span></p>
                <span className={`inline-block rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${cls}`}>{label}</span>
              </div>
              {label === "aguardando" && (
                <div className="flex gap-1">
                  <button title="Enviar mensagem" aria-label={`Mensagem para ${a.paciente}`} onClick={() => setFeito((f) => ({ ...f, [a.id]: "msg" }))} className="grid h-8 w-8 place-items-center rounded-lg bg-steelsoft text-steel hover:scale-105"><IcChat className="h-4 w-4" /></button>
                  <button title="Ligar" aria-label={`Ligar para ${a.paciente}`} onClick={() => setFeito((f) => ({ ...f, [a.id]: "tel" }))} className="grid h-8 w-8 place-items-center rounded-lg bg-jadesoft text-jade hover:scale-105"><IcPhone className="h-4 w-4" /></button>
                </div>
              )}
              {label === "confirmada" && <IcCheck className="h-5 w-5 text-jade" />}
            </div>
          );
        })}
        {!hoje.length && <p className="text-[12px] text-ink/50">Nenhuma consulta hoje.</p>}
      </div>
      <p className="mt-3 text-[11px] text-ink/50">Contato rápido registra a tentativa no histórico de ações.</p>
    </div>
  );
};

/* ---------- médico indisponível ---------- */
const Indisponibilidade = () => {
  const { state } = useClinic();
  const [medId, setMedId] = useState(1);
  const [motivo, setMotivo] = useState("Congresso médico");
  const [bloqueado, setBloqueado] = useState<string | null>(null);
  const afetados = state.ags.filter((a) => a.medicoId === medId && a.status === "AGENDADO");
  const bloquear = () => setBloqueado(`${state.medicos.find((m) => m.id === medId)?.nome} · ${motivo}`);
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 shadow-lg">
      <p className="flex items-center gap-2 font-display text-[16px] font-extrabold"><IcAlert className="h-5 w-5 text-coral" /> Médico indisponível</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="text-[11px] font-bold text-ink/60">Médico
          <select value={medId} onChange={(e) => { setMedId(+e.target.value); setBloqueado(null); }} className="mt-1 w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-[13px] font-semibold outline-none focus:border-jade">
            {state.medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-bold text-ink/60">Motivo
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-[13px] font-semibold outline-none focus:border-jade">
            {["Congresso médico", "Férias", "Licença saúde", "Manutenção de agenda"].map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
      </div>
      <button onClick={bloquear} className="mt-3 w-full rounded-xl bg-coral px-4 py-3 font-display text-[13.5px] font-extrabold text-paper hover:scale-[1.01]">Bloquear horários do período</button>
      {bloqueado ? (
        <div className="pop-in mt-3 rounded-xl border border-coral/40 bg-coralsoft p-3.5">
          <p className="text-[12px] font-extrabold text-coral">⛔ {bloqueado} — horários bloqueados.</p>
          <p className="mt-1 text-[11.5px] text-ink/70"><strong>{afetados.length} paciente(s)</strong> afetado(s) identificados para reagendamento:</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {afetados.slice(0, 4).map((a) => (
              <span key={a.id} className="rounded-full bg-paper px-2.5 py-1 font-mono text-[10px] font-bold text-ink ring-1 ring-line">{a.paciente.split(" ")[0]} · {a.hora}</span>
            ))}
            {!afetados.length && <span className="font-mono text-[10px] text-ink/50">nenhum agendamento ativo</span>}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-ink/50">O sistema cruza a agenda e lista quem precisa ser realocado.</p>
      )}
    </div>
  );
};

/* ---------- o que levar ---------- */
const OQueLevar = () => {
  const [esp, setEsp] = useState(1);
  const [txt, setTxt] = useState("Traga exames anteriores, a carteirinha do convênio e chegue 10 minutos antes.");
  const [ouvido, setOuvido] = useState(false);
  const ouvir = () => {
    setOuvido(true);
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(txt);
      u.lang = "pt-BR";
      window.speechSynthesis.speak(u);
    } catch { /* sem TTS */ }
  };
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 shadow-lg">
      <p className="flex items-center gap-2 font-display text-[16px] font-extrabold"><IcDoc className="h-5 w-5 text-steel" /> “O que levar” por consulta</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {ESPECIALIDADES.slice(0, 4).map((e) => (
          <button key={e.id} onClick={() => setEsp(e.id)} className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${esp === e.id ? "border-steel bg-steelsoft text-steel" : "border-line bg-cream text-ink/55"}`}>{e.nome}</button>
        ))}
      </div>
      <label className="mt-3 block text-[11px] font-bold text-ink/60">Orientações que aparecem no app do paciente
        <textarea value={txt} onChange={(e) => { setTxt(e.target.value); setOuvido(false); }} rows={3}
          className="mt-1 w-full resize-none rounded-xl border border-line bg-cream px-3.5 py-2.5 text-[12.5px] leading-relaxed outline-none focus:border-steel" />
      </label>
      <div className="mt-2 flex items-center justify-between">
        <p className="font-mono text-[10px] text-ink/45">preview do app ↓</p>
        <button onClick={ouvir} className="flex items-center gap-1.5 rounded-full bg-steelsoft px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-steel hover:scale-105">{wave("h-3.5 w-3.5")} ouvir em áudio</button>
      </div>
      <div className="mt-2 rounded-xl border border-steel/40 bg-steelsoft p-3.5">
        <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-steel">antes da sua consulta · {ESPECIALIDADES.find((e) => e.id === esp)?.nome}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink/80">{txt}</p>
      </div>
      {ouvido && <p className="pop-in mt-2 font-mono text-[10px] text-jade">🔊 lido em voz alta (TTS local)</p>}
    </div>
  );
};

/* ---------- retorno automático ---------- */
const Retorno = () => {
  const [per, setPer] = useState("1 mês");
  const [proposto, setProposto] = useState<string | null>(null);
  const dias: Record<string, number> = { "1 semana": 7, "1 mês": 30, "3 meses": 90, "6 meses": 180 };
  const propor = () => {
    const alvo = addDaysISO(HOJE, dias[per] ?? 30);
    setProposto(`${fmtDataMedia(alvo)} · 09:30`);
  };
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 shadow-lg">
      <p className="flex items-center gap-2 font-display text-[16px] font-extrabold"><IcClock className="h-5 w-5 text-jade" /> Retorno automático</p>
      <p className="mt-1 text-[11.5px] text-ink/55">Após a consulta, o sistema calcula a previsão e já propõe um horário ao paciente.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {["1 semana", "1 mês", "3 meses", "6 meses", "Personalizado"].map((p) => (
          <button key={p} onClick={() => { setPer(p); setProposto(null); }} className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${per === p ? "border-jade bg-jadesoft text-jadedark" : "border-line bg-cream text-ink/55"}`}>{p}</button>
        ))}
      </div>
      <button onClick={propor} disabled={per === "Personalizado"} className={`mt-3 w-full rounded-xl px-4 py-3 font-display text-[13.5px] font-extrabold ${per === "Personalizado" ? "bg-line text-ink/40" : "bg-jade text-abyss hover:scale-[1.01]"}`}>
        {per === "Personalizado" ? "Definir data manualmente" : `Propor retorno em ${per.toLowerCase()}`}
      </button>
      {proposto && (
        <div className="pop-in mt-3 rounded-xl border border-jade/50 bg-jadesoft p-3.5">
          <p className="text-[12px] font-extrabold text-jadedark">📅 Retorno proposto: {proposto}</p>
          <p className="mt-1 text-[11.5px] text-ink/70">Disponibilidade verificada. O paciente recebe a proposta no app e confirma com um toque.</p>
        </div>
      )}
    </div>
  );
};

/* ---------- absenteísmo ---------- */
const Absenteismo = () => {
  const { state } = useClinic();
  const stats = useMemo(() => {
    const total = state.ags.length;
    const faltas = state.ags.filter((a) => a.status === "NAO_COMPARECEU").length;
    const concl = state.ags.filter((a) => a.status === "CONCLUIDO").length;
    const taxa = total ? Math.round((faltas / total) * 100) : 0;
    return { faltas, concl, taxa };
  }, [state.ags]);
  const barras = [18, 12, 22, 9, 14, 8, stats.taxa];
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 shadow-lg">
      <p className="flex items-center gap-2 font-display text-[16px] font-extrabold"><IcCalendar className="h-5 w-5 text-coral" /> Absenteísmo</p>
      <div className="mt-3 flex items-end gap-5">
        <div>
          <p className="font-display text-4xl font-extrabold text-coral"><CountUp to={stats.taxa} suffix="%" /></p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">taxa de ausência</p>
        </div>
        <div className="flex-1">
          <div className="flex h-20 items-end gap-1.5">
            {barras.map((b, i) => (
              <div key={i} className="bar-grow flex-1 rounded-t-md" style={{ height: `${b * 3.2}px`, background: i === barras.length - 1 ? "var(--color-coral)" : "var(--color-jade)", opacity: i === barras.length - 1 ? 1 : 0.35, animationDelay: `${i * 70}ms` }} title={`${b}%`} />
            ))}
          </div>
          <p className="mt-1.5 font-mono text-[9px] text-ink/45">últimas 7 semanas · {stats.faltas} falta(s) · {stats.concl} concluída(s)</p>
        </div>
      </div>
      <p className="mt-3 rounded-xl bg-cream px-3.5 py-2.5 text-[11.5px] leading-snug text-ink/70 ring-1 ring-line">
        Lembretes + confirmação do responsável + fila de espera derrubam a taxa de no-show. O histórico por data fica no relatório.
      </p>
    </div>
  );
};

/* ---------- auditoria ---------- */
const AUDITORIA = [
  { quem: "Secretária · Ana", acao: "Confirmação", det: "confirmou presença de Tereza Costa (08:30)", q: "há 12 min" },
  { quem: "IA · Lia (tool)", acao: "Reagendamento", det: "reagendou Maria Aparecida 09:30 → 10:00 (autorizado)", q: "há 41 min" },
  { quem: "Secretária · Ana", acao: "Bloqueio", det: "bloqueou 4 horários de Dra. Helena (congresso)", q: "há 2 h" },
  { quem: "Sistema · RN02", acao: "Vaga recuperada", det: "repassou 11:30 ao 1º da fila após expiração", q: "há 3 h" },
  { quem: "Secretária · Ana", acao: "Contato rápido", det: "ligou para paciente sem confirmação", q: "ontem" },
];
const Auditoria = () => (
  <div className="rounded-3xl border border-line bg-paper p-6 shadow-lg">
    <p className="flex items-center gap-2 font-display text-[16px] font-extrabold"><IcEdit className="h-5 w-5 text-pine" /> Histórico de ações</p>
    <p className="mt-1 text-[11.5px] text-ink/55">Toda ação importante fica registrada: quem fez, o quê e quando.</p>
    <div className="mt-3 space-y-2">
      {AUDITORIA.map((a, i) => (
        <div key={i} className="flex items-start gap-3 rounded-xl border border-line bg-cream px-3.5 py-2.5">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-pine font-mono text-[9px] font-bold text-mint">{a.acao.slice(0, 2).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-extrabold">{a.acao} <span className="font-mono text-[9.5px] font-normal text-ink/45">· {a.q}</span></p>
            <p className="truncate text-[11.5px] text-ink/65">{a.quem} {a.det}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ---------- seção ---------- */
export default function AutomacaoSection() {
  const { state } = useClinic();
  const recuperaveis = state.fila.filter((f) => f.status === "AGUARDANDO" || f.status === "NOTIFICADO").length;
  return (
    <section id="secretaria" className="relative scroll-mt-14 py-20 sm:scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <SectionHead num="05" kicker="Secretaria & automação"
            title={<>A recepção vira um <span className="text-jade">painel de controle</span>.</>}
            lead="Confirmações com contato rápido, bloqueio de agenda com pacientes afetados, orientações faladas, retorno automático, absenteísmo e auditoria — tudo que a secretária fazia no papel, agora automatizado." />
          <Reveal delay={120}>
            <div className="flex items-center gap-6 rounded-3xl border border-line bg-paper px-6 py-5 shadow-lg">
              <div>
                <p className="font-display text-4xl font-extrabold text-jade"><CountUp to={recuperaveis} /></p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">na fila de espera</p>
              </div>
              <div className="h-12 w-px bg-line" />
              <div>
                <p className="font-display text-4xl font-extrabold text-amber"><IcQueue className="h-8 w-8" /></p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">horários recuperáveis</p>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Reveal><Confirmacoes /></Reveal>
          <Reveal delay={70}><Indisponibilidade /></Reveal>
          <Reveal delay={140}><OQueLevar /></Reveal>
          <Reveal><Retorno /></Reveal>
          <Reveal delay={70}><Absenteismo /></Reveal>
          <Reveal delay={140}><Auditoria /></Reveal>
        </div>
      </div>
    </section>
  );
}
