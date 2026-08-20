import React, { useEffect, useRef, useState } from "react";
import { useClinic } from "../store";
import {
  Agendamento, ESPECIALIDADES, ENDERECO_CLINICA, FUNCIONAMENTO, HOJE, Medico, MESES, MIN_CANCEL, ORIENTACOES,
  RESPONSAVEL_SEED, TEL_CLINICA, addDaysISO, dayStatus, fmtBRL, fmtDataLonga, fmtDataMedia, fromISO, hashStr,
  isBusyExterno, minutesUntil, norm, pad, slotKey, slotsDoDia, DIA_LONGO,
} from "../data";
import { usePRM } from "./ui";
import { IcSpark, IcSend } from "./icons";

export interface ToolCallInfo { name: string; args: string; result: string }
interface Msg { id: number; role: "user" | "ai" | "tool"; text: string; toolName?: string; toolArgs?: string }
type Step =
  | "idle" | "date" | "time" | "propose" | "fila" | "payment" | "card"
  | "resched-date" | "resched-propose" | "cancel-which";
interface Draft {
  step: Step; medicoId?: number; dataISO?: string; hora?: string;
  tipo?: "CONVENIO" | "PARTICULAR"; agId?: number; propostas?: string[]; orientAsk?: boolean;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const AFFIRM = /\b(sim|s|confirmo|confirmar|pode ser|pode|ok|okay|fechado|quero|aceito|isso|esse|essa|perfeito|top|beleza|vamos|claro|manda|bora|uhum|yes|entro|entrar)\b/;
const NEGATE = /\b(nao|negativo|trocar|troca|outro|outra|diferente|desisto|desiste|melhor nao)\b/;

/* ================= parsers ================= */
const parseData = (raw: string): string | null => {
  const txt = norm(raw);
  if (/\bhoje\b/.test(txt)) return HOJE;
  if (/\bdepois de amanha\b/.test(txt)) return addDaysISO(HOJE, 2);
  if (/\bamanha\b/.test(txt)) return addDaysISO(HOJE, 1);
  const dm = txt.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
  if (dm) {
    const d = +dm[1], m = +dm[2];
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      const now = new Date();
      let y = dm[3] ? +dm[3] : now.getFullYear();
      if (y < 100) y += 2000;
      if (!dm[3] && m < now.getMonth() + 1) y += 1;
      const iso = `${y}-${pad(m)}-${pad(d)}`;
      return iso >= HOJE ? iso : null;
    }
  }
  const ext = txt.match(/\b(\d{1,2}) de ([a-z]+)/);
  if (ext) {
    const mi = MESES.findIndex((mo) => mo.startsWith(ext[2].slice(0, 4)));
    const d = +ext[1];
    if (mi >= 0 && d >= 1 && d <= 31) {
      const now = new Date();
      const y = now.getFullYear() + (mi < now.getMonth() ? 1 : 0);
      const iso = `${y}-${pad(mi + 1)}-${pad(d)}`;
      if (iso >= HOJE) return iso;
    }
  }
  const diaN = txt.match(/\bdia (\d{1,2})\b/);
  if (diaN) {
    const now = new Date();
    for (const addM of [0, 1, 2]) {
      const last = new Date(now.getFullYear(), now.getMonth() + addM + 1, 0).getDate();
      if (+diaN[1] <= last) {
        const iso = `${now.getFullYear()}-${pad(now.getMonth() + addM + 1)}-${pad(+diaN[1])}`;
        if (iso >= HOJE) return iso;
      }
    }
  }
  const nomes = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  const curtos = ["", "seg", "ter", "qua", "qui", "sex", "sab"];
  const queVem = /(que vem|proxima semana|semana que vem|da proxima)/.test(txt);
  for (let w = 0; w < 7; w++) {
    const reCurto = curtos[w] ? new RegExp(`\\b${curtos[w]}\\b`) : null;
    if (txt.includes(nomes[w]) || (reCurto && reCurto.test(txt))) {
      let off = 0;
      for (let i = 1; i <= 7; i++) if (fromISO(addDaysISO(HOJE, i)).getDay() === w) { off = i; break; }
      if (queVem) off += 7;
      return addDaysISO(HOJE, off);
    }
  }
  if (/fim de semana|final de semana/.test(txt)) {
    for (let i = 1; i <= 7; i++) if (fromISO(addDaysISO(HOJE, i)).getDay() === 6) return addDaysISO(HOJE, i);
  }
  const emN = txt.match(/\b(?:daqui a|em) (\d{1,2}) dias?\b/);
  if (emN) return addDaysISO(HOJE, +emN[1]);
  return null;
};

const parseHoraExata = (raw: string): string | null => {
  const txt = norm(raw);
  let m = txt.match(/\b(\d{1,2})\s*[h:]\s*(\d{2})\b/);
  if (m) return `${pad(+m[1])}:${m[2]}`;
  m = txt.match(/\b(\d{1,2})\s*(?:e|pras?|para)\s*meia\b/);
  if (m) return `${pad(+m[1])}:30`;
  m = txt.match(/\bas?\s+(\d{1,2})\b/);
  if (m && +m[1] <= 23) return `${pad(+m[1])}:00`;
  m = txt.match(/\b(\d{1,2})\s*h\b/);
  if (m && +m[1] <= 23) return `${pad(+m[1])}:00`;
  m = txt.match(/\b(\d{1,2})\s*horas?\b/);
  if (m && +m[1] <= 23) return `${pad(+m[1])}:00`;
  return null;
};

type Filtro = ((h: string) => boolean) | "primeiro" | "ultimo";
const parseFiltro = (raw: string): Filtro | null => {
  const txt = norm(raw);
  if (/primeiro horario|mais cedo|bem cedo/.test(txt)) return "primeiro";
  if (/ultimo horario|mais tarde|fim do dia/.test(txt)) return "ultimo";
  if (/manha/.test(txt)) return (h) => +h.slice(0, 2) < 12;
  if (/depois do almoco/.test(txt)) return (h) => +h.slice(0, 2) >= 13;
  if (/tarde/.test(txt)) return (h) => { const x = +h.slice(0, 2); return x >= 12 && x < 18; };
  if (/noite/.test(txt)) return (h) => +h.slice(0, 2) >= 18;
  let m = txt.match(/antes das? (\d{1,2})/);
  if (m) return (h) => +h.slice(0, 2) < +m![1];
  m = txt.match(/depois das? (\d{1,2})/);
  if (m) return (h) => +h.slice(0, 2) >= +m![1];
  m = txt.match(/entre\s*(\d{1,2})\s*(?:e|as?|:)\s*(\d{1,2})/);
  if (m) return (h) => { const x = +h.slice(0, 2); return x >= +m![1] && x < +m![2]; };
  return null;
};

const detectaEsp = (txt: string): number | null => {
  if (/cardio|coracao|cardiaco|pressao alta/.test(txt)) return 1;
  if (/clinica geral|clinico geral|clinico|geral|check ?up|rotina/.test(txt)) return 2;
  if (/odonto|dentista|dente/.test(txt)) return 3;
  if (/ortop|osso|joelho|coluna|costas|articulac/.test(txt)) return 4;
  if (/dermato|pele|acne|mancha/.test(txt)) return 5;
  if (/pediat|crianca|bebe|filho|filha|infantil/.test(txt)) return 6;
  return null;
};
const detectaMedicoTxt = (txt: string, medicos: Medico[]): Medico | null => {
  const pares: [RegExp, number][] = [
    [/helena|duarte/, 1], [/beatriz|nogueira/, 2], [/camila|fontes/, 3],
    [/otavio|sampaio/, 4], [/ricardo|teles/, 5], [/paula|serrano/, 6],
  ];
  for (const [re, id] of pares) if (re.test(txt)) return medicos.find((m) => m.id === id) ?? null;
  return null;
};

const Typewriter = ({ text }: { text: string }) => {
  const prm = usePRM();
  const [n, setN] = useState(prm ? text.length : 0);
  useEffect(() => {
    if (prm || n >= text.length) return;
    const t = setTimeout(() => setN((v) => Math.min(text.length, v + 3)), 12);
    return () => clearTimeout(t);
  }, [n, text, prm]);
  return <>{text.slice(0, n)}{n < text.length && <span className="caret text-jade">▍</span>}</>;
};

/* ================= componente ================= */
interface Props {
  variant?: "phone" | "console";
  onTool?: (t: ToolCallInfo) => void;
  apiRef?: React.MutableRefObject<{ send: (t: string) => void } | null>;
  className?: string;
}

export default function Chat({ variant = "phone", onTool, apiRef, className = "" }: Props) {
  const { state, dispatch } = useClinic();
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 1, role: "ai", text: "Oi, Maria! Eu sou a Lia, secretária virtual da clínica. Marco, remarco, cancelo e confirmo consultas, vejo horários, fila de espera, preparo dos exames e mais. É só pedir — por exemplo: 'quero marcar cardiologia amanhã de manhã'." },
  ]);
  const [qr, setQr] = useState<string[]>(["Quero marcar uma consulta", "Qual minha próxima consulta?", "O que levar na consulta?", "Como está a fila?"]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const draft = useRef<Draft>({ step: "idle" });
  const idSeq = useRef(10);
  const boxRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, thinking, qr]);

  const push = (m: Omit<Msg, "id">) => setMsgs((p) => [...p, { ...m, id: ++idSeq.current }]);
  const tool = (name: string, args: string, result: string) => {
    push({ role: "tool", text: `${name} -> ${result}`, toolName: name, toolArgs: args });
    onTool?.({ name, args, result });
  };
  const medicoDe = (id?: number) => stateRef.current.medicos.find((m) => m.id === id);

  const sendRef = useRef<(t: string) => void>(() => {});
  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = { send: (t) => sendRef.current(t) };
    return () => { apiRef.current = null; };
  }, [apiRef]);

  const livres = (med: Medico, iso: string) => {
    const s = stateRef.current;
    return slotsDoDia(med, iso).filter(
      (h) => !isBusyExterno(med.id, iso, h, s.freed, s.extra) &&
        !s.ags.some((a) => a.medicoId === med.id && a.dataISO === iso && a.hora === h && a.status === "AGENDADO"),
    );
  };
  const diasComVaga = (med: Medico, n = 3) => {
    const s = stateRef.current;
    const out: string[] = [];
    for (let i = 0; i <= 20 && out.length < n; i++) {
      const cand = addDaysISO(HOJE, i);
      if (dayStatus(med, cand, s.ags, s.freed, s.extra) === "livre") out.push(cand);
    }
    return out;
  };
  const futuras = () =>
    stateRef.current.ags
      .filter((a) => a.voce && a.status === "AGENDADO")
      .sort((a, b) => `${a.dataISO}${a.hora}`.localeCompare(`${b.dataISO}${b.hora}`));

  /* ---------- ações ---------- */
  const agendar = async (med: Medico, iso: string, hora: string, tipo: "CONVENIO" | "PARTICULAR", carteirinha?: string) => {
    const s = stateRef.current;
    const confl = isBusyExterno(med.id, iso, hora, s.freed, s.extra) ||
      s.ags.some((a) => a.medicoId === med.id && a.dataISO === iso && a.hora === hora && a.status === "AGENDADO");
    if (confl) {
      tool("agendar_consulta", '{ "medico_id": ' + med.id + ', "data_hora": "' + iso + " " + hora + '" }', "ERRO 409 · vaga indisponível (RN03)");
      await wait(560);
      const alts = livres(med, iso).slice(0, 4);
      if (alts.length) {
        draft.current = { step: "propose", medicoId: med.id, dataISO: iso, propostas: alts };
        push({ role: "ai", text: "Ah, esse horário acabou de ser reservado por outro paciente — a trava do banco (RN03) impediu o choque. Ainda tenho: " + alts.join(", ") + ". Qual desses?" });
        setQr([...alts.slice(0, 4), "Ver outro dia"]);
      } else {
        draft.current = { step: "fila", medicoId: med.id, dataISO: iso };
        push({ role: "ai", text: "Esse dia lotou de vez. Posso te colocar na fila de espera — se abrir vaga, você é a primeira a saber. Quer entrar?" });
        setQr(["Entrar na fila de espera", "Ver outro dia"]);
      }
      return;
    }
    const proto = `FM-${hashStr(slotKey(med.id, iso, hora) + Date.now()).toString(36).slice(0, 5).toUpperCase()}`;
    tool("agendar_consulta", '{ "paciente_id": 1, "medico_id": ' + med.id + ', "data_hora": "' + iso + " " + hora + '", "tipo_pagamento": "' + tipo + '"' + (carteirinha ? ', "carteirinha": "' + carteirinha + '"' : "") + " }", "OK · protocolo " + proto);
    dispatch({ t: "addAg", ag: { id: Date.now(), paciente: "Maria Aparecida", voce: true, medicoId: med.id, dataISO: iso, hora, tipo, carteirinha, status: "AGENDADO", protocolo: proto } });
    await wait(620);
    const extra = tipo === "PARTICULAR" ? " Valor: " + fmtBRL(med.valor) + " (pagamento na recepção)." : " Leve a carteirinha do convênio.";
    push({ role: "ai", text: "Prontinho! ✅ Consulta confirmada com " + med.nome + " — " + fmtDataLonga(iso) + ", às " + hora + ". Protocolo " + proto + "." + extra + " Te mando lembrete um dia antes. 💚" });
    setQr(["Qual minha próxima consulta?", "O que levar?", "Marcar outra", "Obrigada!"]);
    draft.current = { step: "idle" };
  };

  const cancelarAg = async (ag: Agendamento, remarcar: boolean) => {
    const med = medicoDe(ag.medicoId);
    if (!med) return;
    const min = minutesUntil(ag.dataISO, ag.hora);
    if (min < MIN_CANCEL) {
      tool("cancelar_consulta", '{ "agendamento_id": ' + ag.id + " }", "BLOQUEADO · antecedência " + min + " min < " + MIN_CANCEL + " min (RN01)");
      await wait(560);
      push({ role: "ai", text: "Maria, essa consulta com " + med.nome + " é " + (ag.dataISO === HOJE ? "hoje" : fmtDataMedia(ag.dataISO)) + " às " + ag.hora + " — faltam menos de " + MIN_CANCEL + " minutos. Pela regra da clínica (RN01) eu não consigo cancelar tão perto do horário. Fale com a recepção: " + TEL_CLINICA + ". Eles resolvem na hora!" });
      setQr(["Entendi", "Quero falar com um atendente", "Minhas consultas"]);
      draft.current = { step: "idle" };
      return;
    }
    tool("cancelar_consulta", '{ "agendamento_id": ' + ag.id + " }", "OK · status CANCELADO · vaga devolvida à fila (RN02)");
    dispatch({ t: "cancelAg", id: ag.id });
    await wait(620);
    if (remarcar) {
      push({ role: "ai", text: "Cancelado! Agora vamos remarcar com " + med.nome + " (seu convênio continua valendo). Para qual dia você prefere?" });
      draft.current = { step: "resched-date", medicoId: med.id, agId: ag.id, tipo: ag.tipo };
      setQr(["Hoje", "Amanhã", "Ver dias com vagas"]);
    } else {
      const tinhaFila = stateRef.current.fila.some((f) => f.medicoId === ag.medicoId && f.dataISO === ag.dataISO && f.status === "AGUARDANDO");
      push({ role: "ai", text: "Feito! Sua consulta de " + fmtDataMedia(ag.dataISO) + " às " + ag.hora + " foi cancelada." + (tinhaFila ? " A vaga já foi oferecida ao 1º da fila de espera — a fila anda sozinha por aqui. 😉" : "") + " Se precisar, é só chamar." });
      setQr(["Marcar nova consulta", "Minhas consultas", "Obrigada!"]);
      draft.current = { step: "idle" };
    }
  };

  const proporHorarios = async (med: Medico, iso: string, filtro: Filtro | null, horaExata: string | null) => {
    tool("buscar_horarios", '{ "medico_id": ' + med.id + ', "data": "' + iso + '" }', "horários retornados da agenda");
    await wait(540);
    const lv = livres(med, iso);
    if (horaExata) {
      if (lv.includes(horaExata)) {
        draft.current = { ...draft.current, step: "propose", medicoId: med.id, dataISO: iso, propostas: [horaExata] };
        push({ role: "ai", text: horaExata + " está livre em " + fmtDataMedia(iso) + "! Podemos confirmar?" });
        setQr(["Sim, pode confirmar", ...lv.filter((h) => h !== horaExata).slice(0, 2), "Ver outro dia"]);
        return;
      }
      const prox = lv.filter((h) => h > horaExata).slice(0, 3);
      const alt = prox.length ? prox : lv.slice(0, 3);
      draft.current = { step: "propose", medicoId: med.id, dataISO: iso, propostas: alt };
      push({ role: "ai", text: horaExata + " já foi preenchido 😕 — os livres mais próximos são: " + alt.join(", ") + ". Serve algum?" });
      setQr([...alt, "Ver outro dia"]);
      return;
    }
    let sel = lv;
    if (filtro === "primeiro") sel = lv.slice(0, 1);
    else if (filtro === "ultimo") sel = lv.slice(-1);
    else if (typeof filtro === "function") sel = lv.filter(filtro);
    if (!sel.length) sel = lv;
    const mostra = sel.slice(0, 6);
    draft.current = { step: "propose", medicoId: med.id, dataISO: iso, propostas: mostra };
    push({ role: "ai", text: "Para " + fmtDataLonga(iso) + ", " + med.nome + " tem: " + mostra.join(", ") + (sel.length > 6 ? "…" : "") + ". Qual prefere?" });
    setQr([...mostra.slice(0, 4), "Ver outro dia"]);
  };

  /* ---------- máquina principal ---------- */
  const responder = async (raw: string) => {
    setBusy(true);
    setThinking(true);
    await wait(600);
    const txt = norm(raw);
    const s = () => stateRef.current;
    const d = draft.current;

    /* ===== passos de fluxo em andamento ===== */
    if (d.step === "date" || d.step === "resched-date") {
      const med = medicoDe(d.medicoId);
      if (!med) { draft.current = { step: "idle" }; }
      else if (/dias com vagas|ver dias|outro dia|quais dias/.test(txt) && !parseData(raw)) {
        const dias = diasComVaga(med);
        setThinking(false);
        if (!dias.length) {
          push({ role: "ai", text: "A agenda de " + med.nome + " está cheia nas próximas semanas. Posso te colocar na fila de espera do dia que preferir." });
          setQr(["Entrar na fila de espera"]);
          d.step = "fila";
          d.dataISO = addDaysISO(HOJE, 3);
        } else {
          push({ role: "ai", text: "Próximos dias com vaga para " + med.nome + ":" });
          setQr(dias.map((x) => fmtDataMedia(x)));
        }
        setBusy(false);
        return;
      } else {
        const iso = parseData(raw);
        if (!iso) {
          setThinking(false);
          push({ role: "ai", text: "Não entendi a data 🙈 — fale 'hoje', 'amanhã', um dia da semana ('quinta') ou a data (ex.: 15/07)." });
          setQr(["Hoje", "Amanhã", "Sexta-feira", "Ver dias com vagas"]);
          setBusy(false);
          return;
        }
        const st = dayStatus(med, iso, s().ags, s().freed, s().extra);
        if (st === "passado") { setThinking(false); push({ role: "ai", text: "Esse dia já passou 😅 — escolha uma data a partir de hoje." }); setQr(["Hoje", "Amanhã", "Ver dias com vagas"]); setBusy(false); return; }
        if (st === "sem") {
          setThinking(false);
          const diasAt = [...new Set(med.jornadas.map((j) => DIA_LONGO[j.dia]))].join(", ");
          push({ role: "ai", text: med.nome + " não atende em " + fmtDataLonga(iso) + ". Dias de atendimento: " + diasAt + "." });
          setQr(["Ver dias com vagas", "Amanhã"]);
          setBusy(false);
          return;
        }
        if (st === "cheio") {
          setThinking(false);
          d.dataISO = iso;
          d.step = "fila";
          push({ role: "ai", text: fmtDataLonga(iso) + " está completamente lotado para " + med.nome + ". Posso te colocar na fila de espera: se alguém cancelar, o sistema te avisa na hora e você tem 1 hora para confirmar. Quer entrar?" });
          setQr(["Entrar na fila de espera", "Ver outro dia"]);
          setBusy(false);
          return;
        }
        d.dataISO = iso;
        if (d.step === "resched-date") {
          d.step = "resched-propose";
          const hx = parseHoraExata(raw);
          await proporHorarios(med, iso, parseFiltro(raw), hx && livres(med, iso).includes(hx) ? hx : null);
        } else {
          const hx = parseHoraExata(raw);
          const fi = parseFiltro(raw);
          const pg = /convenio|plano|carteirinha/.test(txt) ? "CONVENIO" : /particular|dinheiro|pix/.test(txt) ? "PARTICULAR" : null;
          d.step = "propose";
          if (hx && livres(med, iso).includes(hx) && pg) {
            d.tipo = pg;
            setThinking(false);
            if (pg === "CONVENIO") {
              d.step = "card";
              push({ role: "ai", text: "Anotado: " + hx + " em " + fmtDataMedia(iso) + ", pelo convênio. Me diga o número da carteirinha." });
              setQr(["0042 8871 3345 09"]);
            } else {
              await agendar(med, iso, hx, "PARTICULAR");
            }
            setBusy(false);
            return;
          }
          await proporHorarios(med, iso, fi, hx);
        }
        setThinking(false);
        setBusy(false);
        return;
      }
    }

    if (d.step === "propose" || d.step === "resched-propose" || d.step === "time") {
      const med = medicoDe(d.medicoId);
      const iso = d.dataISO;
      if (!med || !iso) { draft.current = { step: "idle" }; setThinking(false); setBusy(false); return; }
      if (/fila/.test(txt)) { d.step = "fila"; setThinking(false); push({ role: "ai", text: "Certo! Quer entrar na fila de espera de " + fmtDataMedia(iso) + " com " + med.nome + "? Se abrir vaga, você é avisada na hora." }); setQr(["Entrar na fila de espera", "Ver outro dia"]); setBusy(false); return; }
      if (NEGATE.test(txt) && !parseHoraExata(raw)) {
        setThinking(false);
        if (/outro dia|ver outro|dia/.test(txt)) {
          d.step = d.step === "resched-propose" ? "resched-date" : "date";
          push({ role: "ai", text: "Sem problema! Para qual outro dia?" });
          setQr(["Amanhã", "Ver dias com vagas"]);
        } else {
          const lv = livres(med, iso).filter((h) => !(d.propostas ?? []).includes(h)).slice(0, 4);
          if (lv.length) { d.propostas = lv; push({ role: "ai", text: "E esses: " + lv.join(", ") + "?" }); setQr(lv); }
          else { d.step = "date"; push({ role: "ai", text: "Esse dia esgotou as opções. Vamos ver outro dia?" }); setQr(["Ver dias com vagas"]); }
        }
        setBusy(false);
        return;
      }
      let hora = parseHoraExata(raw);
      const fi = parseFiltro(raw);
      if (!hora && fi) {
        const lv = livres(med, iso);
        if (fi === "primeiro") hora = lv[0];
        else if (fi === "ultimo") hora = lv[lv.length - 1];
        else hora = lv.filter(fi as (h: string) => boolean)[0] ?? null;
      }
      if (!hora && AFFIRM.test(txt) && d.propostas?.length) hora = d.propostas[0];
      const lv = livres(med, iso);
      if (!hora || !lv.includes(hora)) {
        setThinking(false);
        const suger = hora ? lv.filter((h) => h > hora).slice(0, 3) : lv.slice(0, 4);
        d.propostas = suger.length ? suger : undefined;
        push({ role: "ai", text: hora ? hora + " não está mais livre. Os mais próximos: " + (suger.join(", ") || "nenhum nesse dia") + "." : "Não achei esse horário. Livres agora: " + lv.slice(0, 5).join(", ") + "." });
        setQr(suger.length ? suger : ["Ver outro dia"]);
        setBusy(false);
        return;
      }
      d.hora = hora;
      if (d.step === "resched-propose") {
        const old = s().ags.find((a) => a.id === d.agId);
        tool("reagendar_consulta", '{ "agendamento_id": ' + d.agId + ', "nova_data_hora": "' + iso + " " + hora + '" }', "OK · consulta movida");
        dispatch({ t: "cancelAg", id: d.agId as number });
        await wait(300);
        const proto = `FM-${hashStr(slotKey(med.id, iso, hora) + Date.now()).toString(36).slice(0, 5).toUpperCase()}`;
        dispatch({ t: "addAg", ag: { id: Date.now(), paciente: "Maria Aparecida", voce: true, medicoId: med.id, dataISO: iso, hora, tipo: old?.tipo ?? "CONVENIO", carteirinha: old?.carteirinha, status: "AGENDADO", protocolo: proto } });
        await wait(620);
        setThinking(false);
        push({ role: "ai", text: "Remarcado! ✅ Sua consulta com " + med.nome + " agora é " + fmtDataLonga(iso) + ", às " + hora + ". O horário antigo já voltou para a agenda" + (old?.tipo === "PARTICULAR" ? " (valor: " + fmtBRL(med.valor) + ")" : "") + ". Novo protocolo: " + proto + "." });
        setQr(["Qual minha próxima consulta?", "Obrigada!"]);
        draft.current = { step: "idle" };
        setBusy(false);
        return;
      }
      d.step = "payment";
      setThinking(false);
      push({ role: "ai", text: "Ótimo: " + hora + " em " + fmtDataMedia(iso) + ". Como prefere pagar? Particular sai por " + fmtBRL(med.valor) + "." });
      setQr(["Convênio", "Particular (" + fmtBRL(med.valor) + ")"]);
      setBusy(false);
      return;
    }

    if (d.step === "fila") {
      const med = medicoDe(d.medicoId);
      const iso = d.dataISO;
      if (!med || !iso) { draft.current = { step: "idle" }; setThinking(false); setBusy(false); return; }
      if (NEGATE.test(txt) && !AFFIRM.test(txt)) { d.step = "date"; setThinking(false); push({ role: "ai", text: "Ok, sem fila! Para qual outro dia?" }); setQr(["Amanhã", "Ver dias com vagas"]); setBusy(false); return; }
      dispatch({ t: "joinFila", medicoId: med.id, dataISO: iso, paciente: "Maria Aparecida", voce: true });
      const pos = s().fila.filter((f) => f.medicoId === med.id && f.dataISO === iso && (f.status === "AGUARDANDO" || f.status === "NOTIFICADO")).length;
      tool("inserir_fila_espera", '{ "paciente_id": 1, "medico_id": ' + med.id + ', "data_desejada": "' + iso + '" }', "OK · posição " + pos + "ª");
      await wait(560);
      setThinking(false);
      push({ role: "ai", text: "Você é a " + pos + "ª na fila de " + fmtDataMedia(iso) + " com " + med.nome + ". Assim que abrir uma vaga, o app te notifica — e você tem 60 minutos para confirmar, combinado?" });
      setQr(["Como está a fila?", "Obrigada!"]);
      draft.current = { step: "idle" };
      setBusy(false);
      return;
    }

    if (d.step === "payment") {
      const med = medicoDe(d.medicoId);
      if (!med) { draft.current = { step: "idle" }; setThinking(false); setBusy(false); return; }
      if (/convenio|carteirinha|plano/.test(txt)) {
        d.step = "card";
        setThinking(false);
        push({ role: "ai", text: "Perfeito! Me diga o número da sua carteirinha do convênio." });
        setQr(["0042 8871 3345 09"]);
        setBusy(false);
        return;
      }
      setThinking(false);
      await agendar(med, d.dataISO as string, d.hora as string, "PARTICULAR");
      setBusy(false);
      return;
    }

    if (d.step === "card") {
      const med = medicoDe(d.medicoId);
      if (!med) { draft.current = { step: "idle" }; setThinking(false); setBusy(false); return; }
      const digitos = raw.replace(/\D/g, "");
      if (digitos.length < 8) {
        setThinking(false);
        push({ role: "ai", text: "Hmm, esse número parece curto demais. Confere a carteirinha? São pelo menos 8 dígitos." });
        setQr(["0042 8871 3345 09"]);
        setBusy(false);
        return;
      }
      setThinking(false);
      await agendar(med, d.dataISO as string, d.hora as string, "CONVENIO", digitos.replace(/(\d{4})(?=\d)/g, "$1 ").trim());
      setBusy(false);
      return;
    }

    if (d.step === "cancel-which") {
      const futs = futuras();
      let alvo: Agendamento | undefined;
      const isoSel = parseData(raw);
      const medSel = detectaMedicoTxt(txt, s().medicos);
      if (isoSel) alvo = futs.find((a) => a.dataISO === isoSel);
      if (!alvo && medSel) alvo = futs.find((a) => a.medicoId === medSel.id);
      if (!alvo && /primeira|proxima|a de cima|1/.test(txt)) alvo = futs[0];
      if (!alvo && /segunda|2/.test(txt)) alvo = futs[1];
      if (!alvo) {
        setThinking(false);
        push({ role: "ai", text: "Qual delas? Me diga a data ou o profissional." });
        setQr(futs.map((a) => fmtDataMedia(a.dataISO) + " · " + (medicoDe(a.medicoId)?.nome.replace("Dra. ", "").replace("Dr. ", "") ?? "")));
        setBusy(false);
        return;
      }
      const remarca = /remarc/.test(txt);
      d.step = "idle";
      setThinking(false);
      await cancelarAg(alvo, remarca);
      setBusy(false);
      return;
    }

    /* ===== intenções globais ===== */
    const futs = futuras();

    /* sair da fila */
    if (/sair da fila|tirar da fila|remover da fila/.test(txt)) {
      const minhas = s().fila.filter((f) => f.voce && (f.status === "AGUARDANDO" || f.status === "NOTIFICADO"));
      setThinking(false);
      if (!minhas.length) {
        push({ role: "ai", text: "Você não está em nenhuma fila de espera no momento. 😉" });
        setQr(["Quero marcar uma consulta"]);
      } else {
        minhas.forEach((f) => dispatch({ t: "leaveFila", waitId: f.id }));
        tool("consultar_fila", '{ "paciente_id": 1, "acao": "remover" }', "OK · " + minhas.length + " inscrição(ões) removida(s)");
        await wait(480);
        push({ role: "ai", text: "Pronto, tirei você da fila (" + minhas.map((f) => fmtDataMedia(f.dataISO)).join(", ") + "). Se mudar de ideia, é só pedir." });
        setQr(["Quero marcar uma consulta"]);
      }
      setBusy(false);
      return;
    }

    /* fila */
    if (/fila/.test(txt)) {
      if (/entrar|inscrever/.test(txt)) {
        const espSel = detectaEsp(txt);
        const med = detectaMedicoTxt(txt, s().medicos) ?? (espSel ? s().medicos.find((m) => m.espId === espSel) : undefined);
        const iso = parseData(raw);
        if (med && iso) {
          setThinking(false);
          d.medicoId = med.id; d.dataISO = iso; d.step = "fila";
          push({ role: "ai", text: "Certo! Confirmo sua entrada na fila de " + fmtDataMedia(iso) + " com " + med.nome + "?" });
          setQr(["Sim, entrar na fila", "Melhor não"]);
          setBusy(false);
          return;
        }
      }
      const minhas = s().fila.filter((f) => f.voce && (f.status === "AGUARDANDO" || f.status === "NOTIFICADO"));
      setThinking(false);
      if (!minhas.length) {
        push({ role: "ai", text: "Você não está em nenhuma fila de espera agora. Se um dia estiver lotado, eu mesma te ofereço a fila na hora. 😉" });
        setQr(["Quero marcar uma consulta"]);
      } else {
        tool("consultar_fila", '{ "paciente_id": 1 }', minhas.length + " inscrição(ões) ativa(s)");
        await wait(480);
        const linhas = minhas.map((f) => {
          const status = f.status === "NOTIFICADO" ? "vaga oferecida! restam " + f.janelaRestante + " min para confirmar" : "aguardando";
          return "• " + fmtDataMedia(f.dataISO) + " com " + (medicoDe(f.medicoId)?.nome ?? "") + " — posição " + f.posicao + "ª (" + status + ")";
        }).join("\n");
        push({ role: "ai", text: linhas + "\n\nLembrando: só o 1º colocado é notificado, e a janela de confirmação é de 60 minutos." });
        setQr(["Sair da fila", "Obrigada!"]);
      }
      setBusy(false);
      return;
    }

    /* cancelar / desmarcar */
    if (/cancel|desmarc/.test(txt)) {
      setThinking(false);
      if (!futs.length) {
        push({ role: "ai", text: "Você não tem consultas futuras para cancelar. Quer marcar uma agora?" });
        setQr(["Quero marcar uma consulta"]);
      } else if (futs.length === 1) {
        await cancelarAg(futs[0], false);
      } else {
        const isoSel = parseData(raw);
        const medSel = detectaMedicoTxt(txt, s().medicos);
        const alvo = (isoSel && futs.find((a) => a.dataISO === isoSel)) || (medSel && futs.find((a) => a.medicoId === medSel.id));
        if (alvo) await cancelarAg(alvo, false);
        else {
          d.step = "cancel-which";
          push({ role: "ai", text: "Você tem mais de uma consulta futura. Qual quer cancelar?" });
          setQr(futs.map((a) => fmtDataMedia(a.dataISO) + " · " + (medicoDe(a.medicoId)?.nome.replace("Dra. ", "").replace("Dr. ", "") ?? "")));
        }
      }
      setBusy(false);
      return;
    }

    /* remarcar */
    if (/remarc|reagend|mudar (o )?(dia|horario)|trocar (o )?(dia|horario)/.test(txt)) {
      setThinking(false);
      if (!futs.length) {
        push({ role: "ai", text: "Não achei consultas futuras para remarcar. Quer agendar uma nova?" });
        setQr(["Quero marcar uma consulta"]);
      } else if (futs.length === 1) {
        const ag = futs[0];
        const min = minutesUntil(ag.dataISO, ag.hora);
        const med = medicoDe(ag.medicoId);
        if (min < MIN_CANCEL) {
          tool("reagendar_consulta", '{ "agendamento_id": ' + ag.id + " }", "BLOQUEADO · antecedência " + min + " min < " + MIN_CANCEL + " min (RN01)");
          await wait(560);
          push({ role: "ai", text: "Essa consulta é " + (ag.dataISO === HOJE ? "hoje" : fmtDataMedia(ag.dataISO)) + " às " + ag.hora + " — com menos de " + MIN_CANCEL + " minutos de antecedência a regra (RN01) não permite alterar pelo app. A recepção (" + TEL_CLINICA + ") consegue te ajudar!" });
          setQr(["Entendi", "Quero falar com um atendente"]);
        } else if (med) {
          push({ role: "ai", text: "Vamos remarcar a consulta com " + med.nome + " de " + fmtDataMedia(ag.dataISO) + " " + ag.hora + ". Para qual dia você prefere?" });
          draft.current = { step: "resched-date", medicoId: med.id, agId: ag.id, tipo: ag.tipo };
          setQr(["Hoje", "Amanhã", "Ver dias com vagas"]);
        }
      } else {
        d.step = "cancel-which";
        push({ role: "ai", text: "Qual consulta você quer remarcar?" });
        setQr(futs.map((a) => fmtDataMedia(a.dataISO) + " · " + (medicoDe(a.medicoId)?.nome.replace("Dra. ", "").replace("Dr. ", "") ?? "")));
      }
      setBusy(false);
      return;
    }

    /* confirmar presença */
    if (/confirmar? (minha )?(presenca|presença|consulta)|confirmo presenca|vou (sim|comparecer)/.test(txt)) {
      setThinking(false);
      if (!futs.length) {
        push({ role: "ai", text: "Você não tem consultas futuras para confirmar." });
        setQr(["Quero marcar uma consulta"]);
      } else {
        const ag = futs[0];
        tool("confirmar_consulta", '{ "agendamento_id": ' + ag.id + " }", "OK · presença registrada p/ recepção");
        dispatch({ t: "pushNotif", n: { id: Date.now(), titulo: "Presença confirmada", texto: "Você confirmou presença em " + fmtDataMedia(ag.dataISO) + " às " + ag.hora + ". A recepção já foi avisada.", tipo: "info", lida: false } });
        await wait(560);
        push({ role: "ai", text: "Presença confirmada! ✅ Te esperamos em " + fmtDataLonga(ag.dataISO) + ", às " + ag.hora + ", com " + (medicoDe(ag.medicoId)?.nome ?? "") + ". Chegue 10 minutinhos antes, tá?" });
        setQr(["O que levar?", "Minhas consultas"]);
      }
      setBusy(false);
      return;
    }

    /* próxima consulta / minhas consultas */
    if (/proxima consulta|minhas consultas|meus agendamentos/.test(txt)) {
      setThinking(false);
      tool("buscar_consulta", '{ "paciente_id": 1 }', futs.length + " consulta(s) futura(s)");
      await wait(480);
      if (!futs.length) {
        push({ role: "ai", text: "Nenhuma consulta futura no momento. Quer agendar uma? Eu cuido de tudo." });
      } else {
        const linhas = futs.map((a, i) => {
          const m2 = medicoDe(a.medicoId);
          const extra = a.tipo === "PARTICULAR" ? " · " + fmtBRL(m2?.valor ?? 0) : " · convênio";
          return (i === 0 ? "-> " : "• ") + fmtDataMedia(a.dataISO) + " às " + a.hora + " — " + (m2?.nome ?? "") + extra;
        }).join("\n");
        push({ role: "ai", text: linhas + "\n\nPosso confirmar sua presença, remarcar ou cancelar. O que prefere?" });
      }
      setQr(["Confirmar presença", "Remarcar", "Cancelar", "O que levar?"]);
      setBusy(false);
      return;
    }

    /* relatórios */
    if (/relatorio|exame|resultado|laudo/.test(txt)) {
      setThinking(false);
      const rels = s().ags.filter((a) => a.voce && a.relatorio);
      const linhasRel = rels.map((a) => {
        const r = a.relatorio;
        return "• " + (r ? r.titulo : "") + " — emitido em " + (r ? r.emissao : "");
      }).join("\n");
      push({ role: "ai", text: rels.length ? "Seus relatórios disponíveis:\n" + linhasRel + "\n\nEles ficam na aba Relatórios do app — e no Modo Voz eu leio tudo em áudio." : "Nenhum relatório novo. Assim que um médico liberar um, eu te aviso." });
      setQr(["Minhas consultas", "Obrigada!"]);
      setBusy(false);
      return;
    }

    /* orientações / o que levar */
    if (/o que levar|preparo|orientac|jejum|como me preparo/.test(txt) || (d.orientAsk && detectaEsp(txt) !== null)) {
      const medSel = detectaMedicoTxt(txt, s().medicos);
      const espId = detectaEsp(txt) ?? (d.orientAsk ? medSel?.espId ?? null : null);
      d.orientAsk = false;
      setThinking(false);
      if (!espId) {
        d.orientAsk = true;
        push({ role: "ai", text: "Tenho orientações de preparo para todas as especialidades. De qual você precisa?" });
        setQr(["Clínica Geral", "Cardiologia", "Odontologia", "Ortopedia"]);
      } else {
        const esp = ESPECIALIDADES.find((e) => e.id === espId);
        tool("buscar_orientacoes", '{ "especialidade_id": ' + espId + " }", ORIENTACOES[espId].length + " orientações");
        await wait(480);
        const itens = ORIENTACOES[espId].map((o) => "• " + o).join("\n");
        push({ role: "ai", text: "Para " + (esp?.nome ?? "") + ", pedimos:\n" + itens + "\n\nNo Modo Voz eu leio tudo em áudio." });
        setQr(["Minhas consultas", "Obrigada!"]);
      }
      setBusy(false);
      return;
    }

    /* responsável */
    if (/responsavel|acompanhante|quem cuida|meu contato/.test(txt)) {
      setThinking(false);
      tool("buscar_responsavel", '{ "paciente_id": 1 }', "1 responsável autorizado");
      await wait(480);
      const perm = RESPONSAVEL_SEED.permissoes.map((p) => (p.ok ? "[ok] " : "[bloqueado] ") + p.acao).join("\n");
      push({ role: "ai", text: "Seu responsável autorizado é " + RESPONSAVEL_SEED.nome + " (" + RESPONSAVEL_SEED.parentesco + ") · " + RESPONSAVEL_SEED.telefone + ".\n\nPermissões atuais:\n" + perm + "\n\nCada ação dela passa pela API com essas permissões — nada além disso. Você ajusta tudo na aba Perfil do app." });
      setQr(["Minhas consultas", "Obrigada!"]);
      setBusy(false);
      return;
    }

    /* atendente humano / endereço / funcionamento / plano */
    if (/atendente|humano|pessoa|recepcao|secretaria humana|telefone|ligar|endereco|onde fica|onde voces ficam|funciona|abre|fecha|meu plano|carteirinha/.test(txt) && !/marc|agend/.test(txt)) {
      setThinking(false);
      dispatch({ t: "pushNotif", n: { id: Date.now(), titulo: "Atendimento humano solicitado", texto: "Pedido registrado no histórico de ações da recepção.", tipo: "info", lida: false } });
      push({ role: "ai", text: "Claro! Anota aí:\nTel. " + TEL_CLINICA + "\nHorários: " + FUNCIONAMENTO + "\nEndereço: " + ENDERECO_CLINICA + "\n\nSeu plano: Convênio Vida+ (carteirinha terminada em 09). Já registrei seu pedido de atendimento humano no painel da recepção. 😉" });
      setQr(["Minhas consultas", "Obrigada!"]);
      setBusy(false);
      return;
    }

    /* valores */
    if (/quanto|valor|preco|custa/.test(txt) && !/marc|agend/.test(txt)) {
      setThinking(false);
      const vals = s().medicos.map((m) => {
        const esp2 = ESPECIALIDADES.find((e) => e.id === m.espId);
        return "• " + (esp2?.nome ?? "") + " — " + fmtBRL(m.valor) + " (" + m.nome.replace("Dra. ", "").replace("Dr. ", "") + ")";
      }).join("\n");
      push({ role: "ai", text: "Valores das consultas particulares:\n" + vals + "\n\nPelo convênio Vida+ não há custo adicional. Quer agendar?" });
      setQr(["Quero marcar uma consulta"]);
      setBusy(false);
      return;
    }

    /* saudação curta */
    if (/^(oi+|ola+|bom dia|boa tarde|boa noite|eai|e ai|opa|hey|hello)\b/.test(txt) && txt.length < 26) {
      setThinking(false);
      const h = new Date().getHours();
      const sauda = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
      push({ role: "ai", text: sauda + ", Maria! 💚 Em que posso ajudar? Marco consultas, mostro horários, confirmo presença, cuido da fila de espera…" });
      setQr(["Quero marcar uma consulta", "Qual minha próxima consulta?", "Como está a fila?", "O que levar?"]);
      setBusy(false);
      return;
    }

    /* ajuda */
    if (/ajuda|o que voce faz|help|menu|comandos|nao sei/.test(txt)) {
      setThinking(false);
      push({ role: "ai", text: "Eu faço (quase) tudo de recepção:\n✅ Marcar consulta ('marca cardio quinta às 10')\n✅ Remarcar e cancelar (regra de 30 min)\n✅ Confirmar presença\n✅ Mostrar horários e dias com vaga\n✅ Fila de espera (entrar, sair, posição)\n✅ Preparo dos exames ('o que levar')\n✅ Valores, endereço e seu responsável\n✅ Chamar um atendente humano\n\nPode falar do seu jeito — eu entendo." });
      setQr(["Quero marcar uma consulta", "Meus horários", "Como está a fila?"]);
      setBusy(false);
      return;
    }

    /* agradecimento / despedida */
    if (/obrigad|valeu|otimo|perfeito$|show|top$|tchau|ate logo|adeus/.test(txt)) {
      setThinking(false);
      push({ role: "ai", text: "Eu que agradeço! 💚 Estou aqui 24h — é só chamar. Cuide-se bem, Maria!" });
      setQr(["Quero marcar uma consulta", "Minhas consultas"]);
      setBusy(false);
      return;
    }

    /* listar médicos / especialidades */
    if (/quais medicos|quem atende|especialidades|quais (sao )?os medicos|lista de medicos/.test(txt)) {
      setThinking(false);
      const eq = s().medicos.map((m) => {
        const esp2 = ESPECIALIDADES.find((e) => e.id === m.espId);
        return "• " + m.nome + " — " + (esp2?.nome ?? "") + " (" + m.crm + ")";
      }).join("\n");
      push({ role: "ai", text: "Nossa equipe:\n" + eq + "\n\nPara qual deles quer ver horários?" });
      setQr(["Cardiologia", "Ortopedia", "Odontologia", "Clínica Geral"]);
      setBusy(false);
      return;
    }

    /* ===== agendamento / disponibilidade ===== */
    const querAgendar = /agend|marc(ar|a|acao)?|consulta nova|quero (uma )?consulta|reserv/.test(txt);
    const querHorarios = /horario|disponib|vaga|quando.*atende|agenda|atende quando|tem (consulta|lugar)/.test(txt);
    const esp = detectaEsp(txt);
    const medNome = detectaMedicoTxt(txt, s().medicos);
    const isoMencionado = parseData(raw);

    if (querAgendar || querHorarios || esp || medNome || (isoMencionado && /consulta|medic|doctor/.test(txt))) {
      const med = medNome ?? (esp ? s().medicos.find((m) => m.espId === esp) : undefined);
      if (!med) {
        setThinking(false);
        push({ role: "ai", text: "Temos 6 especialidades com agenda aberta. Qual você procura?" });
        setQr(["Cardiologia", "Clínica Geral", "Odontologia", "Ortopedia", "Dermatologia", "Pediatria"]);
        setBusy(false);
        return;
      }
      if (isoMencionado) {
        const st = dayStatus(med, isoMencionado, s().ags, s().freed, s().extra);
        if (st === "passado") {
          setThinking(false);
          push({ role: "ai", text: fmtDataLonga(isoMencionado) + " já passou 😅 — escolha uma data a partir de hoje." });
          setQr(["Hoje", "Amanhã", "Ver dias com vagas"]);
          draft.current = { step: "date", medicoId: med.id };
          setBusy(false);
          return;
        }
        if (st === "sem") {
          setThinking(false);
          const diasAt = [...new Set(med.jornadas.map((j) => DIA_LONGO[j.dia]))].join(", ");
          push({ role: "ai", text: med.nome + " não atende em " + fmtDataLonga(isoMencionado) + ". Dias de atendimento: " + diasAt + "." });
          draft.current = { step: "date", medicoId: med.id };
          setQr(["Ver dias com vagas"]);
          setBusy(false);
          return;
        }
        if (st === "cheio") {
          setThinking(false);
          push({ role: "ai", text: "Poxa, " + fmtDataLonga(isoMencionado) + " lotou para " + med.nome + ". Posso te colocar na fila de espera: se alguém cancelar, você é avisada na hora (janela de 1h para confirmar). Quer entrar?" });
          draft.current = { step: "fila", medicoId: med.id, dataISO: isoMencionado };
          setQr(["Entrar na fila de espera", "Ver outro dia"]);
          setBusy(false);
          return;
        }
        const hx = parseHoraExata(raw);
        const fi = parseFiltro(raw);
        const pg = /convenio|plano|carteirinha/.test(txt) ? "CONVENIO" : /particular|dinheiro|pix/.test(txt) ? "PARTICULAR" : null;
        if (querAgendar && hx && livres(med, isoMencionado).includes(hx) && pg) {
          setThinking(false);
          if (pg === "CONVENIO") {
            draft.current = { step: "card", medicoId: med.id, dataISO: isoMencionado, hora: hx };
            push({ role: "ai", text: "Achei " + hx + " livre em " + fmtDataMedia(isoMencionado) + " com " + med.nome + "! Me diga o número da carteirinha do convênio para eu confirmar." });
            setQr(["0042 8871 3345 09"]);
          } else {
            await agendar(med, isoMencionado, hx, "PARTICULAR");
          }
          setBusy(false);
          return;
        }
        draft.current = { step: "propose", medicoId: med.id, dataISO: isoMencionado };
        await proporHorarios(med, isoMencionado, fi, hx);
        if (!querAgendar) draft.current.step = "date";
        setThinking(false);
        setBusy(false);
        return;
      }
      /* sem data: mostra próximos dias livres */
      const dias = diasComVaga(med);
      tool("buscar_horarios", '{ "medico_id": ' + med.id + " }", "próximos dias com agenda aberta");
      await wait(540);
      setThinking(false);
      draft.current = { step: "date", medicoId: med.id };
      if (!dias.length) {
        push({ role: "ai", text: "A agenda de " + med.nome + " está cheia nas próximas duas semanas. Posso te colocar na fila de espera do dia que preferir — a fila anda rápido por aqui." });
        d.dataISO = addDaysISO(HOJE, 3);
        d.step = "fila";
        setQr(["Entrar na fila de espera"]);
      } else {
        push({ role: "ai", text: "Próximos dias com agenda aberta para " + med.nome + ": " + dias.map((x) => fmtDataMedia(x)).join(" · ") + ". Para qual dia?" });
        setQr([...dias.map((x) => fmtDataMedia(x)), "Ver dias com vagas"]);
      }
      setBusy(false);
      return;
    }

    /* fallback */
    setThinking(false);
    push({ role: "ai", text: "Hmm, essa eu não peguei — mas eu sei fazer muita coisa: marcar, remarcar, cancelar e confirmar consultas, horários, fila de espera, preparo dos exames, valores, seu responsável e até chamar um atendente. Me conta de outro jeito?" });
    setQr(["Quero marcar uma consulta", "Qual minha próxima consulta?", "Como está a fila?", "O que levar?", "Quero falar com um atendente"]);
    setBusy(false);
  };

  const send = (text: string) => {
    if (busy || !text.trim()) return;
    push({ role: "user", text });
    setInput("");
    responder(text);
  };
  sendRef.current = send;

  const consoleMode = variant === "console";
  return (
    <div className={`flex h-full flex-col bg-cream ${className}`}>
      {/* header */}
      <div className="flex items-center gap-2.5 border-b border-line bg-paper py-2.5 pl-3.5 pr-11">
        <div className="relative">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-pine text-mint">
            <IcSpark className="h-5 w-5" />
          </div>
          <span className="pulse-dot absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-jade ring-2 ring-paper" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold leading-tight">Lia · Secretária Virtual</p>
          <p className="font-mono text-[10px] text-jade">ollama · llama3 · local — online</p>
        </div>
        <span className="rounded-full border border-line bg-jadesoft px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-jadedark">IA</span>
      </div>

      {/* mensagens */}
      <div ref={boxRef} className="thin-scroll flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {msgs.map((m) =>
          m.role === "tool" ? (
            <div key={m.id} className="pop-in ml-6 rounded-lg rounded-tl-sm border border-pine/30 bg-deep px-3 py-2 font-mono text-[10px] leading-relaxed text-mint/90">
              <span className="text-amber">⚙ tool_call</span> <span className="text-mintdark">{m.toolName}</span>
              <div className="mt-0.5 break-all text-mint/60">{m.toolArgs}</div>
              <div className="mt-0.5 text-jade">↳ {m.text}</div>
            </div>
          ) : m.role === "user" ? (
            <div key={m.id} className="pop-in flex justify-end">
              <p className={`max-w-[85%] rounded-2xl rounded-br-sm bg-jade px-3.5 py-2 leading-snug text-paper shadow-sm ${consoleMode ? "text-sm" : "text-[13px]"}`}>{m.text}</p>
            </div>
          ) : (
            <div key={m.id} className="pop-in flex items-end gap-1.5">
              <div className="mb-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-pine text-mint">
                <IcSpark className="h-3.5 w-3.5" />
              </div>
              <p className={`max-w-[86%] whitespace-pre-line rounded-2xl rounded-bl-sm border border-line bg-paper px-3.5 py-2 leading-snug shadow-sm ${consoleMode ? "text-sm" : "text-[13px]"}`}>
                {m.id > 1 ? <Typewriter text={m.text} /> : m.text}
              </p>
            </div>
          ),
        )}
        {thinking && (
          <div className="pop-in flex items-end gap-1.5">
            <div className="grid h-6 w-6 place-items-center rounded-lg bg-pine text-mint"><IcSpark className="h-3.5 w-3.5" /></div>
            <div className="flex gap-1 rounded-2xl rounded-bl-sm border border-line bg-paper px-3.5 py-2.5 shadow-sm">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-jade" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-jade" style={{ animationDelay: "0.15s" }} />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-jade" style={{ animationDelay: "0.3s" }} />
            </div>
          </div>
        )}
      </div>

      {/* quick replies */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-line bg-paper px-3 pb-1.5 pt-2">
        {qr.map((q) => (
          <button key={q} onClick={() => send(q)} disabled={busy}
            className="shrink-0 rounded-full border border-jade/40 bg-jadesoft px-3 py-1.5 font-bold text-jadedark transition-all hover:-translate-y-0.5 hover:bg-jade hover:text-paper disabled:opacity-50"
            style={{ fontSize: consoleMode ? "12.5px" : "11.5px" }}>
            {q}
          </button>
        ))}
      </div>

      {/* input */}
      <form
        className="flex items-center gap-2 border-t border-line bg-paper px-3 py-2.5"
        onSubmit={(e) => { e.preventDefault(); send(input); }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escreva para a Lia…"
          className={`min-w-0 flex-1 rounded-xl border border-line bg-cream px-3.5 py-2.5 outline-none transition-colors placeholder:text-ink/35 focus:border-jade ${consoleMode ? "text-base" : "text-[13px]"}`}
        />
        <button type="submit" disabled={busy} aria-label="Enviar"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pine text-mint transition-all hover:scale-105 hover:bg-jade disabled:opacity-50">
          <IcSend className="h-4.5 w-4.5" />
        </button>
      </form>
    </div>
  );
}
