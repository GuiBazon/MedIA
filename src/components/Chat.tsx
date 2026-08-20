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
  if (/primeiro horario|mais cedo|bem cedo|o mais cedo|cedo/.test(txt)) return "primeiro";
  if (/ultimo horario|mais tarde|fim do dia|final do dia|o mais tarde/.test(txt)) return "ultimo";
  if (/manha|cedo/.test(txt)) return (h) => +h.slice(0, 2) < 12;
  if (/depois do almoco|pos almoco/.test(txt)) return (h) => +h.slice(0, 2) >= 13;
  if (/tarde/.test(txt)) return (h) => { const x = +h.slice(0, 2); return x >= 12 && x < 18; };
  if (/noite|fim de tarde/.test(txt)) return (h) => +h.slice(0, 2) >= 17;
  let m = txt.match(/antes das? (\d{1,2})/);
  if (m) return (h) => +h.slice(0, 2) < +m![1];
  m = txt.match(/depois das? (\d{1,2})/);
  if (m) return (h) => +h.slice(0, 2) >= +m![1];
  m = txt.match(/entre\s*(\d{1,2})\s*(?:e|as?|:)\s*(\d{1,2})/);
  if (m) return (h) => { const x = +h.slice(0, 2); return x >= +m![1] && x < +m![2]; };
  return null;
};

const detectaEsp = (txt: string): number | null => {
  if (/cardio|coracao|cardiaco|pressao|peito|infarto|eletrocardiograma|palpitac|arritmia/.test(txt)) return 1;
  if (/clinica geral|clinico geral|clinico|geral|check ?up|rotina|gripe|febre|tosse|sangue|mal estar|atestado|receita|remedio|indisposic/.test(txt)) return 2;
  if (/odonto|dentista|dente|carie|canal|limpeza|siso|gengiva|aparelho|boca|tartaro/.test(txt)) return 3;
  if (/ortop|osso|joelho|coluna|costas|lombar|ombro|pe|braco|perna|fratura|torcao|entorse|articulac|tendinite|bursite/.test(txt)) return 4;
  if (/dermato|pele|acne|espinha|mancha|coceira|alergia|micose|cabelo|queda|unha|pinta|dermatite/.test(txt)) return 5;
  if (/pediat|crianca|bebe|filho|filha|infantil|recem nascido|vacina|puericultura/.test(txt)) return 6;
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

/* ================= componente ================= */
interface Props {
  variant?: "phone" | "console";
  onTool?: (t: ToolCallInfo) => void;
  apiRef?: React.MutableRefObject<{ send: (t: string) => void } | null>;
  className?: string;
}

export default function Chat({ variant = "phone", onTool, apiRef, className = "" }: Props) {
  const { state, dispatch } = useClinic();
  const acc = state.perfil.acessibilidade;
  const simp = acc.modoSimplificado;
  const leitor = acc.leitorDeTela;

  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 1, role: "ai", text: "Oi, Maria! Eu sou a Lia, secretária virtual da clínica. Marco, remarco, cancelo e confirmo consultas, vejo horários, fila de espera, preparo dos exames e mais. É só pedir digitando ou pelo microfone!" },
  ]);
  const [qr, setQr] = useState<string[]>(["Quero marcar uma consulta", "Qual minha próxima consulta?", "O que levar na consulta?", "Como está a fila?"]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ttsOn, setTtsOn] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState("");
  const recRef = useRef<any>(null);

  const draft = useRef<Draft>({ step: "idle" });
  const idSeq = useRef(10);
  const boxRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  /* Síntese vocal nativa pt-BR (TTS) */
  const speakText = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text
        .replace(/[*_#`~✓✕⚙👉•]/g, "")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/FM-([A-Z0-9]+)/g, "protocolo $1")
        .replace(/\bRN0(\d)\b/g, "regra zero $1")
        .trim();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = "pt-BR";
      u.rate = 1.02;
      u.pitch = 1.02;
      u.onstart = () => setIsSpeaking(true);
      u.onend = () => setIsSpeaking(false);
      u.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(u);
    } catch {
      setIsSpeaking(false);
    }
  };

  /* Reconhecimento de fala pt-BR (STT) */
  const toggleListening = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      dispatch({ t: "toast", texto: "Reconhecimento de voz não suportado neste navegador. Use o teclado ou os botões de atalho.", tom: "erro" });
      return;
    }
    if (isListening) {
      recRef.current?.stop();
      setIsListening(false);
      setVoiceInterim("");
      return;
    }
    try {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setTtsOn(true);
      const rec = new SR();
      rec.lang = "pt-BR";
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setIsListening(true);
        setVoiceInterim("Ouvindo sua voz...");
      };
      rec.onresult = (e: any) => {
        const trans = Array.from(e.results).map((r: any) => r[0].transcript).join("");
        setVoiceInterim(trans);
        if (e.results[0].isFinal) {
          setIsListening(false);
          setVoiceInterim("");
          send(trans);
        }
      };
      rec.onerror = () => {
        setIsListening(false);
        setVoiceInterim("");
      };
      rec.onend = () => {
        setIsListening(false);
      };
      recRef.current = rec;
      rec.start();
    } catch {
      setIsListening(false);
      setVoiceInterim("");
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, thinking, qr, isListening, isSpeaking]);

  const push = (m: Omit<Msg, "id">) => {
    setMsgs((p) => [...p, { ...m, id: ++idSeq.current }]);
    if (m.role === "ai" && ttsOn) {
      speakText(m.text);
    }
  };
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
        draft.current = { step: "propose", medicoId: med.id, dataISO: iso, propostas: alts, tipo };
        push({ role: "ai", text: "Ah, esse horário acabou de ser reservado por outro paciente — a trava de concorrência do banco (RN03) impediu o choque. Ainda tenho: " + alts.join(", ") + ". Qual desses?" });
        setQr([...alts.slice(0, 4), "Ver outro dia"]);
      } else {
        draft.current = { step: "fila", medicoId: med.id, dataISO: iso };
        push({ role: "ai", text: "Esse dia lotou de vez. Posso te colocar na fila de espera — se abrir vaga, você é a primeira a saber (com 60 min para confirmar). Quer entrar?" });
        setQr(["Entrar na fila de espera", "Ver outro dia"]);
      }
      return;
    }
    const proto = `FM-${hashStr(slotKey(med.id, iso, hora) + Date.now()).toString(36).slice(0, 5).toUpperCase()}`;
    tool("agendar_consulta", '{ "paciente_id": 1, "medico_id": ' + med.id + ', "data_hora": "' + iso + " " + hora + '", "tipo_pagamento": "' + tipo + '"' + (carteirinha ? ', "carteirinha": "' + carteirinha + '"' : "") + " }", "OK · protocolo " + proto);
    dispatch({ t: "addAg", ag: { id: Date.now(), paciente: stateRef.current.perfil.nome || "Maria Aparecida", voce: true, medicoId: med.id, dataISO: iso, hora, tipo, carteirinha: carteirinha || stateRef.current.perfil.carteirinha, status: "AGENDADO", protocolo: proto } });
    dispatch({
      t: "addAuditLog",
      quem: "IA (Lia · Tool Calling)",
      perfil: "ia",
      acao: "Agendamento de consulta",
      detalhes: `Consulta criada com ${med.nome} em ${fmtDataMedia(iso)} às ${hora} (protocolo ${proto})`,
    });
    await wait(620);
    const extra = tipo === "PARTICULAR" ? " Valor: " + fmtBRL(med.valor) + " (pagamento na recepção)." : " Convênio confirmado.";
    push({ role: "ai", text: "Prontinho! ✅ Consulta confirmada com " + med.nome + " — " + fmtDataLonga(iso) + ", às " + hora + " na " + (med.unidade || "Unidade Central") + ". Protocolo " + proto + "." + extra + " Te mando lembrete antes da consulta. 💚" });
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
    dispatch({ t: "cancelAg", id: ag.id, por: "IA (Lia · Chat)" });
    await wait(620);
    if (remarcar) {
      push({ role: "ai", text: "Cancelado! Agora vamos remarcar com " + med.nome + " (seu convênio continua valendo). Para qual dia você prefere?" });
      draft.current = { step: "resched-date", medicoId: med.id, agId: ag.id, tipo: ag.tipo };
      setQr(["Hoje", "Amanhã", "Ver dias com vagas"]);
    } else {
      const tinhaFila = stateRef.current.fila.some((f) => f.medicoId === ag.medicoId && f.dataISO === ag.dataISO && f.status === "AGUARDANDO");
      push({ role: "ai", text: "Feito! Sua consulta de " + fmtDataMedia(ag.dataISO) + " às " + ag.hora + " foi cancelada." + (tinhaFila ? " A vaga já foi oferecida ao 1º da fila de espera (RN02) — a fila anda sozinha por aqui. 😉" : "") + " Se precisar, é só chamar." });
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
        push({ role: "ai", text: horaExata + " está livre em " + fmtDataMedia(iso) + " com " + med.nome + "! Podemos confirmar?" });
        setQr(["Sim, pode confirmar", ...lv.filter((h) => h !== horaExata).slice(0, 2), "Ver outro dia"]);
        return;
      }
      const prox = lv.filter((h) => h > horaExata).slice(0, 3);
      const alt = prox.length ? prox : lv.slice(0, 3);
      draft.current = { ...draft.current, step: "propose", medicoId: med.id, dataISO: iso, propostas: alt };
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
    draft.current = { ...draft.current, step: "propose", medicoId: med.id, dataISO: iso, propostas: mostra };
    push({ role: "ai", text: "Para " + fmtDataLonga(iso) + ", " + med.nome + " tem: " + mostra.join(", ") + (sel.length > 6 ? "…" : "") + ". Qual prefere?" });
    setQr([...mostra.slice(0, 4), "Ver outro dia"]);
  };

  /* ---------- máquina principal de resposta ---------- */
  const responder = async (raw: string) => {
    setBusy(true);
    setThinking(true);
    await wait(550);
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
          const pg = /convenio|plano|carteirinha/.test(txt) ? "CONVENIO" : /particular|dinheiro|pix/.test(txt) ? "PARTICULAR" : d.tipo || null;
          d.step = "propose";
          if (pg) d.tipo = pg;
          if (hx && livres(med, iso).includes(hx) && pg) {
            d.tipo = pg;
            setThinking(false);
            if (pg === "CONVENIO") {
              d.step = "card";
              push({ role: "ai", text: "Anotado: " + hx + " em " + fmtDataMedia(iso) + ", pelo convênio. Me diga o número da carteirinha (ou confirme se é a salva no perfil)." });
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
          if (lv.length) { d.propostas = lv; push({ role: "ai", text: "E estes outros horários: " + lv.join(", ") + "?" }); setQr(lv); }
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
        dispatch({ t: "cancelAg", id: d.agId as number, por: "IA (Lia · Reagendamento)" });
        await wait(300);
        const proto = `FM-${hashStr(slotKey(med.id, iso, hora) + Date.now()).toString(36).slice(0, 5).toUpperCase()}`;
        dispatch({ t: "addAg", ag: { id: Date.now(), paciente: stateRef.current.perfil.nome || "Maria Aparecida", voce: true, medicoId: med.id, dataISO: iso, hora, tipo: old?.tipo ?? "CONVENIO", carteirinha: old?.carteirinha, status: "AGENDADO", protocolo: proto } });
        dispatch({
          t: "addAuditLog",
          quem: "IA (Lia · Tool Calling)",
          perfil: "ia",
          acao: "Reagendamento de consulta",
          detalhes: `Consulta reagendada com ${med.nome} para ${fmtDataMedia(iso)} às ${hora} (novo protocolo ${proto})`,
        });
        await wait(620);
        setThinking(false);
        push({ role: "ai", text: "Remarcado! ✅ Sua consulta com " + med.nome + " agora é " + fmtDataLonga(iso) + ", às " + hora + ". O horário antigo já foi liberado para outros pacientes" + (old?.tipo === "PARTICULAR" ? " (valor: " + fmtBRL(med.valor) + ")" : "") + ". Novo protocolo: " + proto + "." });
        setQr(["Qual minha próxima consulta?", "Obrigada!"]);
        draft.current = { step: "idle" };
        setBusy(false);
        return;
      }

      if (d.tipo === "CONVENIO") {
        d.step = "card";
        setThinking(false);
        push({ role: "ai", text: "Perfeito: " + hora + " em " + fmtDataMedia(iso) + " pelo convênio. Me diga o número da carteirinha." });
        setQr(["0042 8871 3345 09"]);
        setBusy(false);
        return;
      }
      if (d.tipo === "PARTICULAR") {
        setThinking(false);
        await agendar(med, iso, hora, "PARTICULAR");
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
      dispatch({ t: "joinFila", medicoId: med.id, dataISO: iso, paciente: stateRef.current.perfil.nome || "Maria Aparecida", voce: true });
      const pos = s().fila.filter((f) => f.medicoId === med.id && f.dataISO === iso && (f.status === "AGUARDANDO" || f.status === "NOTIFICADO")).length;
      tool("inserir_fila_espera", '{ "paciente_id": 1, "medico_id": ' + med.id + ', "data_desejada": "' + iso + '" }', "OK · posição " + pos + "ª");
      dispatch({
        t: "addAuditLog",
        quem: "IA (Lia · Tool Calling)",
        perfil: "ia",
        acao: "Entrada na fila de espera",
        detalhes: `${stateRef.current.perfil.nome} entrou na ${pos}ª posição da fila de ${med.nome} para ${fmtDataMedia(iso)}`,
      });
      await wait(560);
      setThinking(false);
      push({ role: "ai", text: "Você é a " + pos + "ª na fila de " + fmtDataMedia(iso) + " com " + med.nome + ". Assim que abrir uma vaga, o app te notifica — e você tem 60 minutos para confirmar (RN02), combinado?" });
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
      if (digitos.length < 6 && !AFFIRM.test(txt)) {
        setThinking(false);
        push({ role: "ai", text: "Hmm, esse número parece curto demais. Confere a carteirinha? São pelo menos 6 a 8 dígitos." });
        setQr(["0042 8871 3345 09"]);
        setBusy(false);
        return;
      }
      const numFinal = digitos.length >= 6 ? digitos.replace(/(\d{4})(?=\d)/g, "$1 ").trim() : stateRef.current.perfil.carteirinha;
      setThinking(false);
      await agendar(med, d.dataISO as string, d.hora as string, "CONVENIO", numFinal);
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
        push({ role: "ai", text: "Qual delas você deseja selecionar? Me diga a data ou o médico." });
        setQr(futs.map((a) => fmtDataMedia(a.dataISO) + " · " + (medicoDe(a.medicoId)?.nome.replace("Dra. ", "").replace("Dr. ", "") ?? "")));
        setBusy(false);
        return;
      }
      const remarca = /remarc|reagend|trocar|mudar/.test(txt);
      d.step = "idle";
      setThinking(false);
      await cancelarAg(alvo, remarca);
      setBusy(false);
      return;
    }

    /* ===== INTENÇÕES GLOBAIS ===== */
    const futs = futuras();

    /* 1. Sair da fila de espera */
    if (/sair da fila|tirar da fila|remover da fila|desistir da fila/.test(txt)) {
      const minhas = s().fila.filter((f) => f.voce && (f.status === "AGUARDANDO" || f.status === "NOTIFICADO"));
      setThinking(false);
      if (!minhas.length) {
        push({ role: "ai", text: "Você não está em nenhuma fila de espera no momento. 😉" });
        setQr(["Quero marcar uma consulta"]);
      } else {
        minhas.forEach((f) => dispatch({ t: "leaveFila", waitId: f.id }));
        tool("consultar_fila", '{ "paciente_id": 1, "acao": "remover" }', "OK · " + minhas.length + " inscrição(ões) removida(s)");
        dispatch({
          t: "addAuditLog",
          quem: "IA (Lia · Tool Calling)",
          perfil: "ia",
          acao: "Saída da fila de espera",
          detalhes: `${stateRef.current.perfil.nome} removeu ${minhas.length} inscrição(ões) da fila`,
        });
        await wait(480);
        push({ role: "ai", text: "Pronto, tirei você da fila (" + minhas.map((f) => fmtDataMedia(f.dataISO)).join(", ") + "). Se mudar de ideia, é só pedir." });
        setQr(["Quero marcar uma consulta"]);
      }
      setBusy(false);
      return;
    }

    /* 2. Consultar ou entrar na fila */
    if (/fila/.test(txt)) {
      if (/entrar|inscrever|coloc.*na fila/.test(txt)) {
        const espSel = detectaEsp(txt);
        const med = detectaMedicoTxt(txt, s().medicos) ?? (espSel ? s().medicos.find((m) => m.espId === espSel) : undefined);
        const iso = parseData(raw) || addDaysISO(HOJE, 1);
        if (med) {
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
        push({ role: "ai", text: "Você não está em nenhuma fila de espera agora. Se um dia a agenda estiver lotada, eu mesma te ofereço a fila na hora. 😉" });
        setQr(["Quero marcar uma consulta", "Qual minha próxima consulta?"]);
      } else {
        tool("consultar_fila", '{ "paciente_id": 1 }', minhas.length + " inscrição(ões) ativa(s)");
        await wait(480);
        const linhas = minhas.map((f) => {
          const status = f.status === "NOTIFICADO" ? "vaga oferecida! restam " + f.janelaRestante + " min para confirmar" : "aguardando";
          return "• " + fmtDataMedia(f.dataISO) + " com " + (medicoDe(f.medicoId)?.nome ?? "") + " — posição " + f.posicao + "ª (" + status + ")";
        }).join("\n");
        push({ role: "ai", text: linhas + "\n\nLembrando a regra (RN02): só o 1º colocado é notificado, e a janela de confirmação é de 60 minutos." });
        setQr(["Sair da fila", "Obrigada!"]);
      }
      setBusy(false);
      return;
    }

    /* 3. Cancelar consulta */
    if (/cancel|desmarc/.test(txt)) {
      setThinking(false);
      if (!futs.length) {
        push({ role: "ai", text: "Você não tem consultas futuras para cancelar. Quer marcar uma nova agora?" });
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

    /* 4. Remarcar consulta */
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

    /* 5. Confirmar presença */
    if (/confirmar? (minha )?(presenca|presença|consulta)|confirmo presenca|vou (sim|comparecer)|estou confirmado/.test(txt)) {
      setThinking(false);
      if (!futs.length) {
        push({ role: "ai", text: "Você não tem consultas futuras pendentes para confirmar." });
        setQr(["Quero marcar uma consulta"]);
      } else {
        const ag = futs[0];
        tool("confirmar_consulta", '{ "agendamento_id": ' + ag.id + " }", "OK · presença confirmada no sistema");
        dispatch({ t: "confirmarPresenca", id: ag.id, por: "IA (Lia · Chat)" });
        dispatch({ t: "pushNotif", n: { id: Date.now(), titulo: "Presença confirmada", texto: "Você confirmou presença em " + fmtDataMedia(ag.dataISO) + " às " + ag.hora + ". A recepção já foi avisada.", tipo: "info", lida: false } });
        await wait(560);
        push({ role: "ai", text: "Presença confirmada com sucesso! ✅ Te esperamos em " + fmtDataLonga(ag.dataISO) + ", às " + ag.hora + ", com " + (medicoDe(ag.medicoId)?.nome ?? "") + ". Chegue 10 minutinhos antes, tá?" });
        setQr(["O que levar?", "Minhas consultas", "Obrigada!"]);
      }
      setBusy(false);
      return;
    }

    /* 6. Consultar próximas consultas */
    if (/proxima consulta|minhas consultas|meus agendamentos|quando e minha|tenho consulta/.test(txt)) {
      setThinking(false);
      tool("buscar_consulta", '{ "paciente_id": 1 }', futs.length + " consulta(s) futura(s)");
      await wait(480);
      if (!futs.length) {
        push({ role: "ai", text: "Nenhuma consulta futura no momento. Quer agendar uma? Eu cuido de tudo para você." });
      } else {
        const linhas = futs.map((a, i) => {
          const m2 = medicoDe(a.medicoId);
          const extra = a.tipo === "PARTICULAR" ? " · " + fmtBRL(m2?.valor ?? 0) : " · convênio";
          const statusConf = a.confirmada ? " [✓ presenca confirmada]" : " [pendente de confirmacao]";
          return (i === 0 ? "👉 " : "• ") + fmtDataMedia(a.dataISO) + " às " + a.hora + " — " + (m2?.nome ?? "") + " (" + (m2?.unidade || "Unidade Central") + ")" + extra + statusConf;
        }).join("\n");
        push({ role: "ai", text: "Suas consultas agendadas:\n" + linhas + "\n\nPosso confirmar sua presença, remarcar ou tirar dúvidas de preparo. O que prefere?" });
      }
      setQr(["Confirmar presença", "Remarcar", "Cancelar", "O que levar?"]);
      setBusy(false);
      return;
    }

    /* 7. Relatórios médicos / laudos */
    if (/relatorio|exame|resultado|laudo/.test(txt)) {
      setThinking(false);
      const rels = s().ags.filter((a) => a.voce && a.relatorio);
      const linhasRel = rels.map((a) => {
        const r = a.relatorio;
        return "• " + (r ? r.titulo : "") + " — emitido em " + (r ? r.emissao : "");
      }).join("\n");
      push({ role: "ai", text: rels.length ? "Seus relatórios e laudos disponíveis:\n" + linhasRel + "\n\nVocê pode visualizá-los e baixá-los na aba Consultas > Relatórios do app." : "Nenhum relatório novo arquivado no momento. Assim que um profissional finalizar um laudo, ele aparece no seu app." });
      setQr(["Minhas consultas", "Obrigada!"]);
      setBusy(false);
      return;
    }

    /* 8. Orientações de preparo / "O que levar" */
    if (/o que levar|preparo|orientac|jejum|como me preparo|documentos/.test(txt) || (d.orientAsk && detectaEsp(txt) !== null)) {
      const medSel = detectaMedicoTxt(txt, s().medicos);
      const espId = detectaEsp(txt) ?? (d.orientAsk ? medSel?.espId ?? null : null);
      d.orientAsk = false;
      setThinking(false);
      if (!espId) {
        d.orientAsk = true;
        push({ role: "ai", text: "Temos orientações específicas para cada especialidade. De qual especialidade você gostaria de saber as instruções?" });
        setQr(["Clínica Geral", "Cardiologia", "Odontologia", "Ortopedia", "Dermatologia", "Pediatria"]);
      } else {
        const esp = ESPECIALIDADES.find((e) => e.id === espId);
        tool("buscar_orientacoes", '{ "especialidade_id": ' + espId + " }", (ORIENTACOES[espId]?.length || 3) + " orientações");
        await wait(480);
        const lista = ORIENTACOES[espId] || [
          "Documento oficial com foto (RG ou CNH)",
          "Carteirinha do convênio ou comprovante",
          "Exames anteriores relacionados",
          "Chegar com 10 a 15 minutos de antecedência"
        ];
        const itens = lista.map((o) => "• " + o).join("\n");
        push({ role: "ai", text: "Para " + (esp?.nome ?? "sua consulta") + ", orientamos:\n" + itens + "\n\nNo Modo Voz, eu leio tudo isso para você em áudio." });
        setQr(["Minhas consultas", "Quero marcar uma consulta", "Obrigada!"]);
      }
      setBusy(false);
      return;
    }

    /* 9. Responsável autorizado / Acompanhante */
    if (/responsavel|acompanhante|quem cuida|meu contato|minha filha|meu filho/.test(txt)) {
      setThinking(false);
      tool("buscar_responsavel", '{ "paciente_id": 1 }', "1 responsável autorizado");
      await wait(480);
      const resp = stateRef.current.perfil.responsavelNome || RESPONSAVEL_SEED.nome;
      const respTel = stateRef.current.perfil.responsavelTelefone || RESPONSAVEL_SEED.telefone;
      const perm = RESPONSAVEL_SEED.permissoes.map((p) => (p.ok ? "✓ " : "✕ ") + p.acao).join("\n");
      push({ role: "ai", text: "Seu responsável autorizado é " + resp + " (" + RESPONSAVEL_SEED.parentesco + ") · Tel: " + respTel + ".\n\nPermissões ativas na API:\n" + perm + "\n\nO responsável pode agir por você pelo próprio app dele conforme essas permissões concedidas." });
      setQr(["Minhas consultas", "Obrigada!"]);
      setBusy(false);
      return;
    }

    /* 10. Regras de negócio da clínica */
    if (/regra|30 min|trava|como funciona a regra|concorrencia|como funciona o sistema/.test(txt)) {
      setThinking(false);
      push({ role: "ai", text: "O AcolheMed opera com 3 travas de segurança essenciais:\n\n1️⃣ **RN01 (Trava de 30 min):** Cancelamentos automáticos só até 30 min antes. Menos de 30 min protege a agenda do médico e direciona para a recepção.\n2️⃣ **RN02 (Fila Sequencial):** Quando abre vaga, só o 1º da fila é notificado e tem 60 minutos para confirmar.\n3️⃣ **RN03 (Bloqueio Transacional):** Trava no MySQL que impede agendamentos simultâneos na mesma vaga." });
      setQr(["Quero marcar uma consulta", "Como está a fila?"]);
      setBusy(false);
      return;
    }

    /* 11. Endereço, Horários, Telefones e Atendente */
    if (/atendente|humano|pessoa|recepcao|secretaria humana|telefone|ligar|endereco|onde fica|onde voces ficam|funciona|abre|fecha|localizacao|onde e/.test(txt) && !/marc|agend/.test(txt)) {
      setThinking(false);
      dispatch({ t: "pushNotif", n: { id: Date.now(), titulo: "Atendimento humano solicitado", texto: "Solicitação de contato enviada à recepção.", tipo: "info", lida: false } });
      dispatch({
        t: "addAuditLog",
        quem: "IA (Lia · Tool Calling)",
        perfil: "ia",
        acao: "Atendimento humano",
        detalhes: `${stateRef.current.perfil.nome} solicitou contato com a recepção humana`,
      });
      push({ role: "ai", text: "Informações de contato e atendimento:\n📞 Telefone/WhatsApp: " + TEL_CLINICA + "\n🕒 Atendimento: " + FUNCIONAMENTO + "\n📍 Endereço: " + ENDERECO_CLINICA + "\n🚗 Estacionamento conveniado no local.\n\nJá notifiquei a recepção da sua solicitação!" });
      setQr(["Minhas consultas", "Obrigada!"]);
      setBusy(false);
      return;
    }

    /* 12. Preços e Valores particulares / Convênio */
    if (/quanto|valor|preco|custa|tabela|particular/.test(txt) && !/marc|agend/.test(txt)) {
      setThinking(false);
      const vals = s().medicos.map((m) => {
        const esp2 = ESPECIALIDADES.find((e) => e.id === m.espId);
        return "• " + (esp2?.nome ?? "") + " (" + m.nome.replace("Dra. ", "").replace("Dr. ", "") + ") — " + fmtBRL(m.valor);
      }).join("\n");
      push({ role: "ai", text: "Tabela de consultas particulares:\n" + vals + "\n\n💡 Pelo convênio de saúde (ex.: Vida+, Unimed, Bradesco) você não paga nada a mais. Como você gostaria de marcar?" });
      setQr(["Quero marcar uma consulta", "Ver médicos"]);
      setBusy(false);
      return;
    }

    /* 13. Médicos e Equipe */
    if (/quais medicos|quem atende|especialidades|quais (sao )?os medicos|lista de medicos|corpo clinico/.test(txt)) {
      setThinking(false);
      const eq = s().medicos.map((m) => {
        const esp2 = ESPECIALIDADES.find((e) => e.id === m.espId);
        return "• " + m.nome + " — " + (esp2?.nome ?? "") + " (CRM " + m.crm + " · " + (m.unidade || "Unidade Central") + ")";
      }).join("\n");
      push({ role: "ai", text: "Nosso corpo clínico disponível:\n" + eq + "\n\nQual especialidade você gostaria de agendar?" });
      setQr(["Cardiologia", "Clínica Geral", "Odontologia", "Ortopedia", "Dermatologia", "Pediatria"]);
      setBusy(false);
      return;
    }

    /* 14. Saudações e Elogios */
    if (/^(oi+|ola+|bom dia|boa tarde|boa noite|eai|e ai|opa|hey|hello)\b/.test(txt) && txt.length < 30) {
      setThinking(false);
      const h = new Date().getHours();
      const sauda = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
      push({ role: "ai", text: sauda + ", " + (stateRef.current.perfil.nome.split(" ")[0] || "Maria") + "! 💚 Como posso te ajudar hoje? Posso marcar consultas, consultar horários, confirmar presença, gerenciar sua fila de espera e tirar dúvidas." });
      setQr(["Quero marcar uma consulta", "Qual minha próxima consulta?", "Como está a fila?", "O que levar?"]);
      setBusy(false);
      return;
    }

    if (/obrigad|valeu|otimo|perfeito$|show|top$|tchau|ate logo|adeus|muito bom/.test(txt)) {
      setThinking(false);
      push({ role: "ai", text: "Eu que agradeço! 💚 Estou sempre por aqui 24 horas por dia. Se precisar de qualquer coisa, é só me chamar. Tenha um excelente dia!" });
      setQr(["Quero marcar uma consulta", "Minhas consultas"]);
      setBusy(false);
      return;
    }

    /* ===== FLUXO DE AGENDAMENTO E CONSULTA DE HORÁRIOS ===== */
    const querAgendar = /agend|marc(ar|a|acao)?|consulta nova|quero (uma )?consulta|reserv|passar no|atendimento/.test(txt);
    const querHorarios = /horario|disponib|vaga|quando.*atende|agenda|atende quando|tem (consulta|lugar)|dia.*livre/.test(txt);
    const esp = detectaEsp(txt);
    const medNome = detectaMedicoTxt(txt, s().medicos);
    const isoMencionado = parseData(raw);

    if (querAgendar || querHorarios || esp || medNome || (isoMencionado && /consulta|medic|doctor|doutor/.test(txt))) {
      const med = medNome ?? (esp ? s().medicos.find((m) => m.espId === esp) : undefined);
      if (!med) {
        setThinking(false);
        push({ role: "ai", text: "Temos 6 especialidades médicas com agendamento aberto. Para qual especialidade você precisa?" });
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
          setQr(["Ver dias com vagas", "Amanhã"]);
          setBusy(false);
          return;
        }
        if (st === "cheio") {
          setThinking(false);
          push({ role: "ai", text: "Poxa, " + fmtDataLonga(isoMencionado) + " está completamente lotado para " + med.nome + ". Posso te colocar na fila de espera: se abrir vaga, você é avisada na hora (com 60 min para confirmar). Quer entrar?" });
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
            draft.current = { step: "card", medicoId: med.id, dataISO: isoMencionado, hora: hx, tipo: "CONVENIO" };
            push({ role: "ai", text: "Achei " + hx + " livre em " + fmtDataMedia(isoMencionado) + " com " + med.nome + "! Me diga o número da carteirinha para confirmar." });
            setQr(["0042 8871 3345 09"]);
          } else {
            await agendar(med, isoMencionado, hx, "PARTICULAR");
          }
          setBusy(false);
          return;
        }
        draft.current = { step: "propose", medicoId: med.id, dataISO: isoMencionado, tipo: pg || undefined };
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
        push({ role: "ai", text: "A agenda de " + med.nome + " está cheia nas próximas semanas. Posso te colocar na fila de espera do dia que preferir — o sistema te avisa assim que surgir vaga." });
        d.dataISO = addDaysISO(HOJE, 3);
        d.step = "fila";
        setQr(["Entrar na fila de espera"]);
      } else {
        push({ role: "ai", text: "Próximos dias com agenda aberta para " + med.nome + ": " + dias.map((x) => fmtDataMedia(x)).join(" · ") + ". Para qual dia você prefere?" });
        setQr([...dias.map((x) => fmtDataMedia(x)), "Ver dias com vagas"]);
      }
      setBusy(false);
      return;
    }

    /* Fallback inteligente com contexto */
    setThinking(false);
    push({ role: "ai", text: "Entendi! Como assistente da clínica, posso marcar, reagendar, cancelar e confirmar consultas, consultar a fila de espera, orientações de exames, médicos disponíveis e tirar dúvidas sobre a clínica. Como posso te ajudar?" });
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
      {/* header com controle de voz */}
      <div className="flex items-center gap-2.5 border-b border-line bg-paper py-2.5 pl-3.5 pr-4">
        <div className="relative">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-pine text-mint">
            <IcSpark className="h-5 w-5" />
          </div>
          <span className="pulse-dot absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-jade ring-2 ring-paper" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="font-display text-sm font-bold leading-tight text-ink">Lia · Secretária Virtual</p>
            {simp && <span className="rounded bg-jade/20 px-1 font-mono text-[8.5px] font-extrabold text-jadedark">MODO VOZ</span>}
          </div>
          <p className="font-mono text-[10px] text-jade">ollama · llama3 · local — online</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = !ttsOn;
            setTtsOn(next);
            if (!next && "speechSynthesis" in window) {
              window.speechSynthesis.cancel();
              setIsSpeaking(false);
            }
          }}
          title={ttsOn ? "Respostas em áudio ativadas (clique para mutar)" : "Respostas em áudio desativadas (clique para ativar)"}
          aria-label={ttsOn ? "Desativar áudio falado" : "Ativar áudio falado"}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase tracking-wide transition-all shadow-sm ${
            ttsOn ? "bg-jade text-paper border border-jade" : "bg-cream text-ink/60 border border-line"
          }`}
        >
          <span>{ttsOn ? "🔊 Áudio on" : "🔇 Áudio off"}</span>
        </button>
      </div>

      {/* Banner de áudio falado ou gravando */}
      {isListening && (
        <div className="flex items-center gap-2 bg-coral px-3.5 py-2 font-mono text-[11px] font-extrabold text-paper shadow-md animate-pulse">
          <span className="h-2.5 w-2.5 rounded-full bg-paper shrink-0 animate-ping" />
          <span className="truncate flex-1">🎙 {voiceInterim || "Ouvindo sua voz... fale sua dúvida ou consulta"}</span>
          <button type="button" onClick={toggleListening} className="rounded-full bg-paper/25 px-2 py-0.5 text-[10px] uppercase font-bold hover:bg-paper/40">
            Parar
          </button>
        </div>
      )}
      {isSpeaking && !isListening && (
        <div className="flex items-center gap-2 bg-jadedark px-3.5 py-1.5 font-mono text-[11px] font-bold text-paper shadow-sm">
          <span className="flex items-center gap-0.5">
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-mint" />
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-mint" style={{ animationDelay: "0.15s" }} />
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-mint" style={{ animationDelay: "0.3s" }} />
          </span>
          <span className="truncate flex-1">🔊 Lia falando em áudio com você...</span>
          <button type="button" onClick={() => { window.speechSynthesis?.cancel(); setIsSpeaking(false); }} className="rounded-full bg-paper/20 px-2 py-0.5 text-[9.5px] uppercase font-bold hover:bg-paper/30">
            Pausar
          </button>
        </div>
      )}

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
              <div className="flex flex-col gap-1 max-w-[88%]">
                <div className={`whitespace-pre-line rounded-2xl rounded-bl-sm border border-line bg-paper px-4 py-2.5 shadow-md text-ink font-medium leading-relaxed ${consoleMode ? "text-[14.5px]" : "text-[13.5px]"}`}>
                  {m.text}
                </div>
                <div className="flex items-center gap-1.5 pl-1">
                  <button
                    type="button"
                    onClick={() => speakText(m.text)}
                    title="Ouvir esta mensagem em áudio"
                    aria-label="Ouvir esta mensagem em áudio"
                    className="flex items-center gap-1 rounded-full border border-line bg-paper px-2.5 py-0.5 font-mono text-[9.5px] font-bold text-ink/75 hover:bg-jadesoft hover:text-jadedark transition-colors"
                  >
                    <span>🔊 Ouvir em áudio</span>
                  </button>
                </div>
              </div>
            </div>
          ),
        )}
        {thinking && (
          <div className="pop-in flex items-end gap-1.5">
            <div className="grid h-6 w-6 place-items-center rounded-lg bg-pine text-mint"><IcSpark className="h-3.5 w-3.5" /></div>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-line bg-paper px-4 py-2.5 shadow-md">
              <span className="typing-dot h-2 w-2 rounded-full bg-jade" />
              <span className="typing-dot h-2 w-2 rounded-full bg-jade" style={{ animationDelay: "0.15s" }} />
              <span className="typing-dot h-2 w-2 rounded-full bg-jade" style={{ animationDelay: "0.3s" }} />
              <span className="ml-1 text-[11px] font-bold text-ink/60">Lia pensando...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* quick replies com quebra de linha para exibir todas as opções */}
      {qr.length > 0 && (
        <div className="border-t border-line bg-paper/95 px-3 py-2">
          <p className="mb-1.5 font-mono text-[9.5px] font-bold uppercase tracking-wider text-ink/60">
            Opções e atalhos rápidos:
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto thin-scroll">
            {qr.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={busy}
                className="rounded-xl border border-jade/40 bg-jadesoft px-3 py-1.5 font-bold text-jadedark transition-all hover:scale-[1.02] hover:bg-jade hover:text-paper hover:border-jade active:scale-95 disabled:opacity-50 text-[12px] shadow-sm text-left leading-snug"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* input com microfone integrado para voz */}
      <form
        className="flex items-center gap-2 border-t border-line bg-paper px-3 py-2.5"
        onSubmit={(e) => { e.preventDefault(); send(input); }}
      >
        <button
          type="button"
          onClick={toggleListening}
          aria-label={isListening ? "Parar de ouvir" : "Falar por voz com a IA Lia"}
          title={isListening ? "Clique para parar gravação" : "Falar por voz (Reconhecimento de fala)"}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-all shadow-sm ${
            isListening
              ? "bg-coral text-paper scale-105 animate-pulse"
              : "bg-jadesoft text-jadedark border border-jade/40 hover:bg-jade hover:text-paper"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3" fill={isListening ? "currentColor" : "none"} />
            <path d="M5 10a7 7 0 0 0 14 0M12 18v4M8 22h8" />
          </svg>
        </button>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? "Ouvindo sua fala..." : "Fale pelo microfone ou digite..."}
          className={`min-w-0 flex-1 rounded-xl border border-line bg-cream px-3.5 py-2.5 outline-none transition-colors placeholder:text-ink/45 focus:border-jade text-ink font-medium ${consoleMode ? "text-base" : "text-[13px]"}`}
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Enviar mensagem"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pine text-mint transition-all hover:scale-105 hover:bg-jade disabled:opacity-40">
          <IcSend className="h-4.5 w-4.5" />
        </button>
      </form>
    </div>
  );
}
