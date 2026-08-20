import React from "react";
import { Reveal, SectionHead } from "./ui";
import { IcBell, IcCheck, IcLock, IcPhone, IcQueue, IcShield, IcX } from "./icons";

const Step = ({ n, icon, titulo, desc, ring = false }: { n: string; icon: React.ReactNode; titulo: string; desc: string; ring?: boolean }) => (
  <div className="relative">
    <div className="flex h-full flex-col rounded-2xl border border-line bg-paper p-4 transition-all hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-jadesoft text-jade">{icon}</span>
        <span className="font-mono text-[10px] font-bold text-ink/35">{n}</span>
      </div>
      <p className="mt-3 font-display text-[13.5px] font-extrabold leading-tight">{titulo}</p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-ink/60">{desc}</p>
      {ring && (
        <div className="mt-3 flex items-center gap-2.5">
          <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
            <circle cx="22" cy="22" r="18" fill="none" stroke="#e0f0e8" strokeWidth="5" />
            <circle cx="22" cy="22" r="18" fill="none" stroke="#f0a32f" strokeWidth="5" strokeLinecap="round"
              pathLength={1} strokeDasharray="1" className="ring-anim" />
          </svg>
          <p className="font-mono text-[11px] font-extrabold text-amber">60:00<span className="block text-[8.5px] font-semibold uppercase tracking-wide text-ink/45">janela p/ confirmar</span></p>
        </div>
      )}
    </div>
  </div>
);

export default function RulesSection() {
  return (
    <section id="regras" className="relative scroll-mt-14 bg-cream/70 py-20 sm:scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead num="06" kicker="Regras de negócio"
          title={<>As três travas que fazem<br />a operação confiar na IA.</>}
          lead="Automação sem regra de negócio é caos. O AcolheMed codifica as políticas da clínica no banco — nem o chatbot consegue passar por cima." />

        <div className="mt-12 space-y-6">
          {/* RN01 */}
          <Reveal>
            <div className="grid gap-6 rounded-3xl border border-line bg-paper p-6 shadow-sm sm:p-8 lg:grid-cols-[340px_1fr] lg:items-center">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-coralsoft px-3 py-1 font-mono text-[10px] font-extrabold uppercase tracking-[0.18em] text-coral">RN01 · Cancelamento</span>
                <h3 className="mt-3 font-display text-2xl font-extrabold leading-tight">Trava de 30 minutos</h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-ink/70">
                  O paciente cancela sozinho pelo app ou pela Lia — <strong>até 30 minutos antes</strong> da consulta.
                  Dentro da janela crítica, o sistema bloqueia e orienta o contato com a recepção, protegendo o profissional de furos de última hora.
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-cream/60 p-5">
                <div className="flex justify-between font-mono text-[10px] text-ink/45">
                  <span>-2h</span><span>-1h</span><span className="font-bold text-coral">-30 min</span><span className="font-bold text-ink">consulta 10:00</span>
                </div>
                <div className="relative mt-2 h-4 rounded-full" style={{ background: "linear-gradient(90deg,#0c8a64 0%,#0c8a64 55%,#f0a32f 62%,#e5484d 78%,#e5484d 100%)" }}>
                  <span className="absolute -bottom-1.5 -top-1.5 left-[62%] w-0.5 rounded bg-coral" />
                  <span className="rn-marker absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2">
                    <span className="grid h-full w-full place-items-center rounded-full border-[3px] border-paper bg-deep text-paper shadow-lg"><IcLock className="h-3.5 w-3.5" /></span>
                  </span>
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-pine text-mint ring-4 ring-paper"><IcBell className="h-4 w-4" /></span>
                  </span>
                </div>
                <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  <div className="flex items-center gap-2.5 rounded-xl border border-jade/40 bg-jadesoft px-3.5 py-2.5">
                    <IcCheck className="h-4.5 w-4.5 shrink-0 text-jade" />
                    <p className="text-[12px] font-bold text-jadedark">Antes de -30 min: cancelamento automático, vaga vai pra fila</p>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-xl border border-coral/40 bg-coralsoft px-3.5 py-2.5">
                    <IcPhone className="h-4.5 w-4.5 shrink-0 text-coral" />
                    <p className="text-[12px] font-bold text-coral">Dentro de -30 min: só a recepção libera · (11) 4002-8922</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* RN02 */}
          <Reveal delay={80}>
            <div className="rounded-3xl border border-line bg-paper p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-ambersoft px-3 py-1 font-mono text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber">RN02 · Fila de espera</span>
                <h3 className="font-display text-2xl font-extrabold leading-tight">A fila que se preenche sozinha</h3>
                <span className="ml-auto hidden font-mono text-[10.5px] text-ink/45 lg:block">teste ao vivo no painel de Gestão ↑</span>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Step n="01" icon={<IcX className="h-5 w-5" />} titulo="Vaga cancela" desc="Paciente desmarca (ou a clínica remaneja) e o horário volta pro banco." />
                <Step n="02" icon={<IcQueue className="h-5 w-5" />} titulo="1º é notificado" desc="Push no app só para o primeiro da fila — nada de disparo em massa." />
                <Step n="03" icon={<IcBell className="h-5 w-5" />} titulo="Janela de 60 min" desc="Cronômetro começa a correr na hora da notificação." ring />
                <Step n="04" icon={<IcCheck className="h-5 w-5" />} titulo="Confirma → agenda" desc="Um toque e a consulta entra na agenda do médico, com protocolo." />
                <Step n="05" icon={<IcQueue className="h-5 w-5" />} titulo="Expirou → próximo" desc="Sem resposta? A vaga escorrega pro 2º colocado. E assim vai." />
              </div>
            </div>
          </Reveal>

          {/* RN03 */}
          <Reveal delay={120}>
            <div className="grid gap-6 rounded-3xl border border-line bg-paper p-6 shadow-sm sm:p-8 lg:grid-cols-[340px_1fr] lg:items-center">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-steelsoft px-3 py-1 font-mono text-[10px] font-extrabold uppercase tracking-[0.18em] text-steel">RN03 · Concorrência</span>
                <h3 className="mt-3 font-display text-2xl font-extrabold leading-tight">Um horário, um dono</h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-ink/70">
                  Dois pacientes — ou um paciente e a IA — tentando o mesmo minuto? O MySQL trava a linha com
                  <strong> SELECT … FOR UPDATE</strong>: o primeiro leva, o segundo recebe o erro e já vê os horários vizinhos livres.
                </p>
                <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-line bg-cream/70 px-3.5 py-2.5">
                  <IcShield className="h-5 w-5 shrink-0 text-steel" />
                  <p className="text-[12px] text-ink/65">Na demo do app, o <strong>primeiro horário livre</strong> de alguns dias simula essa corrida — tente reservar e veja a trava agir.</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl bg-deep shadow-xl">
                <div className="flex items-center gap-1.5 border-b border-linedark px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-coral/70" /><span className="h-2.5 w-2.5 rounded-full bg-amber/70" /><span className="h-2.5 w-2.5 rounded-full bg-jade/70" />
                  <span className="ml-2 font-mono text-[10px] text-mint/50">reserva.sql · transação de agendamento</span>
                </div>
                <pre className="thin-scroll-dark overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-mint/85">
{`BEGIN;

-- paciente A e paciente B pedem 10:00 ao mesmo tempo
SELECT id FROM agendamentos
 WHERE medico_id = 1 AND data_hora = '2026-03-12 10:00'
 FOR UPDATE;              -- tranca a linha p/ B

INSERT INTO agendamentos (paciente_id, medico_id,
  data_hora, status) VALUES (42, 1, ..., 'AGENDADO');

COMMIT;                   -- A levou ✓  201 Created
                          -- B recebeu  409 Conflict
                          --            + horários vizinhos`}
                </pre>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
