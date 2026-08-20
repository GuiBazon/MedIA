import React, { useMemo, useState } from "react";
import { useClinic } from "../store";
import { HOJE, addDaysISO, fmtDataMedia, ESPECIALIDADES } from "../data";
import { Reveal, SectionHead, CountUp } from "./ui";
import { IcBell, IcPhone, IcChat, IcAlert, IcCalendar, IcQueue, IcDoc, IcCheck, IcEdit, IcClock, IcSpark } from "./icons";

const wave = (className?: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}><path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10v4M21 12h.5" /></svg>
);

/* ---------- confirmações + contato rápido ---------- */
const Confirmacoes = () => {
  const { state, dispatch } = useClinic();
  const hoje = state.ags.filter((a) => a.dataISO === HOJE);
  const pendentes = hoje.filter((a) => a.status === "AGENDADO");

  const fazerContato = (a: typeof hoje[0], tipo: "msg" | "tel") => {
    dispatch({ t: "confirmarPresenca", id: a.id, por: `Secretária (${tipo === "msg" ? "WhatsApp" : "Ligação"})` });
    dispatch({
      t: "addAuditLog",
      quem: "Secretária (Recepção)",
      perfil: "secretaria",
      acao: "Contato rápido",
      detalhes: `${tipo === "msg" ? "Enviou WhatsApp" : "Ligou"} para ${a.paciente} · presença confirmada no sistema`,
    });
    dispatch({ t: "toast", texto: `Contato registrado com ${a.paciente}! Presença confirmada. ✓` });
  };

  return (
    <div className="rounded-3xl border border-line bg-paper p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-display text-[16px] font-extrabold"><IcBell className="h-5 w-5 text-amber" /> Confirmações do dia</p>
        <span className="rounded-full bg-ambersoft px-2.5 py-1 font-mono text-[10px] font-bold text-ink">{pendentes.filter(p => !p.confirmada).length} pendentes</span>
      </div>
      <div className="mt-4 space-y-2.5">
        {hoje.slice(0, 4).map((a) => {
          const med = state.medicos.find((m) => m.id === a.medicoId)?.nome ?? "";
          return (
            <div key={a.id} className="flex items-center gap-3 rounded-xl border border-line bg-cream px-3.5 py-2.5 shadow-sm">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pine font-display text-[11px] font-extrabold text-mint">{a.paciente.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-extrabold text-ink">{a.paciente} <span className="font-mono text-[10.5px] font-semibold text-ink/70">· {a.hora} {med.replace("Dra. ", "").replace("Dr. ", "")}</span></p>
                <span className={`inline-block rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${a.confirmada ? "bg-jadesoft text-jadedark border border-jade/30" : "bg-ambersoft text-amber border border-amber/40"}`}>
                  {a.confirmada ? "✓ confirmada" : "● aguardando confirmação"}
                </span>
              </div>
              {!a.confirmada ? (
                <div className="flex gap-1">
                  <button title="Enviar WhatsApp de confirmação" aria-label={`Mensagem para ${a.paciente}`} onClick={() => fazerContato(a, "msg")} className="grid h-8 w-8 place-items-center rounded-lg bg-steelsoft text-steel border border-steel/30 hover:scale-105 shadow-sm"><IcChat className="h-4 w-4" /></button>
                  <button title="Ligar para confirmar" aria-label={`Ligar para ${a.paciente}`} onClick={() => fazerContato(a, "tel")} className="grid h-8 w-8 place-items-center rounded-lg bg-jadesoft text-jade border border-jade/30 hover:scale-105 shadow-sm"><IcPhone className="h-4 w-4" /></button>
                </div>
              ) : (
                <IcCheck className="h-5 w-5 text-jade" />
              )}
            </div>
          );
        })}
        {!hoje.length && <p className="text-[12.5px] font-medium text-ink/65">Nenhuma consulta hoje.</p>}
      </div>
      <p className="mt-3 text-[11.5px] font-medium text-ink/70">Contato rápido registra a tentativa e confirmação no histórico de auditoria.</p>
    </div>
  );
};

/* ---------- médico indisponível & reagendamento em lote ---------- */
const Indisponibilidade = () => {
  const { state, dispatch } = useClinic();
  const [medId, setMedId] = useState(1);
  const [motivo, setMotivo] = useState("Congresso médico");
  const [bloqueado, setBloqueado] = useState<string | null>(null);

  const med = state.medicos.find((m) => m.id === medId);
  const afetados = state.ags.filter((a) => a.medicoId === medId && a.status === "AGENDADO");

  const bloquear = () => {
    dispatch({ t: "bloquearAgenda", medicoId: medId, dataISO: HOJE, motivo });
    setBloqueado(`${med?.nome} · ${motivo}`);
    dispatch({ t: "toast", texto: `Agenda de ${med?.nome} bloqueada (${motivo})`, tom: "erro" });
  };

  const reagendarTodos = () => {
    const novaData = addDaysISO(HOJE, 2);
    dispatch({ t: "reagendarLote", medicoId: medId, dataISO: HOJE, novoDiaISO: novaData });
    dispatch({ t: "toast", texto: `${afetados.length} paciente(s) realocado(s) para ${fmtDataMedia(novaData)}! 🎉` });
  };

  return (
    <div className="rounded-3xl border border-line bg-paper p-6 shadow-lg">
      <p className="flex items-center gap-2 font-display text-[16px] font-extrabold text-ink"><IcAlert className="h-5 w-5 text-coral" /> Médico indisponível</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="text-[11px] font-bold text-ink/80">Médico
          <select value={medId} onChange={(e) => { setMedId(+e.target.value); setBloqueado(null); }} className="mt-1 w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-[13px] font-semibold text-ink outline-none focus:border-jade">
            {state.medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-bold text-ink/80">Motivo
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-[13px] font-semibold text-ink outline-none focus:border-jade">
            {["Congresso médico", "Férias", "Licença saúde", "Manutenção de agenda"].map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
      </div>
      <button onClick={bloquear} className="mt-3 w-full rounded-xl bg-coral px-4 py-3 font-display text-[13.5px] font-extrabold text-paper shadow-md hover:brightness-110">Bloquear horários do período</button>
      {bloqueado ? (
        <div className="pop-in mt-3 rounded-xl border border-coral/40 bg-coralsoft p-3.5">
          <p className="text-[12.5px] font-extrabold text-coral">⛔ {bloqueado} — horários bloqueados.</p>
          <p className="mt-1 text-[12px] font-medium text-ink/85"><strong>{afetados.length} paciente(s)</strong> afetado(s) identificados:</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {afetados.slice(0, 4).map((a) => (
              <span key={a.id} className="rounded-full bg-paper px-2.5 py-1 font-mono text-[10.5px] font-bold text-ink ring-1 ring-line shadow-sm">{a.paciente.split(" ")[0]} · {a.hora}</span>
            ))}
            {!afetados.length && <span className="font-mono text-[10px] text-ink/70">nenhum agendamento ativo</span>}
          </div>
          {afetados.length > 0 && (
            <button onClick={reagendarTodos} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-pine py-2.5 text-[12.5px] font-extrabold text-paper shadow-md hover:bg-jade">
              ⚡ Reagendar Afetados Automaticamente
            </button>
          )}
        </div>
      ) : (
        <p className="mt-3 text-[11.5px] font-medium text-ink/70">O sistema cruza a agenda, identifica os pacientes afetados e permite reagendá-los em lote.</p>
      )}
    </div>
  );
};

/* ---------- o que levar ---------- */
const OQueLevar = () => {
  const [esp, setEsp] = useState(1);
  const [txt, setTxt] = useState("Traga exames anteriores, documento oficial com foto e carteirinha do convênio. Chegue 10 minutos antes.");
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
      <p className="flex items-center gap-2 font-display text-[16px] font-extrabold text-ink"><IcDoc className="h-5 w-5 text-steel" /> “O que levar” por consulta</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {ESPECIALIDADES.slice(0, 4).map((e) => (
          <button key={e.id} onClick={() => setEsp(e.id)} className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${esp === e.id ? "border-2 border-steel bg-steelsoft text-steel shadow-sm" : "border-line bg-paper text-ink/80 hover:bg-cream"}`}>{e.nome}</button>
        ))}
      </div>
      <label className="mt-3 block text-[11px] font-bold text-ink/80">Orientações que aparecem no app do paciente
        <textarea value={txt} onChange={(e) => { setTxt(e.target.value); setOuvido(false); }} rows={3}
          className="mt-1 w-full resize-none rounded-xl border border-line bg-cream px-3.5 py-2.5 text-[13px] font-medium text-ink leading-relaxed outline-none focus:border-steel" />
      </label>
      <div className="mt-2 flex items-center justify-between">
        <p className="font-mono text-[10px] font-bold uppercase text-ink/60">preview do app ↓</p>
        <button onClick={ouvir} className="flex items-center gap-1.5 rounded-full bg-steelsoft border border-steel/30 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-steel shadow-sm hover:scale-105">{wave("h-3.5 w-3.5")} ouvir em áudio</button>
      </div>
      <div className="mt-2 rounded-xl border border-steel/40 bg-steelsoft p-3.5 shadow-sm">
        <p className="font-mono text-[9.5px] font-bold uppercase tracking-widest text-steel">antes da sua consulta · {ESPECIALIDADES.find((e) => e.id === esp)?.nome}</p>
        <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-ink">{txt}</p>
      </div>
      {ouvido && <p className="pop-in mt-2 font-mono text-[10.5px] font-bold text-jade">🔊 lido em voz alta com sintetizador local</p>}
    </div>
  );
};

/* ---------- retorno automático ---------- */
const Retorno = () => {
  const { dispatch } = useClinic();
  const [per, setPer] = useState("1 mês");
  const [proposto, setProposto] = useState<string | null>(null);
  const dias: Record<string, number> = { "1 semana": 7, "1 mês": 30, "3 meses": 90, "6 meses": 180 };
  const propor = () => {
    const alvo = addDaysISO(HOJE, dias[per] ?? 30);
    const texto = `${fmtDataMedia(alvo)} · 09:30`;
    setProposto(texto);
    dispatch({
      t: "addAuditLog",
      quem: "Secretaria / Sistema",
      perfil: "sistema",
      acao: "Retorno automático",
      detalhes: `Proposta de retorno em ${per} gerada para ${texto}`,
    });
  };
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 shadow-lg">
      <p className="flex items-center gap-2 font-display text-[16px] font-extrabold text-ink"><IcClock className="h-5 w-5 text-jade" /> Retorno automático</p>
      <p className="mt-1 text-[12px] font-medium text-ink/75">Após a consulta, o sistema calcula a previsão e já propõe um horário ao paciente.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {["1 semana", "1 mês", "3 meses", "6 meses", "Personalizado"].map((p) => (
          <button key={p} onClick={() => { setPer(p); setProposto(null); }} className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${per === p ? "border-2 border-jade bg-jadesoft text-jadedark shadow-sm" : "border-line bg-paper text-ink/80 hover:bg-cream"}`}>{p}</button>
        ))}
      </div>
      <button onClick={propor} disabled={per === "Personalizado"} className={`mt-3 w-full rounded-xl px-4 py-3 font-display text-[13.5px] font-black shadow-md ${per === "Personalizado" ? "bg-line text-ink/40" : "bg-jade text-paper hover:scale-[1.01] hover:bg-jadedark"}`}>
        {per === "Personalizado" ? "Definir data manualmente" : `Propor retorno em ${per.toLowerCase()}`}
      </button>
      {proposto && (
        <div className="pop-in mt-3 rounded-xl border border-jade/50 bg-jadesoft p-3.5 shadow-sm">
          <p className="text-[12.5px] font-extrabold text-jadedark">📅 Retorno proposto: {proposto}</p>
          <p className="mt-1 text-[12px] font-medium text-ink">Disponibilidade verificada. O paciente recebe a proposta no app e confirma com um toque.</p>
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
  const barras = [18, 12, 22, 9, 14, 8, Math.max(6, stats.taxa)];
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 shadow-lg">
      <p className="flex items-center gap-2 font-display text-[16px] font-extrabold text-ink"><IcCalendar className="h-5 w-5 text-coral" /> Absenteísmo</p>
      <div className="mt-3 flex items-end gap-5">
        <div>
          <p className="font-display text-4xl font-extrabold text-coral"><CountUp to={stats.taxa} suffix="%" /></p>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink/70">taxa de ausência</p>
        </div>
        <div className="flex-1">
          <div className="flex h-20 items-end gap-1.5">
            {barras.map((b, i) => (
              <div key={i} className="bar-grow flex-1 rounded-t-md" style={{ height: `${b * 3.2}px`, background: i === barras.length - 1 ? "var(--color-coral)" : "var(--color-jade)", opacity: i === barras.length - 1 ? 1 : 0.4, animationDelay: `${i * 70}ms` }} title={`${b}%`} />
            ))}
          </div>
          <p className="mt-1.5 font-mono text-[10px] font-semibold text-ink/75">últimas 7 semanas · {stats.faltas} falta(s) · {stats.concl} concluída(s)</p>
        </div>
      </div>
      <p className="mt-3 rounded-xl bg-cream px-3.5 py-2.5 text-[12px] font-medium leading-snug text-ink ring-1 ring-line">
        Lembretes + confirmação do responsável + fila de espera derrubam a taxa de no-show. O histórico por data fica no relatório.
      </p>
    </div>
  );
};

/* ---------- IA da Secretaria (Tool Calling) ---------- */
const IASecretaria = () => {
  const { state, dispatch } = useClinic();
  const [resposta, setResposta] = useState("Clique em um comando rápido ou pergunte à Lia.");
  const [toolCall, setToolCall] = useState<string | null>(null);

  const executar = (comando: string) => {
    if (comando.includes("confirma")) {
      const pend = state.ags.filter((a) => a.dataISO === HOJE && !a.confirmada).length;
      setToolCall("consultar_confirmacoes_dia(data=HOJE)");
      setResposta(`Existem ${pend} paciente(s) aguardando confirmação hoje. Deseja disparar lembrete via WhatsApp em lote?`);
    } else if (comando.includes("faltas") || comando.includes("absente")) {
      const faltas = state.ags.filter((a) => a.status === "NAO_COMPARECEU").length;
      setToolCall("consultar_absenteismo(periodo='mes')");
      setResposta(`Taxa de no-show em 8% com ${faltas} ausências no mês (redução de 8 pontos com lembretes automáticos).`);
    } else if (comando.includes("fila")) {
      const naFila = state.fila.filter((f) => f.status === "AGUARDANDO" || f.status === "NOTIFICADO").length;
      setToolCall("consultar_fila_espera()");
      setResposta(`Há ${naFila} paciente(s) ativos na fila viva. O tempo médio de preenchimento é de 18 segundos.`);
    } else if (comando.includes("bloqueio") || comando.includes("helena")) {
      setToolCall("bloquear_agenda(medicoId=1, motivo='Congresso')");
      dispatch({ t: "bloquearAgenda", medicoId: 1, dataISO: HOJE, motivo: "Congresso médico" });
      setResposta("Agenda da Dra. Helena bloqueada. Pacientes afetados foram mapeados para reagendamento.");
    }
  };

  return (
    <div className="rounded-3xl border border-line bg-paper p-6 shadow-lg">
      <p className="flex items-center gap-2 font-display text-[16px] font-extrabold text-pine"><IcSpark className="h-5 w-5 text-jade" /> IA da Secretaria</p>
      <p className="mt-1 text-[12px] font-medium text-ink/75">Assistente virtual com Tool Calling para responder e executar ações operacionais.</p>
      
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[
          ["Quem precisa de confirmação?", "confirma"],
          ["Taxa de faltas do mês", "faltas"],
          ["Status da fila viva", "fila"],
          ["Bloquear Dra. Helena", "bloqueio"],
        ].map(([txt, cmd]) => (
          <button key={cmd} onClick={() => executar(cmd)} className="rounded-full border border-line bg-paper px-3 py-1 text-[11px] font-bold text-ink shadow-sm hover:border-jade hover:bg-jadesoft hover:text-jadedark">
            {txt}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-2xl border border-jade/40 bg-jadesoft/70 p-3 text-[12.5px] shadow-sm">
        {toolCall && (
          <p className="font-mono text-[10px] font-extrabold text-jade">🔧 Tool Executada: {toolCall}</p>
        )}
        <p className="mt-1 font-semibold text-ink">{resposta}</p>
      </div>
    </div>
  );
};

/* ---------- auditoria ao vivo ---------- */
const Auditoria = () => {
  const { state } = useClinic();
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 shadow-lg">
      <p className="flex items-center gap-2 font-display text-[16px] font-extrabold text-pine"><IcEdit className="h-5 w-5 text-pine" /> Histórico de ações (Auditoria)</p>
      <p className="mt-1 text-[12px] font-medium text-ink/75">Toda ação importante é registrada com autor, tipo de operação e carimbo de data/hora.</p>
      <div className="mt-3 space-y-2 max-h-56 overflow-y-auto thin-scroll pr-1">
        {state.auditoria.map((a) => (
          <div key={a.id} className="flex items-start gap-2.5 rounded-xl border border-line bg-cream px-3 py-2 shadow-sm">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-pine font-mono text-[9px] font-bold text-mint">{a.acao.slice(0, 2).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-extrabold leading-tight text-ink">{a.acao} <span className="font-mono text-[9.5px] font-semibold text-ink/65">· {a.quando}</span></p>
              <p className="truncate text-[11.5px] text-ink font-medium"><strong className="text-pine font-extrabold">{a.quem}:</strong> {a.detalhes}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

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
          <Reveal delay={140}><IASecretaria /></Reveal>
        </div>

        <div className="mt-6">
          <Reveal><Auditoria /></Reveal>
        </div>
      </div>
    </section>
  );
}
