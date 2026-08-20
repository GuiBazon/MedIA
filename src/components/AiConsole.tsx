import React, { useRef, useState } from "react";
import Chat, { ToolCallInfo } from "./Chat";
import { Ecg, Reveal, SectionHead } from "./ui";
import { IcShield, IcSpark } from "./icons";

const TOOLS: [string, string][] = [
  ["buscar_consulta", "localiza consultas do paciente"],
  ["buscar_horarios", "agenda real do médico na data"],
  ["agendar_consulta", "grava no banco com trava RN03"],
  ["cancelar_consulta", "valida a janela de 30 min (RN01)"],
  ["reagendar_consulta", "troca preservando convênio/carteirinha"],
  ["confirmar_consulta", "registra presença p/ recepção"],
  ["buscar_orientacoes", "“o que levar” por especialidade"],
  ["buscar_responsavel", "quem pode agir pelo paciente"],
  ["inserir_fila_espera", "fila sequencial com janela de 1h"],
  ["consultar_fila", "posição e status em tempo real"],
];

const CENARIOS = [
  "Quero marcar cardiologia amanhã de manhã pelo convênio",
  "Tem vaga com o Dr. Otávio sexta?",
  "Quero remarcar minha consulta",
  "Cancelar minha consulta de ortopedia",
  "O que levar na consulta de sangue?",
  "Como está a minha fila de espera?",
  "Quem é meu responsável?",
  "Quanto custa o dentista?",
  "Quais médicos atendem sábado?",
  "Quero falar com um atendente",
];

export default function AiConsole() {
  const [log, setLog] = useState<ToolCallInfo[]>([]);
  const apiRef = useRef<{ send: (t: string) => void } | null>(null);
  const chatWrap = useRef<HTMLDivElement>(null);

  const experimentar = (c: string) => {
    apiRef.current?.send(c);
    if (window.innerWidth < 1024) chatWrap.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section id="ia" className="relative scroll-mt-14 overflow-hidden bg-deep py-16 text-paper sm:scroll-mt-16 sm:py-20">
      <Ecg className="pointer-events-none absolute inset-x-0 top-8 h-10 w-full opacity-25" stroke="#cbe7d9" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead
          dark
          num="01"
          kicker="Central de ajuda · IA"
          title={<>A recepção que <span className="text-jade">atende, entende e resolve.</span></>}
          lead="A Lia não é um chatbot de respostas prontas: cada pedido vira uma Tool que passa pela API, valida permissões e regras de negócio — e só então toca no banco. Teste agora, do jeito que você falaria."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
          {/* chat — primeiro no DOM = primeiro no mobile */}
          <Reveal className="order-1">
            <div ref={chatWrap} className="flex h-[520px] max-h-[72dvh] flex-col overflow-hidden rounded-3xl border border-linedark shadow-2xl shadow-abyss/60 sm:h-[640px] sm:max-h-[74dvh]">
              <Chat variant="console" onTool={(t) => setLog((p) => [t, ...p].slice(0, 7))} apiRef={apiRef} />
            </div>
            <p className="mt-3 text-center font-mono text-[10.5px] text-mint/45">
              tudo o que a Lia fizer aqui aparece nas agendas, na fila e no painel de gestão — ao lado ↑
            </p>
          </Reveal>

          <div className="order-2 space-y-5">
            {/* experimente */}
            <Reveal delay={80}>
              <div className="rounded-3xl border border-linedark bg-pine/40 p-5">
                <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.22em] text-mintdark">Experimente falar</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {CENARIOS.map((c) => (
                    <button key={c} onClick={() => experimentar(c)}
                      className="rounded-full border border-jade/40 bg-deep/60 px-3 py-1.5 text-[12px] font-bold text-mint/90 transition-all hover:-translate-y-0.5 hover:border-jade hover:bg-jade hover:text-paper">
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* tools */}
            <Reveal delay={140}>
              <div className="rounded-3xl border border-linedark bg-pine/40 p-5">
                <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.22em] text-mintdark">As 10 tools da agente</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {TOOLS.map(([nome, desc]) => (
                    <div key={nome} className="group rounded-xl border border-linedark bg-deep/50 px-3 py-2.5 transition-colors hover:border-jade/50">
                      <p className="font-mono text-[11.5px] font-bold text-jade">{nome}()</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-mint/60">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* log ao vivo */}
            <Reveal delay={200}>
              <div className="overflow-hidden rounded-3xl border border-linedark bg-abyss">
                <div className="flex items-center gap-2 border-b border-linedark px-4 py-2.5">
                  <span className="pulse-dot h-2 w-2 rounded-full bg-jade" />
                  <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.22em] text-mintdark">tool calls · ao vivo</p>
                </div>
                <div className="thin-scroll-dark max-h-44 overflow-y-auto p-4 font-mono text-[10.5px] leading-relaxed">
                  {log.length === 0 ? (
                    <p className="text-mint/35">nenhuma chamada ainda — pergunte algo ao lado…</p>
                  ) : (
                    log.map((t, i) => (
                      <div key={i} className={`mb-2 ${i === 0 ? "text-mint" : "text-mint/45"}`}>
                        <span className="text-amber">⚙</span> <span className="text-jade">{t.name}</span>
                        <span className="text-mint/50">({t.args})</span>
                        <div className="pl-4 text-mintdark">↳ {t.result}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Reveal>

            {/* garantias */}
            <Reveal delay={240}>
              <div className="flex items-start gap-3 rounded-3xl border border-jade/30 bg-jade/10 p-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-jade/20 text-jade"><IcShield className="h-5 w-5" /></span>
                <div>
                  <p className="font-display text-[15px] font-extrabold text-mint">A IA obedece às mesmas regras que a recepção</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-mint/70">
                    Cada tool é validada pela API antes de executar: permissões do usuário, trava de 30 min (RN01),
                    janela da fila (RN02) e bloqueio transacional de horários (RN03). Peça o impossível — ela explica o porquê.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        <Reveal delay={100} className="mt-8 flex items-center justify-center gap-2 font-mono text-[10.5px] text-mint/40">
          <IcSpark className="h-3.5 w-3.5 text-jade" />
          a mesma agente vive no app do paciente (aba IA) e no botão flutuante — uma só memória, uma só clínica
        </Reveal>
      </div>
    </section>
  );
}
