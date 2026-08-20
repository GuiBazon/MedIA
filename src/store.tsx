import React, { createContext, useContext, useEffect, useReducer } from "react";
import {
  Agendamento, FilaEntry, Medico, Notif, ToastMsg, MEDICOS_SEED, buildSeeds, slotKey, MIN_CANCEL, minutesUntil,
} from "./data";

export type ModoInterface = "PADRAO" | "SIMPLIFICADO";

export interface State {
  mode: ModoInterface;
  medicos: Medico[];
  ags: Agendamento[];
  fila: FilaEntry[];
  notifs: Notif[];
  toasts: ToastMsg[];
  freed: string[];   /* slots devolvidos pela fila (RN02) */
  extra: string[];   /* slots perdidos em corrida transacional (RN03) */
}

const seeds = buildSeeds();
const initial: State = {
  mode: "PADRAO",
  medicos: MEDICOS_SEED,
  ags: seeds.ags,
  fila: seeds.fila,
  notifs: seeds.notifs,
  toasts: [],
  freed: [],
  extra: [],
};

let seq = 1000;
const nid = () => ++seq;

export type Action =
  | { t: "setMode"; mode: ModoInterface }
  | { t: "addAg"; ag: Agendamento }
  | { t: "cancelAg"; id: number }
  | { t: "setStatusAg"; id: number; status: Agendamento["status"] }
  | { t: "saveNotas"; id: number; texto: string }
  | { t: "addMedico"; med: Medico }
  | { t: "setJornadas"; medicoId: number; jornadas: Medico["jornadas"] }
  | { t: "freeSlot"; key: string; medicoId: number; dataISO: string }
  | { t: "joinFila"; medicoId: number; dataISO: string; paciente: string; voce?: boolean }
  | { t: "expireNow"; waitId: number }
  | { t: "confirmFila"; waitId: number }
  | { t: "tickFila" }
  | { t: "raceLost"; key: string }
  | { t: "pushNotif"; n: Notif }
  | { t: "markLidas" }
  | { t: "toast"; texto: string; tom?: ToastMsg["tom"] }
  | { t: "untoast"; id: number };

/* Notifica o 1º da fila (RN02) para a vaga aberta */
function notificarPrimeiro(fila: FilaEntry[], medicoId: number, dataISO: string, key: string, notifs: Notif[]): { fila: FilaEntry[]; notifs: Notif[] } {
  const candidatos = fila
    .filter((f) => f.medicoId === medicoId && f.dataISO === dataISO && f.status === "AGUARDANDO")
    .sort((a, b) => a.posicao - b.posicao);
  if (!candidatos.length) return { fila, notifs };
  const alvo = candidatos[0];
  const novaFila = fila.map((f) =>
    f.id === alvo.id ? { ...f, status: "NOTIFICADO" as const, janelaRestante: 60, vagaKey: key } : f,
  );
  const n: Notif = alvo.voce
    ? { id: nid(), titulo: "Vaga liberada para você!", texto: `Um horário de ${key.split("|")[2]} abriu em ${dataISO.split("-").reverse().slice(0, 2).join("/")}. Você tem 60 minutos para confirmar.`, tipo: "vaga", lida: false, waitId: alvo.id }
    : { id: nid(), titulo: "Fila de espera movimentada", texto: `Vaga de ${key.split("|")[2]} em ${dataISO.split("-").reverse().slice(0, 2).join("/")}: ${alvo.paciente} (1º da fila) foi notificado. Janela de 60 min aberta.`, tipo: "info", lida: false };
  return { fila: novaFila, notifs: [n, ...notifs] };
}

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case "setMode":
      return { ...s, mode: a.mode };
    case "addAg":
      return { ...s, ags: [...s.ags, a.ag] };
    case "cancelAg": {
      const ag = s.ags.find((x) => x.id === a.id);
      if (!ag) return s;
      const ags = s.ags.map((x) => (x.id === a.id ? { ...x, status: "CANCELADO" as const } : x));
      /* RN02: devolve a vaga ao 1º da fila daquela data */
      const key = slotKey(ag.medicoId, ag.dataISO, ag.hora);
      const r = notificarPrimeiro(s.fila, ag.medicoId, ag.dataISO, key, s.notifs);
      return { ...s, ags, fila: r.fila, notifs: r.notifs };
    }
    case "setStatusAg":
      return { ...s, ags: s.ags.map((x) => (x.id === a.id ? { ...x, status: a.status } : x)) };
    case "saveNotas":
      return { ...s, ags: s.ags.map((x) => (x.id === a.id ? { ...x, anotacoes: a.texto } : x)) };
    case "addMedico":
      return { ...s, medicos: [...s.medicos, a.med] };
    case "setJornadas":
      return { ...s, medicos: s.medicos.map((m) => (m.id === a.medicoId ? { ...m, jornadas: a.jornadas } : m)) };
    case "freeSlot": {
      if (s.freed.includes(a.key)) return s;
      const r = notificarPrimeiro(s.fila, a.medicoId, a.dataISO, a.key, s.notifs);
      return { ...s, freed: [...s.freed, a.key], fila: r.fila, notifs: r.notifs };
    }
    case "joinFila": {
      const daFila = s.fila.filter((f) => f.medicoId === a.medicoId && f.dataISO === a.dataISO && (f.status === "AGUARDANDO" || f.status === "NOTIFICADO"));
      if (daFila.some((f) => f.voce === a.voce && f.paciente === a.paciente)) return s;
      const pos = Math.max(0, ...daFila.map((f) => f.posicao)) + 1;
      return { ...s, fila: [...s.fila, { id: nid(), paciente: a.paciente, voce: a.voce, medicoId: a.medicoId, dataISO: a.dataISO, posicao: pos, status: "AGUARDANDO" }] };
    }
    case "expireNow":
      return { ...s, fila: s.fila.map((f) => (f.id === a.waitId && f.status === "NOTIFICADO" ? { ...f, janelaRestante: 0 } : f)) };
    case "confirmFila": {
      const f = s.fila.find((x) => x.id === a.waitId);
      if (!f || f.status !== "NOTIFICADO" || !f.vagaKey) return s;
      const [, dataISO, hora] = f.vagaKey.split("|");
      const ag: Agendamento = {
        id: nid(), paciente: f.paciente, voce: f.voce, medicoId: f.medicoId, dataISO, hora,
        tipo: "CONVENIO", carteirinha: f.voce ? "0042 8871 3345 09" : undefined,
        status: "AGENDADO", protocolo: `FM-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      };
      return {
        ...s,
        fila: s.fila.map((x) => (x.id === f.id ? { ...x, status: "CONFIRMADO" as const } : x)),
        ags: [...s.ags, ag],
        notifs: s.notifs.filter((n) => n.waitId !== f.id),
      };
    }
    case "tickFila": {
      if (!s.fila.some((f) => f.status === "NOTIFICADO")) return s;
      let fila = s.fila.map((f) =>
        f.status === "NOTIFICADO" && f.janelaRestante !== undefined ? { ...f, janelaRestante: Math.max(0, f.janelaRestante - 1) } : f,
      );
      let notifs = s.notifs;
      for (const f of fila) {
        if (f.status === "NOTIFICADO" && f.janelaRestante === 0 && f.vagaKey) {
          fila = fila.map((x) => (x.id === f.id ? { ...x, status: "EXPIRADO" as const } : x));
          const r = notificarPrimeiro(fila, f.medicoId, f.dataISO, f.vagaKey, notifs);
          fila = r.fila;
          notifs = [
            { id: nid(), titulo: "Janela expirada", texto: `${f.paciente} não confirmou em 60 min. A vaga foi repassada ao próximo da fila.`, tipo: "info", lida: false },
            ...r.notifs,
          ];
        }
      }
      return { ...s, fila, notifs };
    }
    case "raceLost":
      return s.extra.includes(a.key) ? s : { ...s, extra: [...s.extra, a.key] };
    case "pushNotif":
      return { ...s, notifs: [a.n, ...s.notifs] };
    case "markLidas":
      return { ...s, notifs: s.notifs.map((n) => ({ ...n, lida: true })) };
    case "toast":
      return { ...s, toasts: [...s.toasts, { id: nid(), texto: a.texto, tom: a.tom ?? "ok" }] };
    case "untoast":
      return { ...s, toasts: s.toasts.filter((t) => t.id !== a.id) };
    default:
      return s;
  }
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

export const ClinicProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initial);

  /* relógio da fila: 1s real = 1min de demonstração (janela de 60 min) */
  useEffect(() => {
    const ativo = state.fila.some((f) => f.status === "NOTIFICADO");
    if (!ativo) return;
    const t = setInterval(() => dispatch({ t: "tickFila" }), 1000);
    return () => clearInterval(t);
  }, [state.fila]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
};

export const useClinic = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useClinic fora do ClinicProvider");
  return c;
};

/* util: checa RN01 */
export const podeCancelar = (ag: Agendamento) => minutesUntil(ag.dataISO, ag.hora) >= MIN_CANCEL;
