import React, { useEffect } from "react";
import { ClinicProvider, useClinic } from "./store";
import TopBar from "./components/TopBar";
import Hero from "./components/Hero";
import DoctorPanel from "./components/DoctorPanel";
import AdminPanel from "./components/AdminPanel";
import RulesSection from "./components/RulesSection";
import AcessibilidadeSection from "./components/AcessibilidadeSection";
import AutomacaoSection from "./components/AutomacaoSection";
import PitchSection from "./components/PitchSection";
import { IcLogo } from "./components/icons";
import { ToastMsg } from "./data";

/* ---------- toasts globais ---------- */
const ToastItem = ({ t }: { t: ToastMsg }) => {
  const { dispatch } = useClinic();
  useEffect(() => {
    const timer = setTimeout(() => dispatch({ t: "untoast", id: t.id }), 3400);
    return () => clearTimeout(timer);
  }, [t.id, dispatch]);
  return (
    <div className={`toast-in pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-3 shadow-xl ${
      t.tom === "erro" ? "border-coral/50 bg-coralsoft text-coral" : t.tom === "info" ? "border-pine/30 bg-deep text-mint" : "border-jade/50 bg-jadesoft text-jadedark"
    }`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${t.tom === "erro" ? "bg-coral" : t.tom === "info" ? "bg-mint" : "bg-jade"}`} />
      <p className="text-[12.5px] font-bold leading-snug">{t.texto}</p>
    </div>
  );
};
const Toasts = () => {
  const { state } = useClinic();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(340px,calc(100vw-2rem))] flex-col gap-2">
      {state.toasts.map((t) => <ToastItem key={t.id} t={t} />)}
    </div>
  );
};

/* ---------- rodapé ---------- */
const Footer = () => (
  <footer className="border-t border-linedark bg-abyss py-12 text-paper">
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <IcLogo className="h-9 w-9" />
            <span className="font-display text-xl font-extrabold">Fácil<span className="text-jade">Med</span></span>
          </div>
          <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-mint/65">
            Sistema inteligente de agendamento para clínicas multiprofissionais: secretária virtual com IA local,
            fila de espera sequencial e acessibilidade de verdade para a terceira idade.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["RN01 · trava 30 min", "RN02 · fila 60 min", "RN03 · FOR UPDATE"].map((r) => (
              <span key={r} className="rounded-full border border-linedark px-3 py-1 font-mono text-[10px] text-mint/60">{r}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-mintdark">Navegue</p>
          <ul className="mt-4 space-y-2.5">
            {[["#demo", "Demo do app do paciente"], ["#medico", "Painel do médico"], ["#gestao", "Gestão & fila de espera"], ["#regras", "Regras de negócio"], ["#pitch", "Pitch SENAI"]].map(([h, l]) => (
              <li key={h}><a href={h} className="text-[13.5px] text-mint/75 transition-colors hover:text-jade">{l}</a></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-mintdark">Privacidade</p>
          <p className="mt-4 text-[13.5px] leading-relaxed text-mint/65">
            A IA roda <strong className="text-mint">100% dentro da clínica</strong> (Ollama + Llama 3). Nenhum dado de saúde
            sai do servidor local — nem para marcar um simples horário.
          </p>
          <p className="mt-4 font-mono text-[11px] text-mint/45">recepção humana: (11) 4002-8922</p>
        </div>
      </div>
      <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-linedark pt-6 font-mono text-[10.5px] text-mint/45 sm:flex-row">
        <p>Protótipo demonstrativo · dados fictícios · nenhum paciente real foi agendado 😄</p>
        <p>SENAI · Projeto Integrador 2026 · React Native + Node + MySQL + Ollama</p>
      </div>
    </div>
  </footer>
);

export default function App() {
  return (
    <ClinicProvider>
      <div className="min-h-screen font-body text-ink antialiased">
        <TopBar />
        <main>
          <Hero />
          <DoctorPanel />
          <AdminPanel />
          <AcessibilidadeSection />
          <AutomacaoSection />
          <RulesSection />
          <PitchSection />
        </main>
        <Footer />
        <Toasts />
      </div>
    </ClinicProvider>
  );
}
