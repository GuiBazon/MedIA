import React, { useEffect, useRef, useState } from "react";
import { useClinic } from "../store";
import { HOJE, addDaysISO, fmtDataMedia, fmtDataLonga } from "../data";
import { Reveal, SectionHead } from "./ui";
import { IcCheck, IcX, IcSpark, IcPhone, IcBell, IcLock, IcAlert, IcChevR, IcDoc, IcCalendar } from "./icons";

/* ícones locais */
const Mic = ({ className, on }: { className?: string; on?: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="9" y="3" width="6" height="11" rx="3" fill={on ? "currentColor" : "none"} />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);
const Wave = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
    <path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10v4M21 12h.5" />
  </svg>
);
const WifiOff = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
    <path d="M2 8.5a15 15 0 0 1 6.3-3.6M12 12.5a7.5 7.5 0 0 1 5 2M8.5 15.5a5 5 0 0 1 3-1.4M12 19h.01M22 8.5a15 15 0 0 0-7-3.7" />
    <path d="m3 3 18 18" />
  </svg>
);

/* ---------------- modo voz (pessoas cegas) ---------------- */
const VoiceDemo = () => {
  const { state, dispatch } = useClinic();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [spoken, setSpoken] = useState("Toque no microfone e fale: “Qual é a minha próxima consulta?” ou “Quero remarcar”");
  const [ttsOn, setTtsOn] = useState(true);
  const [lastTool, setLastTool] = useState<string | null>(null);
  const [awaiting, setAwaiting] = useState<null | "cancelar" | "remarcar" | "confirmar">(null);
  const [unsupported, setUnsupported] = useState(false);
  const recRef = useRef<any>(null);

  const proxima = state.ags.filter((a) => a.voce && a.status === "AGENDADO").sort((a, b) => `${a.dataISO}${a.hora}`.localeCompare(`${b.dataISO}${b.hora}`))[0];
  const med = (id: number) => state.medicos.find((m) => m.id === id)?.nome ?? "profissional";

  const speak = (text: string, tool?: string) => {
    setSpoken(text);
    if (tool) setLastTool(tool);
    if (!ttsOn) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "pt-BR";
      u.rate = 1.02;
      window.speechSynthesis.speak(u);
    } catch { /* TTS indisponível */ }
  };

  const processar = (raw: string) => {
    const t = raw.toLowerCase();
    if (awaiting) {
      if (/sim|confirmo|pode|quero|isso|confirma/.test(t)) {
        if (awaiting === "cancelar" && proxima) {
          dispatch({ t: "cancelAg", id: proxima.id, por: "Voz (IA Lia)" });
          speak("Pronto! Sua consulta foi cancelada e o horário já foi liberado para a fila de espera.", "cancelar_consulta()");
        } else if (awaiting === "confirmar" && proxima) {
          dispatch({ t: "confirmarPresenca", id: proxima.id, por: "Voz (IA Lia)" });
          speak("Presença confirmada com sucesso! Seu médico já foi notificado.", "confirmar_consulta()");
        } else {
          speak("Certo. Tenho horários na próxima quinta às 9h, 10h e 11h. Qual você prefere?", "buscar_horarios()");
        }
        setAwaiting(null);
      } else {
        speak("Tudo bem, deixei tudo como estava. Mais alguma coisa em que posso ajudar?", "abortar_acao()");
        setAwaiting(null);
      }
      return;
    }

    if (/cancel/.test(t)) {
      setAwaiting("cancelar");
      speak(`Encontrei sua consulta com ${proxima ? med(proxima.medicoId) : "o profissional"} em ${proxima ? fmtDataLonga(proxima.dataISO) : "breve"}. Cancelar é uma ação importante. Posso confirmar o cancelamento? Diga sim ou não.`, "buscar_consulta()");
      return;
    }
    if (/remarc|reagend|mudar horario/.test(t)) {
      setAwaiting("remarcar");
      speak("Vou te ajudar a remarcar. Antes, me confirma: você deseja buscar novos horários para a sua próxima consulta? Diga sim ou não.", "reagendar_consulta()");
      return;
    }
    if (/confirmar presenca|confirmar consulta|confirmo/.test(t)) {
      setAwaiting("confirmar");
      speak(`Deseja confirmar sua presença na consulta com ${proxima ? med(proxima.medicoId) : "o profissional"}? Diga sim para confirmar.`, "confirmar_consulta()");
      return;
    }
    if (/proxima|próxima|quando|minha consulta/.test(t)) {
      speak(proxima
        ? `Sua próxima consulta é com ${med(proxima.medicoId)}, em ${fmtDataLonga(proxima.dataISO)}, às ${proxima.hora}.`
        : "Você não tem consultas marcadas no momento. Quer agendar uma agora?", "buscar_consulta()");
      return;
    }
    if (/responsavel|cuidador|acompanhante/.test(t)) {
      speak(`Seu responsável autorizado é ${state.perfil.responsavelNome || "Ana Aparecida"}, com permissão para visualizar e confirmar suas consultas.`, "buscar_responsavel()");
      return;
    }
    if (/fila/.test(t)) {
      const naFila = state.fila.filter((f) => f.voce && (f.status === "AGUARDANDO" || f.status === "NOTIFICADO"));
      speak(naFila.length
        ? `Você está na fila para ${fmtDataMedia(naFila[0].dataISO)}, na posição ${naFila[0].posicao}ª. A janela de confirmação é de 60 minutos.`
        : "Você não está em nenhuma fila de espera no momento. Se um dia lotar, eu mesma te coloco na fila!", "consultar_fila()");
      return;
    }
    if (/quanto custa|valor|preco|preço/.test(t)) {
      speak("As consultas particulares custam duzentos e cinquenta reais. Pelo seu convênio Vida+, não há custo adicional.", "consultar_valores()");
      return;
    }
    if (/endereco|endereço|onde fica|localizacao|localização/.test(t)) {
      speak("Ficamos na Avenida Paulista, número 1000, Bela Vista, São Paulo. Temos estacionamento no local e acesso acessível.", "consultar_endereco()");
      return;
    }
    if (/marcar|agendar|consulta nova/.test(t)) {
      speak("Claro! Para qual especialidade? Temos cardiologia, clínica geral, odontologia, ortopedia e pediatria.", "buscar_horarios()");
      return;
    }
    if (/levar|orienta|preparo/.test(t)) {
      speak("Para sua consulta, traga exames anteriores, documento oficial com foto e carteirinha do convênio. Chegue dez minutos antes.", "buscar_orientacoes()");
      return;
    }
    speak("Entendi. Como secretária virtual por voz, posso buscar consultas, agendar, reagendar, cancelar, confirmar presença e tirar dúvidas. O que você precisa?", "atendimento_geral()");
  };

  const toggleMic = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setUnsupported(true);
      speak("Seu navegador não tem reconhecimento de voz. Use os botões de exemplo abaixo.");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript as string;
      setTranscript(text);
      processar(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };

  return (
    <div className="relative mx-auto w-full max-w-[calc(100vw-2rem)] sm:max-w-[360px]">
      <div className="deco absolute -left-8 top-24 hidden rotate-[-5deg] rounded-xl border border-linedark bg-deep px-3 py-2 shadow-xl lg:block">
        <p className="font-mono text-[10px] font-bold text-mint">🎙 STT Web Speech · pt-BR</p>
      </div>
      <div className="deco absolute -right-8 bottom-32 hidden rotate-[4deg] rounded-xl border border-linedark bg-deep px-3 py-2 shadow-xl lg:block">
        <p className="font-mono text-[10px] font-bold text-amber">🔊 TTS Nativo · fala humana</p>
      </div>

      <div className="overflow-hidden rounded-[2.4rem] border-[10px] border-abyss bg-abyss shadow-2xl">
        <div className="flex h-[560px] flex-col bg-pine">
          {/* status bar */}
          <div className="flex items-center justify-between px-5 pt-4 font-mono text-[10px] text-mint/60">
            <span>AcolheMed · Modo Voz</span>
            <span className="flex items-center gap-1"><Wave className="h-3.5 w-3.5 text-jade" /> leitor de tela ativo</span>
          </div>

          {/* agente central */}
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
            <div className={`relative grid h-20 w-20 place-items-center rounded-full ${listening ? "bg-jade text-paper" : "bg-deep text-mint"} transition-colors duration-300 shadow-xl`}>
              {listening && <span className="absolute inset-0 animate-ping rounded-full bg-jade/50" />}
              <Mic className="relative h-9 w-9" on={listening} />
            </div>
            <div>
              <p className="font-display text-xl font-extrabold text-paper">{listening ? "Estou ouvindo…" : "Fale com a Lia"}</p>
              <p className="mt-1 text-[13px] font-medium leading-snug text-mint">Sem menus. Sem toque. Só a sua voz.</p>
              {lastTool && (
                <span className="mt-2 inline-block rounded-full bg-deep border border-jade/40 px-3 py-1 font-mono text-[10.5px] font-extrabold text-mint">
                  Tool: {lastTool}
                </span>
              )}
            </div>
            <button
              onClick={toggleMic}
              aria-label={listening ? "Parar de ouvir" : "Começar a falar"}
              className={`w-full rounded-2xl px-6 py-4 font-display text-lg font-black shadow-lg transition-all ${listening ? "bg-coral text-paper" : "bg-jade text-paper hover:scale-[1.02] hover:bg-jadedark"}`}
            >
              {listening ? "■ Parar" : "● Toque e fale"}
            </button>
          </div>

          {/* transcrição + resposta */}
          <div className="space-y-2 px-5 pb-4">
            <div className="rounded-xl bg-deep/80 border border-linedark px-4 py-2.5">
              <p className="font-mono text-[9.5px] font-bold uppercase tracking-widest text-mint">você disse</p>
              <p className="mt-0.5 min-h-[18px] text-[13.5px] font-bold text-mint">{transcript || "—"}</p>
            </div>
            <div className="rounded-xl border border-jade/50 bg-jade/25 px-4 py-2.5" aria-live="polite">
              <p className="flex items-center gap-1.5 font-mono text-[9.5px] font-extrabold uppercase tracking-widest text-mint"><Wave className="h-3 w-3" /> Lia respondeu (áudio)</p>
              <p className="mt-0.5 min-h-[32px] text-[13.5px] font-semibold leading-snug text-paper">{spoken}</p>
            </div>
          </div>

          {/* exemplos + confirmação */}
          <div className="border-t border-linedark bg-abyss px-4 py-3">
            {awaiting ? (
              <div className="pop-in">
                <p className="mb-2 text-center font-mono text-[10.5px] font-bold uppercase tracking-widest text-amber">⚠ Ação importante · Confirme por voz ou toque</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => processar("sim, confirmo")} aria-label="Confirmar ação" className="rounded-xl bg-jade px-4 py-3 text-[14px] font-extrabold text-paper shadow-md hover:bg-jadedark">Sim, confirmar</button>
                  <button onClick={() => processar("não")} aria-label="Cancelar ação" className="rounded-xl bg-coral px-4 py-3 text-[14px] font-extrabold text-paper shadow-md hover:brightness-110">Não</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {["Qual minha próxima consulta?", "Confirmar presença", "Quero remarcar", "Quero cancelar", "Quem é meu responsável?", "O que levar?"].map((s) => (
                  <button key={s} onClick={() => { setTranscript(s); processar(s); }}
                    className="rounded-xl border border-linedark bg-pine px-3 py-1.5 text-[11.5px] font-bold text-paper transition-all hover:border-jade hover:bg-jade hover:scale-[1.02] active:scale-95 shadow-sm">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-2.5 flex items-center justify-between">
              <p className="font-mono text-[9.5px] font-semibold text-mint/70">Voz → Intent → Tool Calling → API → Áudio</p>
              <button onClick={() => setTtsOn((v) => !v)} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-widest ${ttsOn ? "bg-jade/30 text-mint" : "bg-coral/30 text-coralsoft"}`}>
                {ttsOn ? "🔊 voz on" : "🔇 voz off"}
              </button>
            </div>
          </div>
        </div>
      </div>
      {unsupported && (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-amber/50 bg-ambersoft px-3 py-2 text-[11.5px] font-bold text-ink">
          <IcAlert className="h-4 w-4 shrink-0 text-amber" /> Reconhecimento de voz não suportado aqui — use os botões rápidos.
        </p>
      )}
    </div>
  );
};

/* ---------------- modo offline ---------------- */
const OfflineDemo = () => {
  const { state, dispatch } = useClinic();
  const sync = state.ags.filter((a) => a.voce && a.status === "AGENDADO");
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 shadow-lg text-ink">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`grid h-10 w-10 place-items-center rounded-xl ${state.offline ? "bg-coralsoft text-coral" : "bg-jadesoft text-jade"}`}>
            {state.offline ? <WifiOff className="h-5 w-5" /> : <Wave className="h-5 w-5" />}
          </span>
          <div>
            <h3 className="font-display text-base font-extrabold text-ink">Modo Offline Inteligente</h3>
            <p className="font-mono text-[10.5px] font-bold text-jade">armazenamento local protegido</p>
          </div>
        </div>
        <button
          onClick={() => dispatch({ t: "setOffline", offline: !state.offline })}
          className={`rounded-xl px-3 py-1.5 font-mono text-[11px] font-extrabold uppercase tracking-wide transition-colors ${state.offline ? "bg-coral text-paper" : "bg-jade text-paper"}`}
        >
          {state.offline ? "offline" : "online"}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-cream/70 p-3.5">
        <p className="text-[12.5px] leading-relaxed text-ink font-medium">
          Sem conexão? O paciente <strong>não perde o acesso</strong> às suas consultas, preparo de exames, relatórios e contatos de emergência.
        </p>
        <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2 text-[11.5px]">
          <span className="font-semibold text-ink/75">Consultas salvas no aparelho:</span>
          <span className="font-mono font-bold text-jadedark">{sync.length} no cache</span>
        </div>
      </div>

      {/* Tabela do PDF: O que funciona offline vs online */}
      <div className="mt-3.5 overflow-hidden rounded-2xl border border-line">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-cream font-mono uppercase text-[9.5px] font-bold text-ink/80 border-b border-line">
            <tr>
              <th className="px-3 py-2">Recurso do App</th>
              <th className="px-3 py-2 text-center text-jadedark">Offline</th>
              <th className="px-3 py-2 text-center text-steel">Online</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-paper text-ink font-medium">
            <tr>
              <td className="px-3 py-2 font-bold">Ver consultas agendadas e comprovantes</td>
              <td className="px-3 py-2 text-center font-bold text-jade">✓ Sim</td>
              <td className="px-3 py-2 text-center font-bold text-jade">✓ Sim</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-bold">Orientações de preparo e contatos</td>
              <td className="px-3 py-2 text-center font-bold text-jade">✓ Sim</td>
              <td className="px-3 py-2 text-center font-bold text-jade">✓ Sim</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-bold">Ajustes locais de acessibilidade</td>
              <td className="px-3 py-2 text-center font-bold text-jade">✓ Sim</td>
              <td className="px-3 py-2 text-center font-bold text-jade">✓ Sim</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-bold">Marcar nova consulta / IA Lia</td>
              <td className="px-3 py-2 text-center font-bold text-coral">✕ Bloqueado</td>
              <td className="px-3 py-2 text-center font-bold text-jade">✓ Sim</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-bold">Fila de espera em tempo real (RN02)</td>
              <td className="px-3 py-2 text-center font-bold text-coral">✕ Bloqueado</td>
              <td className="px-3 py-2 text-center font-bold text-jade">✓ Sim</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ---------------- perfil do responsável ---------------- */
const ResponsavelDemo = () => {
  const { state, dispatch } = useClinic();
  const [sel, setSel] = useState(0);
  const [log, setLog] = useState("Selecione uma ação para validar as permissões na API.");

  const deps = state.dependentes;
  const atual = deps[sel] || deps[0];

  const togglePerm = (p: string) => {
    dispatch({ t: "toggleDependentePerm", depId: atual.id, perm: p });
    const novoStatus = !atual.permissoes[p];
    setLog(novoStatus ? `Permissão “${p}” concedida para ${atual.nome}.` : `Permissão “${p}” revogada pela API.`);
  };

  const agir = (acao: string) => {
    const autorizada = atual.permissoes[acao];
    if (autorizada) {
      const msg = `API autorizou: responsável executou “${acao}” para ${atual.nome} (${atual.proximaConsulta}). Ação registrada no log de auditoria.`;
      setLog(msg);
      dispatch({ t: "agirDependente", depId: atual.id, acao, log: msg });
      dispatch({ t: "toast", texto: `Ação “${acao}” realizada com sucesso! ✓` });
    } else {
      setLog(`API bloqueou: Você não possui a permissão de “${acao}” para ${atual.nome}. Solicite autorização ao paciente.`);
      dispatch({ t: "toast", texto: `Acesso negado: sem permissão para ${acao}`, tom: "erro" });
    }
  };

  return (
    <div className="rounded-3xl border border-line bg-paper p-6 shadow-lg text-ink">
      <p className="font-mono text-[10.5px] font-bold uppercase tracking-widest text-ink/75">Acompanhamento de Dependentes</p>
      <div className="mt-2.5 flex gap-2">
        {deps.map((p, i) => (
          <button key={p.id} onClick={() => setSel(i)} aria-label={`Acompanhar ${p.nome}`}
            className={`flex flex-1 items-center gap-2 rounded-xl border p-2 text-left transition-all ${sel === i ? "border-2 border-jade bg-jadesoft shadow-sm" : "border-line bg-cream/70 text-ink/80 hover:bg-cream"}`}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pine font-display text-[11px] font-extrabold text-mint">{p.inicial}</span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-extrabold text-ink">{p.nome.split(" ")[0]}</span>
              <span className="block text-[10px] font-semibold text-ink/70">{p.parentesco}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3.5 rounded-2xl border border-line bg-cream p-3.5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink/70">Próxima Consulta · {atual.parentesco}</p>
          <span className="rounded-full bg-ambersoft border border-amber/40 px-2 py-0.5 font-mono text-[9px] font-black text-amber">
            {atual.status === "CONFIRMADO" ? "✓ confirmada" : "● aguardando confirmação"}
          </span>
        </div>
        <p className="mt-1 text-[14px] font-extrabold text-ink">{atual.proximaConsulta}</p>
        <p className="text-[12px] text-jade font-bold">{fmtDataMedia(atual.dataISO)} às {atual.hora}</p>
      </div>

      <p className="mt-3.5 font-mono text-[10px] font-bold uppercase tracking-widest text-ink/70">Permissões Concedidas pelo Paciente</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {["Visualizar", "Lembretes", "Confirmar presença", "Reagendar", "Cancelar"].map((p) => (
          <button key={p} onClick={() => togglePerm(p)}
            className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-all ${atual.permissoes[p] ? "border-jade bg-jadesoft text-jadedark shadow-sm" : "border-line bg-paper text-ink/70 hover:bg-cream"}`}>
            {atual.permissoes[p] ? "✓ " : ""}{p}
          </button>
        ))}
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <button onClick={() => agir("Confirmar presença")} className="rounded-xl bg-pine px-3 py-2.5 text-[12.5px] font-extrabold text-paper shadow-md hover:bg-jade">Confirmar Presença</button>
        <button onClick={() => agir("Reagendar")} className="rounded-xl bg-paper border border-line px-3 py-2.5 text-[12.5px] font-extrabold text-ink shadow-sm hover:bg-cream">Reagendar</button>
      </div>
      <button onClick={() => agir("Cancelar")} className="mt-1.5 w-full rounded-xl border border-coral/50 bg-coralsoft px-3 py-2.5 text-[12px] font-extrabold text-coral hover:bg-coral hover:text-paper shadow-sm">Cancelar Consulta (Exige Permissão)</button>

      <p className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-cream px-3 py-2 text-[11.5px] font-semibold leading-snug text-ink" aria-live="polite">
        <IcLock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-jade" />{log}
      </p>
    </div>
  );
};

/* ---------------- seção ---------------- */
export default function AcessibilidadeSection() {
  return (
    <section id="acessibilidade" className="relative scroll-mt-14 overflow-hidden bg-deep py-20 text-paper sm:scroll-mt-16">
      <div className="deco pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-jade/10 blur-3xl" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <SectionHead dark num="04" kicker="Acessibilidade radical"
            title={<>Inclusão não é um filtro.<br />É <span className="text-jade">outro jeito de usar</span>.</>}
            lead="Voz para quem não vê, alto contraste e botões grandes combináveis para a terceira idade, perfil do responsável com permissões granulares e funcionamento inteligente offline." />
          <Reveal delay={120}>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {["🎙 entrada por voz", "🔊 respostas faladas", "👁 alto contraste", "🤝 múltiplos dependentes", "📴 modo offline"].map((t) => (
                <span key={t} className="rounded-full border border-linedark bg-pine px-3.5 py-1.5 font-mono text-[11px] text-mint/85">{t}</span>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[420px_1fr]">
          <Reveal className="order-2 lg:order-1">
            <div className="space-y-6">
              <OfflineDemo />
              <ResponsavelDemo />
            </div>
          </Reveal>
          <Reveal delay={100} className="order-1 lg:order-2">
            <div className="mb-6 max-w-xl">
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.24em] text-jade"><IcSpark className="h-4 w-4" /> Modo Voz · para pessoas cegas</p>
              <h3 className="mt-3 font-display text-2xl font-extrabold sm:text-3xl">Uma tela só: o agente. O resto é conversa.</h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-mint/70">
                Em vez de navegar por menus, a pessoa fala — <em>“qual minha próxima consulta?”</em>, <em>“quero remarcar”</em>, <em>“confirmar presença”</em> — e a Lia responde em áudio executando as Tools da API.
                Ações críticas, como cancelar, exigem confirmação falada antes de liberar o horário. <strong className="text-mint">Experimente com o microfone</strong> ou botões rápidos.
              </p>
            </div>
            <VoiceDemo />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
