import React, { useState } from "react";
import { Ecg, Reveal } from "./ui";
import { IcCheck, IcChevR, IcChip, IcDb, IcPhone, IcPulse, IcQueue, IcSpark } from "./icons";

const TABS = ["schema.sql", "tools.json", "system.txt"] as const;
const CODE: Record<(typeof TABS)[number], string> = {
  "schema.sql": `-- núcleo do controle de agenda (MySQL)
CREATE TABLE agendamentos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id   INT NOT NULL,
  medico_id     INT NOT NULL,
  data_hora     DATETIME NOT NULL,
  tipo_pagamento ENUM('CONVENIO','PARTICULAR') NOT NULL,
  status        ENUM('AGENDADO','CONCLUIDO',
                'CANCELADO','NAO_COMPARECEU')
                DEFAULT 'AGENDADO',
  UNIQUE KEY uq_vaga (medico_id, data_hora) -- RN03
);

CREATE TABLE fila_espera (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id   INT NOT NULL,
  medico_id     INT NOT NULL,
  data_desejada DATE NOT NULL,
  posicao_fila  INT NOT NULL,
  status        ENUM('AGUARDANDO','NOTIFICADO',
                'EXPIRADO','CONFIRMADO'),
  horario_notificacao DATETIME NULL  -- janela 1h (RN02)
);`,
  "tools.json": `// ferramentas expostas ao modelo (Ollama)
{
  "tools": [{
    "type": "function",
    "function": {
      "name": "consultar_disponibilidade",
      "parameters": {
        "medico_id": "int", "data": "date"
      }
    }
  },{
    "type": "function",
    "function": {
      "name": "criar_agendamento",
      "parameters": {
        "paciente_id": "int", "medico_id": "int",
        "data_hora": "datetime",
        "tipo_pagamento": "CONVENIO|PARTICULAR",
        "carteirinha": "string?"
      }
    }
  },{
    "type": "function",
    "function": {
      "name": "cancelar_agendamento",
      "parameters": { "agendamento_id": "int" }
    }
  }]
}`,
  "system.txt": `Você é a secretária virtual autônoma do aplicativo
FácilMed. Sua função é atender pacientes, tirar dúvidas,
verificar horários disponíveis e realizar agendamentos,
cancelamentos e remarcações. Seja sempre acolhedora,
objetiva e clara.

Ao identificar uma intenção de agendamento, consulte a
ferramenta de listagem de horários. Se o horário
solicitado estiver ocupado, informe o usuário e ofereça
as opções livres mais próximas.

Se o usuário quiser cancelar uma consulta com menos de
30 minutos de antecedência, informe que a regra do
sistema não permite o cancelamento automático e
oriente-o a procurar a administração.`,
};

const STACK = ["React Native · Expo", "React + Tailwind", "Node.js · Express", "MySQL 8", "Ollama · Llama 3", "Local-first"];

export default function PitchSection() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("schema.sql");
  return (
    <section id="pitch" className="relative bg-abyss py-20 text-paper">
      <Ecg className="pointer-events-none absolute inset-x-0 top-10 h-10 w-full opacity-30" stroke="#cbe7d9" />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        {/* coluna fixa */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-mintdark">[ 07 · Pitch SENAI ]</p>
            <h2 className="mt-4 font-display text-3xl font-extrabold leading-[1.04] tracking-tight sm:text-5xl">
              Por que o FácilMed<br />vence a recepção lotada
            </h2>
            <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-mint/70">
              Uma plataforma que une <strong className="text-paper">acessibilidade extrema</strong> para a terceira idade com
              <strong className="text-paper"> automação total</strong> de agendamento — e roda a IA dentro da clínica, de graça.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-7 flex flex-wrap gap-2">
              {STACK.map((s) => (
                <span key={s} className="rounded-full border border-linedark bg-pine/60 px-3.5 py-1.5 font-mono text-[11px] text-mint/85 transition-colors hover:border-jade/60 hover:text-mint">
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-jade/40 bg-jade/10 px-4 py-3">
              <IcChip className="h-6 w-6 shrink-0 text-jade" />
              <div>
                <p className="font-display text-[15px] font-extrabold text-mint">Custo de IA por consulta: R$ 0,00</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-mint/50">ollama roda no servidor da clínica</p>
              </div>
            </div>
          </Reveal>
        </div>

        {/* cards roláveis */}
        <div className="space-y-5">
          <Reveal>
            <div className="rounded-3xl border border-linedark bg-deep p-6 sm:p-7">
              <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.22em] text-coral">O problema</p>
              <div className="mt-4 space-y-3">
                {[
                  ["30%", "das consultas viram no-show em clínicas populares — agenda furada é receita perdida"],
                  ["47 min", "de espera média na linha telefônica de uma clínica com 6 especialidades"],
                  ["1", "recepção para 6 agendas, 2 convênios e uma fila de gente parada na porta"],
                ].map(([n, t]) => (
                  <div key={n} className="flex items-baseline gap-4 rounded-2xl bg-paper/5 px-4 py-3.5">
                    <span className="font-display text-3xl font-extrabold text-coral">{n}</span>
                    <p className="text-[13.5px] leading-snug text-mint/80">{t}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={60}>
            <div className="rounded-3xl border border-linedark bg-deep p-6 sm:p-7">
              <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.22em] text-jade">A solução</p>
              <ul className="mt-4 space-y-2.5">
                {[
                  "Secretária virtual que entende “quero marcar cardio pra quinta à tarde” e já grava no banco",
                  "Calendário com semáforo visual: passado escuro, lotado cinza, livre verde — até sem óculos",
                  "Modo Simplificado: um toque troca para letras grandes, alto contraste e dois botões",
                  "Fila de espera viva, que devolve à agenda cada cancelamento em até 60 minutos",
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-3 text-[14px] leading-snug text-mint/85">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-jade/20 text-jade"><IcCheck className="h-3.5 w-3.5" /></span>{t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={90}>
            <div className="rounded-3xl border border-linedark bg-deep p-6 sm:p-7">
              <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.22em] text-amber">Diferenciais competitivos</p>
              <div className="mt-4 space-y-4">
                {[
                  ["01", <IcSpark key="a" className="h-5 w-5" />, "Chatbot autônomo com Ollama local", "Function calling direto no MySQL — sem API de nuvem, sem custo por token, sem dado do paciente saindo da clínica."],
                  ["02", <IcQueue key="b" className="h-5 w-5" />, "Fila de espera com janela de 1 hora", "Notificação sequencial (só o 1º colocado) e repasse automático — a taxa de ocupação se recupera sozinha."],
                  ["03", <IcPhone key="c" className="h-5 w-5" />, "Interface adaptável de verdade", "Inclusão digital para idosos não é fonte um pouco maior: é outro modo de usar o app inteiro."],
                ].map(([n, ic, t, d]) => (
                  <div key={n as string} className="flex gap-4">
                    <span className="font-display text-2xl font-extrabold text-paper/20">{n as string}</span>
                    <div>
                      <p className="flex items-center gap-2 font-display text-[15px] font-extrabold text-paper"><span className="text-amber">{ic}</span>{t as string}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-mint/70">{d as string}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-3xl border border-linedark bg-deep p-6 sm:p-7">
              <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.22em] text-steel">Arquitetura</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {[
                  [<IcPhone key="i" className="h-4.5 w-4.5" />, "App paciente", "React Native"],
                  [<IcPulse key="j" className="h-4.5 w-4.5" />, "Painel web", "React + Tailwind"],
                ].map(([ic, a, b], i) => (
                  <React.Fragment key={i}>
                    <div className="rounded-xl border border-linedark bg-pine/60 px-3.5 py-2.5 text-center">
                      <p className="flex items-center justify-center gap-1.5 text-[12px] font-bold text-mint">{ic}{a}</p>
                      <p className="font-mono text-[9px] text-mint/50">{b}</p>
                    </div>
                    {i === 0 && <IcChevR className="h-4 w-4 text-mint/40" />}
                  </React.Fragment>
                ))}
                <span className="font-mono text-[10px] text-mint/40">REST ↓↑</span>
                <div className="rounded-xl border border-jade/50 bg-jade/10 px-3.5 py-2.5 text-center">
                  <p className="flex items-center justify-center gap-1.5 text-[12px] font-bold text-mint"><IcSpark className="h-4.5 w-4.5" />Node + Ollama</p>
                  <p className="font-mono text-[9px] text-mint/50">tool calling</p>
                </div>
                <IcChevR className="h-4 w-4 text-mint/40" />
                <div className="rounded-xl border border-linedark bg-pine/60 px-3.5 py-2.5 text-center">
                  <p className="flex items-center justify-center gap-1.5 text-[12px] font-bold text-mint"><IcDb className="h-4.5 w-4.5" />MySQL 8</p>
                  <p className="font-mono text-[9px] text-mint/50">FOR UPDATE · RN03</p>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className="overflow-hidden rounded-3xl border border-linedark bg-deep">
              <div className="flex items-center gap-1 border-b border-linedark px-3 pt-3">
                {TABS.map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`rounded-t-lg px-3.5 py-2 font-mono text-[11px] transition-colors ${tab === t ? "bg-abyss text-jade" : "text-mint/50 hover:text-mint"}`}>
                    {t}
                  </button>
                ))}
                <span className="ml-auto hidden pr-2 font-mono text-[9px] uppercase tracking-widest text-mint/35 sm:block">trecho real do projeto</span>
              </div>
              <pre className="thin-scroll-dark max-h-[380px] overflow-auto bg-abyss p-4 font-mono text-[11px] leading-relaxed text-mint/80">{CODE[tab]}</pre>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
