import React, { createContext, useContext, useEffect, useReducer } from "react";
import {
  Agendamento, FilaEntry, Medico, Notif, ToastMsg, MEDICOS_SEED, buildSeeds, slotKey, MIN_CANCEL, minutesUntil,
  PacientePerfil, PERFIL_INICIAL, LembreteConfig, LEMBRETES_INICIAL, DependenteResponsavel, DEPENDENTES_SEED,
  AuditEntry, AUDITORIA_SEED, AcessibilidadePreferencias, addDaysISO,
} from "./data";

export type ModoInterface = "PADRAO" | "SIMPLIFICADO";

export interface State {
  mode: ModoInterface;
  offline: boolean;
  perfil: PacientePerfil;
  lembretes: LembreteConfig;
  dependentes: DependenteResponsavel[];
  auditoria: AuditEntry[];
  medicos: Medico[];
  ags: Agendamento[];
  fila: FilaEntry[];
  notifs: Notif[];
  toasts: ToastMsg[];
  freed: string[];   /* slots devolvidos pela fila (RN02) */
  extra: string[];   /* slots perdidos em corrida transacional (RN03) ou bloqueios */
}

const seeds = buildSeeds();
const initial: State = {
  mode: "PADRAO",
  offline: false,
  perfil: PERFIL_INICIAL,
  lembretes: LEMBRETES_INICIAL,
  dependentes: DEPENDENTES_SEED,
  auditoria: AUDITORIA_SEED,
  medicos: MEDICOS_SEED,
  ags: seeds.ags,
  fila: seeds.fila,
  notifs: seeds.notifs,
  toasts: [],
  freed: [],
  extra: [],
};

let seq = 2000;
const nid = () => ++seq;

export type Action =
  | { t: "setMode"; mode: ModoInterface }
  | { t: "setAccessibility"; key: keyof AcessibilidadePreferencias; val: boolean }
  | { t: "setProfile"; perfil: Partial<PacientePerfil> }
  | { t: "setLembretes"; lembretes: Partial<LembreteConfig> }
  | { t: "setOffline"; offline: boolean }
  | { t: "addAg"; ag: Agendamento }
  | { t: "cancelAg"; id: number; por?: string }
  | { t: "reagendarAg"; id: number; novaDataISO: string; novaHora: string; por?: string }
  | { t: "confirmarPresenca"; id: number; por?: string }
  | { t: "setStatusAg"; id: number; status: Agendamento["status"] }
  | { t: "saveNotas"; id: number; texto: string }
  | { t: "addMedico"; med: Medico }
  | { t: "setJornadas"; medicoId: number; jornadas: Medico["jornadas"] }
  | { t: "bloquearAgenda"; medicoId: number; dataISO: string; motivo: string }
  | { t: "reagendarLote"; medicoId: number; dataISO: string; novoDiaISO: string }
  | { t: "freeSlot"; key: string; medicoId: number; dataISO: string }
  | { t: "joinFila"; medicoId: number; dataISO: string; paciente: string; voce?: boolean }
  | { t: "leaveFila"; waitId: number }
  | { t: "expireNow"; waitId: number }
  | { t: "confirmFila"; waitId: number }
  | { t: "tickFila" }
  | { t: "raceLost"; key: string }
  | { t: "pushNotif"; n: Notif }
  | { t: "markLidas" }
  | { t: "toast"; texto: string; tom?: ToastMsg["tom"] }
  | { t: "untoast"; id: number }
  | { t: "toggleDependentePerm"; depId: number; perm: string }
  | { t: "agirDependente"; depId: number; acao: string; log: string }
  | { t: "addAuditLog"; quem: string; perfil: AuditEntry["perfil"]; acao: string; detalhes: string };

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
    case "setMode": {
      const isSimp = a.mode === "SIMPLIFICADO";
      return {
        ...s,
        mode: a.mode,
        perfil: {
          ...s.perfil,
          acessibilidade: {
            ...s.perfil.acessibilidade,
            modoSimplificado: isSimp,
            textoMaior: isSimp ? true : s.perfil.acessibilidade.textoMaior,
            botoesGrandes: isSimp ? true : s.perfil.acessibilidade.botoesGrandes,
            altoContraste: isSimp ? true : s.perfil.acessibilidade.altoContraste,
          },
        },
      };
    }

    case "setAccessibility": {
      const updated = { ...s.perfil.acessibilidade, [a.key]: a.val };
      return {
        ...s,
        mode: updated.modoSimplificado ? "SIMPLIFICADO" : "PADRAO",
        perfil: { ...s.perfil, acessibilidade: updated },
      };
    }

    case "setProfile":
      return { ...s, perfil: { ...s.perfil, ...a.perfil } };

    case "setLembretes":
      return { ...s, lembretes: { ...s.lembretes, ...a.lembretes } };

    case "setOffline":
      return { ...s, offline: a.offline };

    case "addAg": {
      const audit: AuditEntry = {
        id: nid(),
        quem: a.ag.voce ? (s.perfil.nome || "Maria Aparecida") : "Recepção",
        perfil: a.ag.voce ? "paciente" : "secretaria",
        acao: "Agendamento",
        detalhes: `Agendou consulta protocolo ${a.ag.protocolo} para ${a.ag.dataISO} às ${a.ag.hora}`,
        quando: "agora",
        timestamp: Date.now(),
      };
      return { ...s, ags: [...s.ags, a.ag], auditoria: [audit, ...s.auditoria] };
    }

    case "confirmarPresenca": {
      const ag = s.ags.find((x) => x.id === a.id);
      if (!ag) return s;
      const ags = s.ags.map((x) => (x.id === a.id ? { ...x, confirmada: true } : x));
      const audit: AuditEntry = {
        id: nid(),
        quem: a.por || (ag.voce ? s.perfil.nome : "Paciente"),
        perfil: a.por?.includes("Responsável") ? "responsavel" : ag.voce ? "paciente" : "secretaria",
        acao: "Confirmação de Presença",
        detalhes: `Confirmou presença na consulta de ${ag.dataISO} às ${ag.hora}`,
        quando: "agora",
        timestamp: Date.now(),
      };
      return { ...s, ags, auditoria: [audit, ...s.auditoria] };
    }

    case "reagendarAg": {
      const ag = s.ags.find((x) => x.id === a.id);
      if (!ag) return s;
      const oldData = ag.dataISO;
      const oldHora = ag.hora;
      const ags = s.ags.map((x) => (x.id === a.id ? { ...x, dataISO: a.novaDataISO, hora: a.novaHora, status: "AGENDADO" as const } : x));
      /* libera o horário antigo para a fila */
      const oldKey = slotKey(ag.medicoId, oldData, oldHora);
      const r = notificarPrimeiro(s.fila, ag.medicoId, oldData, oldKey, s.notifs);
      const audit: AuditEntry = {
        id: nid(),
        quem: a.por || (ag.voce ? s.perfil.nome : "Recepção"),
        perfil: a.por?.includes("Responsável") ? "responsavel" : a.por?.includes("IA") ? "ia" : ag.voce ? "paciente" : "secretaria",
        acao: "Reagendamento",
        detalhes: `Reagendou de ${oldData} ${oldHora} para ${a.novaDataISO} ${a.novaHora}`,
        quando: "agora",
        timestamp: Date.now(),
      };
      return { ...s, ags, fila: r.fila, notifs: r.notifs, auditoria: [audit, ...s.auditoria] };
    }

    case "cancelAg": {
      const ag = s.ags.find((x) => x.id === a.id);
      if (!ag) return s;
      const ags = s.ags.map((x) => (x.id === a.id ? { ...x, status: "CANCELADO" as const } : x));
      /* RN02: devolve a vaga ao 1º da fila daquela data */
      const key = slotKey(ag.medicoId, ag.dataISO, ag.hora);
      const r = notificarPrimeiro(s.fila, ag.medicoId, ag.dataISO, key, s.notifs);
      const audit: AuditEntry = {
        id: nid(),
        quem: a.por || (ag.voce ? s.perfil.nome : "Recepção"),
        perfil: a.por?.includes("Responsável") ? "responsavel" : a.por?.includes("IA") ? "ia" : ag.voce ? "paciente" : "secretaria",
        acao: "Cancelamento",
        detalhes: `Cancelou consulta de ${ag.dataISO} às ${ag.hora}. Horário devolvido à fila.`,
        quando: "agora",
        timestamp: Date.now(),
      };
      return { ...s, ags, fila: r.fila, notifs: r.notifs, auditoria: [audit, ...s.auditoria] };
    }

    case "setStatusAg": {
      const ag = s.ags.find((x) => x.id === a.id);
      const ags = s.ags.map((x) => (x.id === a.id ? { ...x, status: a.status } : x));
      const audit: AuditEntry = {
        id: nid(),
        quem: "Médico / Recepção",
        perfil: "medico",
        acao: "Atualização de Status",
        detalhes: `Marcou status como ${a.status} para ${ag?.paciente || "paciente"}`,
        quando: "agora",
        timestamp: Date.now(),
      };
      return { ...s, ags, auditoria: [audit, ...s.auditoria] };
    }

    case "saveNotas":
      return { ...s, ags: s.ags.map((x) => (x.id === a.id ? { ...x, anotacoes: a.texto } : x)) };

    case "addMedico": {
      const audit: AuditEntry = {
        id: nid(),
        quem: "Administrador",
        perfil: "admin",
        acao: "Cadastro de Médico",
        detalhes: `Cadastrou ${a.med.nome} (${a.med.crm}) na ${a.med.unidade || "Unidade Central"}`,
        quando: "agora",
        timestamp: Date.now(),
      };
      return { ...s, medicos: [...s.medicos, a.med], auditoria: [audit, ...s.auditoria] };
    }

    case "setJornadas":
      return { ...s, medicos: s.medicos.map((m) => (m.id === a.medicoId ? { ...m, jornadas: a.jornadas } : m)) };

    case "bloquearAgenda": {
      const med = s.medicos.find((m) => m.id === a.medicoId);
      const bloqueioKey = `block|${a.medicoId}|${a.dataISO}`;
      const audit: AuditEntry = {
        id: nid(),
        quem: "Secretária · Ana",
        perfil: "secretaria",
        acao: "Bloqueio de Agenda",
        detalhes: `Bloqueou agenda de ${med?.nome} em ${a.dataISO} (Motivo: ${a.motivo})`,
        quando: "agora",
        timestamp: Date.now(),
      };
      return {
        ...s,
        extra: [...s.extra, bloqueioKey],
        auditoria: [audit, ...s.auditoria],
      };
    }

    case "reagendarLote": {
      const ags = s.ags.map((ag) => {
        if (ag.medicoId === a.medicoId && ag.dataISO === a.dataISO && ag.status === "AGENDADO") {
          return { ...ag, dataISO: a.novoDiaISO };
        }
        return ag;
      });
      const med = s.medicos.find((m) => m.id === a.medicoId);
      const audit: AuditEntry = {
        id: nid(),
        quem: "Secretária · Automação",
        perfil: "secretaria",
        acao: "Reagendamento em Lote",
        detalhes: `Realocou pacientes de ${med?.nome} de ${a.dataISO} para ${a.novoDiaISO}`,
        quando: "agora",
        timestamp: Date.now(),
      };
      return { ...s, ags, auditoria: [audit, ...s.auditoria] };
    }

    case "freeSlot": {
      if (s.freed.includes(a.key)) return s;
      const r = notificarPrimeiro(s.fila, a.medicoId, a.dataISO, a.key, s.notifs);
      return { ...s, freed: [...s.freed, a.key], fila: r.fila, notifs: r.notifs };
    }

    case "joinFila": {
      const daFila = s.fila.filter((f) => f.medicoId === a.medicoId && f.dataISO === a.dataISO && (f.status === "AGUARDANDO" || f.status === "NOTIFICADO"));
      if (daFila.some((f) => f.voce === a.voce && f.paciente === a.paciente)) return s;
      const pos = Math.max(0, ...daFila.map((f) => f.posicao)) + 1;
      const audit: AuditEntry = {
        id: nid(),
        quem: a.voce ? s.perfil.nome : a.paciente,
        perfil: a.voce ? "paciente" : "secretaria",
        acao: "Entrada na Fila",
        detalhes: `Entrou na fila de espera para ${a.dataISO} (Posição ${pos}º)`,
        quando: "agora",
        timestamp: Date.now(),
      };
      return {
        ...s,
        fila: [...s.fila, { id: nid(), paciente: a.paciente, voce: a.voce, medicoId: a.medicoId, dataISO: a.dataISO, posicao: pos, status: "AGUARDANDO" }],
        auditoria: [audit, ...s.auditoria],
      };
    }

    case "leaveFila":
      return { ...s, fila: s.fila.filter((f) => f.id !== a.waitId) };

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
      const audit: AuditEntry = {
        id: nid(),
        quem: f.paciente,
        perfil: f.voce ? "paciente" : "sistema",
        acao: "Vaga Confirmada (RN02)",
        detalhes: `Confirmou vaga recuperada de ${dataISO} às ${hora}`,
        quando: "agora",
        timestamp: Date.now(),
      };
      return {
        ...s,
        fila: s.fila.map((x) => (x.id === f.id ? { ...x, status: "CONFIRMADO" as const } : x)),
        ags: [...s.ags, ag],
        notifs: s.notifs.filter((n) => n.waitId !== f.id),
        auditoria: [audit, ...s.auditoria],
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

    case "toggleDependentePerm": {
      const deps = s.dependentes.map((d) => {
        if (d.id === a.depId) {
          return {
            ...d,
            permissoes: { ...d.permissoes, [a.perm]: !d.permissoes[a.perm] },
          };
        }
        return d;
      });
      return { ...s, dependentes: deps };
    }

    case "agirDependente": {
      const dep = s.dependentes.find((d) => d.id === a.depId);
      const audit: AuditEntry = {
        id: nid(),
        quem: "Responsável Autorizado",
        perfil: "responsavel",
        acao: `Ação em Dependente: ${a.acao}`,
        detalhes: a.log,
        quando: "agora",
        timestamp: Date.now(),
      };
      return { ...s, auditoria: [audit, ...s.auditoria] };
    }

    case "addAuditLog": {
      const audit: AuditEntry = {
        id: nid(),
        quem: a.quem,
        perfil: a.perfil,
        acao: a.acao,
        detalhes: a.detalhes,
        quando: "agora",
        timestamp: Date.now(),
      };
      return { ...s, auditoria: [audit, ...s.auditoria] };
    }

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

