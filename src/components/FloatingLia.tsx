import React, { useEffect, useState } from "react";
import Chat from "./Chat";
import { IcSpark, IcX } from "./icons";

export default function FloatingLia() {
  const [open, setOpen] = useState(false);

  /* trava o scroll do body enquanto o painel está aberto no mobile */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir a secretária virtual Lia"
        className="fixed bottom-4 left-4 z-[60] flex items-center gap-2.5 rounded-full border border-jade/40 bg-pine py-2 pl-2.5 pr-4 text-mint shadow-2xl shadow-deep/50 transition-all hover:-translate-y-0.5 hover:bg-jadedark active:scale-95"
      >
        <span className="relative grid h-9 w-9 place-items-center rounded-full bg-jade text-paper">
          <IcSpark className="h-5 w-5" />
          <span className="pulse-dot absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-mint" />
        </span>
        <span className="text-left leading-tight">
          <span className="block font-display text-[13px] font-extrabold">Falar com a Lia</span>
          <span className="block font-mono text-[8.5px] uppercase tracking-[0.18em] text-mintdark">secretária IA · agora</span>
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[75] flex items-end justify-center bg-abyss/75 sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Secretária virtual Lia"
        >
          <div
            className="pop-in relative flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-linedark bg-paper shadow-2xl sm:h-[min(640px,86dvh)] sm:max-w-[430px] sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar conversa"
              className="absolute right-3 top-2.5 z-50 grid h-8 w-8 place-items-center rounded-full border border-line bg-paper text-ink/60 shadow-sm transition-colors hover:bg-cream hover:text-ink"
            >
              <IcX className="h-4 w-4" />
            </button>
            <Chat variant="phone" />
          </div>
        </div>
      )}
    </>
  );
}
