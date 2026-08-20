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
  const { state } = useClinic();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [spoken, setSpoken] = useState("Toque no microfone e fale: “Qual é a minha próxima consulta?”");
  const [ttsOn, setTtsOn] = useState(true);
  const [awaiting, setAwaiting] = useState<null | "cancelar" | "remarcar">(null);
  const [unsupported, setUnsupported] = useState(false);
  const recRef = useRef<any>(null);

  const proxima = state.ags.filter((a) => a.voce && a.status === "AGENDADO").sort((a, b) => `${a.dataISO}${a.hora}`.localeCompare(`${b.dataISO}${b.hora}`))[0];
  const med = (id: number) => state.medicos.find((m) => m.id === id)?.nome ?? "profissional";

  const speak = (text: string) => {
    setSpoken(text);
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
      if (/sim|confirmo|pode|quero/.test(t)) {
        speak(awaiting === "cancelar"
          ? "Pronto! Sua consulta foi cancelada e o horário já foi liberado para outra pessoa."
          : "Certo. Tenho horários quinta às 9, 10 e 11. Qual você prefere?");
        setAwaiting(null);
      } else {
        speak("Tudo bem, deixei tudo como estava. Mais alguma coisa?");
        setAwaiting(null);
      }
      return;
    }
    if (/cancel/.test(t)) {
      setAwaiting("cancelar");
      speak(`Encontrei sua consulta com ${proxima ? med(proxima.medicoId) : "o profissional"} em ${proxima ? fmtDataLonga(proxima.dataISO) : "breve"}. Cancelar é uma ação importante. Posso confirmar o cancelamento? Diga sim ou não.`);
      return;
    }
    if (/remarc|reagend/.test(t)) {
      setAwaiting("remarcar");
      speak("Vou te ajudar a remarcar. Antes, me confirma: você quer reagendar a sua próxima consulta? Diga sim ou não.");
      return;
    }
    if (/proxima|próxima|quando/.test(t)) {
      speak(proxima
        ? `Sua próxima consulta é com ${med(proxima.medicoId)}, em ${fmtDataLonga(proxima.dataISO)}, às ${proxima.hora}.`
        : "Você não tem consultas marcadas no momento. Quer agendar uma?");
      return;
    }
    if (/marcar|agendar|consulta nova/.test(t)) {
      speak("Claro! Para qual especialidade? Tenho cardiologia, clínica geral, odontologia e ortopedia com agenda aberta esta semana.");
      return;
    }
    if (/levar|orienta/.test(t)) {
      speak("Para sua consulta de cardiologia, traga seus exames anteriores e a carteirinha do convênio. Chegue dez minutos antes.");
      return;
    }
    speak("Entendi. Posso marcar, remarcar, cancelar consultas e dizer o que levar. O que você precisa?");
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
    <div className="relative mx-auto w-full max-w-[360px]">
      <div className="deco absolute -left-8 top-24 hidden rotate-[-5deg] rounded-xl border border-linedark bg-deep px-3 py-2 shadow-xl lg:block">
        <p className="font-mono text-[10px] font-bold text-mint">🎙 STT local · pt-BR</p>
      </div>
      <div className="deco absolute -right-8 bottom-32 hidden rotate-[4deg] rounded-xl border border-linedark bg-deep px-3 py-2 shadow-xl lg:block">
        <p className="font-mono text-[10px] font-bold text-amber">🔊 TTS · resposta falada</p>
      </div>

      <div className="overflow-hidden rounded-[2.4rem] border-[10px] border-abyss bg-abyss shadow-2xl">
        <div className="flex h-[560px] flex-col bg-pine">
          {/* status bar */}
          <div className="flex items-center justify-between px-5 pt-4 font-mono text-[10px] text-mint/60">
            <span>FácilMed · Modo Voz</span>
            <span className="flex items-center gap-1"><Wave className="h-3.5 w-3.5 text-jade" /> leitor de tela ativo</span>
          </div>

          {/* agente central */}
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
            <div className={`relative grid h-20 w-20 place-items-center rounded-full ${listening ? "bg-jade text-abyss" : "bg-deep text-mint"} transition-colors duration-300`}>
              {listening && <span className="absolute inset-0 animate-ping rounded-full bg-jade/50" />}
              <Mic className="relative h-9 w-9" on={listening} />
            </div>
            <div>
              <p className="font-display text-xl font-extrabold text-paper">{listening ? "Estou ouvindo…" : "Fale com a Lia"}</p>
              <p className="mt-1 text-[12.5px] leading-snug text-mint/70">Sem menus. Sem toque. Só a sua voz.</p>
            </div>
            <button
              onClick={toggleMic}
              aria-label={listening ? "Parar de ouvir" : "Começar a falar"}
              className={`w-full rounded-2xl px-6 py-4 font-display text-lg font-extrabold transition-all ${listening ? "bg-coral text-paper" : "bg-jade text-abyss hover:scale-[1.02]"}`}
            >
              {listening ? "■ Parar" : "● Toque e fale"}
            </button>
          </div>

          {/* transcrição + resposta */}
          <div className="space-y-2 px-5 pb-4">
            <div className="rounded-xl bg-deep/70 px-4 py-2.5">
              <p className="font-mono text-[9px] uppercase tracking-widest text-mint/45">você disse</p>
              <p className="mt-0.5 min-h-[18px] text-[13px] font-semibold text-mint">{transcript || "—"}</p>
            </div>
            <div className="rounded-xl border border-jade/40 bg-jade/15 px-4 py-2.5" aria-live="polite">
              <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-jade"><Wave className="h-3 w-3" /> Lia respondeu (áudio)</p>
              <p className="mt-0.5 min-h-[32px] text-[13px] leading-snug text-paper">{spoken}</p>
            </div>
          </div>

          {/* exemplos + confirmação */}
          <div className="border-t border-linedark bg-abyss px-4 py-3">
            {awaiting ? (
              <div className="pop-in">
                <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-widest text-amber">⚠ ação importante · confirme</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => processar("sim, confirmo")} aria-label="Confirmar" className="rounded-xl bg-jade px-4 py-3 text-[14px] font-extrabold text-abyss hover:scale-[1.02]">Sim, confirmar</button>
                  <button onClick={() => processar("não")} aria-label="Cancelar ação" className="rounded-xl bg-coral/20 px-4 py-3 text-[14px] font-extrabold text-coral ring-1 ring-coral/50 hover:scale-[1.02]">Não</button>
                </div>
              </div>
            ) : (
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                {["Qual minha próxima consulta?", "Quero remarcar", "Quero cancelar", "O que levar?"].map((s) => (
                  <button key={s} onClick={() => { setTranscript(s); processar(s); }}
                    className="shrink-0 rounded-full border border-linedark bg-pine px-3 py-1.5 text-[11px] font-semibold text-mint/85 hover:border-jade/60 hover:text-mint">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-2.5 flex items-center justify-between">
              <p className="font-mono text-[9px] text-mint/40">intent → tool → API → áudio</p>
              <button onClick={() => setTtsOn((v) => !v)} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-widest ${ttsOn ? "bg-jade/20 text-jade" : "bg-coral/20 text-coral"}`}>
                {ttsOn ? "🔊 voz on" : "🔇 voz off"}
              </button>
            </div>
          </div>
        </div>
      </div>
      {unsupported && (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-amber/50 bg-ambersoft px-3 py-2 text-[11.5px] font-bold text-ink">
          <IcAlert className="h-4 w-4 shrink-0 text-amber" /> Reconhecimento de voz não suportado aqui — use os exemplos clicáveis.
        </p>
      )}
    </div>
  );
};

/* ---------------- modo offline ---------------- */
const OfflineDemo = () => {
  const { state } = useClinic();
  const [offline, setOffline] = useState(false);
  const sync = state.ags.filter((a) => a.voce && a.status === "AGENDADO");
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`grid h-10 w-10 place-items-center rounded-xl ${offline ? "bg-coralsoft text-coral" : "bg-jadesoft text-jade"}`}>
            {offline ? <WifiOff className="h-5 w-5" /> : <Wave className="h-5 w-5" />}
          </span>
          <div>
            <p className="font-display text-[15px] font-extrabold">{offline ? "Sem conexão" : "Online"}</p>
            <p className="font-mono text-[10px] text-ink/50">{offline ? "dados sincronizados no aparelho" : "sincronizado com o servidor"}</p>
          </div>
        </div>
        <button onClick={() => setOffline((v) => !v)} aria-label="Alternar modo offline"
          className={`relative h-7 w-[52px] rounded-full transition-colors ${offline ? "bg-coral" : "bg-jade"}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-paper shadow transition-all ${offline ? "left-[26px]" : "left-1"}`} />
        </button>
      </div>

      <div className="mt-5 space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">suas consultas (sincronizadas)</p>
        {sync.slice(0, 2).map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-xl border border-line bg-cream px-3.5 py-2.5">
            <IcCalendar className="h-4.5 w-4.5 shrink-0 text-jade" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-bold">{fmtDataMedia(a.dataISO)} · {a.hora}</p>
              <p className="truncate text-[11px] text-ink/55">{state.medicos.find((m) => m.id === a.medicoId)?.nome}</p>
            </div>
            <span className="rounded-full bg-jadesoft px-2 py-0.5 font-mono text-[9px] font-bold text-jadedark">✓ offline</span>
          </div>
        ))}
      </div>

      <button disabled={offline}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-display text-[14px] font-extrabold transition-all ${offline ? "cursor-not-allowed bg-line text-ink/40" : "bg-pine text-mint hover:scale-[1.01]"}`}>
        {offline ? <><WifiOff className="h-4.5 w-4.5" /> Agendar exige conexão</> : <>Agendar nova consulta <IcChevR className="h-4 w-4" /></>}
      </button>
      {offline && (
        <p className="pop-in mt-2.5 rounded-xl border border-coral/40 bg-coralsoft px-3.5 py-2.5 text-[11.5px] leading-snug text-coral">
          <strong>Por que?</strong> Um novo agendamento precisa reservar o horário no servidor para evitar conflitos (RN03). Assim que a conexão voltar, o app sincroniza tudo sozinho.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-jadesoft p-3">
          <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-jadedark">Funciona offline</p>
          <ul className="mt-1.5 space-y-1 text-[11px] text-ink/75">
            <li>• Ouvir consultas sincronizadas</li>
            <li>• Lembretes e informações salvas</li>
            <li>• TTS local (quando suportado)</li>
          </ul>
        </div>
        <div className="rounded-xl bg-cream p-3 ring-1 ring-line">
          <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-ink/50">Precisa de conexão</p>
          <ul className="mt-1.5 space-y-1 text-[11px] text-ink/60">
            <li>• Novo agendamento</li>
            <li>• Cancelar / reagendar</li>
            <li>• Consultar horários atuais</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

/* ---------------- perfil do responsável ---------------- */
const PERMS = ["Ver consultas", "Receber lembretes", "Confirmar presença", "Reagendar", "Cancelar"] as const;
type Perm = (typeof PERMS)[number];
const ResponsavelDemo = () => {
  const [sel, setSel] = useState(0);
  const [perms, setPerms] = useState<Record<number, Set<Perm>>>({
    0: new Set(["Ver consultas", "Receber lembretes", "Confirmar presença"]),
    1: new Set(["Ver consultas", "Receber lembretes", "Confirmar presença", "Reagendar", "Cancelar"]),
  });
  const [log, setLog] = useState("Selecione uma ação para ver a validação da API.");
  const pessoas = [
    { nome: "Maria Aparecida", rel: "minha mãe", prox: "Cardiologia · Dra. Helena", quando: "em 5 dias", ini: "MA" },
    { nome: "José Ferreira", rel: "meu pai", prox: "Ortopedia · Dr. Otávio", quando: "amanhã", ini: "JF" },
  ];
  const toggle = (p: Perm) => {
    setPerms((old) => {
      const s = new Set(old[sel]);
      s.has(p) ? s.delete(p) : s.add(p);
      setLog(s.has(p) ? `Permissão “${p}” concedida e gravada pela API.` : `Permissão “${p}” revogada.`);
      return { ...old, [sel]: s };
    });
  };
  const agir = (acao: Perm) => {
    setLog(perms[sel].has(acao)
      ? `API validou: responsável autorizado a “${acao}” para ${pessoas[sel].nome}. Ação registrada.`
      : `API bloqueou: você não tem permissão de “${acao}” para ${pessoas[sel].nome}. Peça autorização no app.`);
  };
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 shadow-lg">
      <div className="flex gap-2">
        {pessoas.map((p, i) => (
          <button key={p.nome} onClick={() => setSel(i)} aria-label={`Acompanhar ${p.nome}`}
            className={`flex flex-1 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${sel === i ? "border-jade bg-jadesoft" : "border-line bg-cream hover:border-jade/40"}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pine font-display text-[12px] font-extrabold text-mint">{p.ini}</span>
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-extrabold">{p.nome}</span>
              <span className="block text-[10.5px] text-ink/55">{p.rel}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-cream p-4">
        <p className="font-mono text-[9px] uppercase tracking-widest text-ink/45">próxima consulta de {pessoas[sel].nome.split(" ")[0]}</p>
        <p className="mt-1 text-[14px] font-extrabold">{pessoas[sel].prox}</p>
        <p className="text-[12px] text-jade font-bold">{pessoas[sel].quando} · aguardando confirmação</p>
      </div>

      <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-ink/45">permissões concedidas</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PERMS.map((p) => (
          <button key={p} onClick={() => toggle(p)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${perms[sel].has(p) ? "border-jade bg-jadesoft text-jadedark" : "border-line bg-cream text-ink/45"}`}>
            {perms[sel].has(p) ? "✓ " : ""}{p}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={() => agir("Confirmar presença")} className="rounded-xl bg-pine px-3 py-3 text-[12.5px] font-extrabold text-mint hover:scale-[1.01]">Confirmar presença</button>
        <button onClick={() => agir("Reagendar")} className="rounded-xl bg-cream px-3 py-3 text-[12.5px] font-extrabold ring-1 ring-line hover:scale-[1.01]">Reagendar</button>
      </div>
      <p className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-cream px-3.5 py-2.5 text-[11.5px] leading-snug text-ink/70" aria-live="polite">
        <IcLock className="mt-0.5 h-4 w-4 shrink-0 text-jade" />{log}
      </p>
    </div>
  );
};

/* ---------------- seção ---------------- */
export default function AcessibilidadeSection() {
  return (
    <section id="acessibilidade" className="relative overflow-hidden bg-deep py-20 text-paper">
      <div className="deco pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-jade/10 blur-3xl" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <SectionHead dark num="04" kicker="Acessibilidade radical"
            title={<>Inclusão não é um filtro.<br />É <span className="text-jade">outro jeito de usar</span>.</>}
            lead="Voz para quem não vê, alto contraste e botões grandes para a terceira idade, um responsável que acompanha de longe — e tudo isso funcionando mesmo sem internet." />
          <Reveal delay={120}>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {["🎙 entrada por voz", "🔊 respostas faladas", "👁 alto contraste", "🤝 responsável", "📴 offline"].map((t) => (
                <span key={t} className="rounded-full border border-linedark bg-pine px-3.5 py-1.5 font-mono text-[11px] text-mint/85">{t}</span>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[400px_1fr]">
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
                Em vez de navegar por menus, a pessoa fala — <em>“qual minha próxima consulta?”</em>, <em>“quero remarcar”</em> — e a Lia responde em áudio.
                Ações críticas, como cancelar, exigem confirmação antes de executar a Tool. <strong className="text-mint">Experimente com o microfone</strong> (ou toque nos exemplos).
              </p>
            </div>
            <VoiceDemo />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
