import React, { useEffect, useRef, useState } from "react";
import { useClinic } from "../store";
import {
  Agendamento, Medico, MIN_CANCEL, addDaysISO, dayStatus, fmtDataLonga, fmtDataMedia, fmtBRL, fromISO, hashStr,
  HOJE, isBusyExterno, MESES_CURTO, minutesUntil, norm, pad, slotKey, slotsDoDia, DIA_LONGO,
} from "../data";
import { usePRM } from "./ui";
import { IcSpark, IcSend } from "./icons";

interface Msg { id: number; role: "user" | "ai" | "tool"; text: string; toolName?: string; toolArgs?: string }
type Step = "idle" | "date" | "time" | "payment" | "card" | "fila";
interface Draft { medicoId?: number; dataISO?: string; hora?: string; step: Step }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

export default function Chat() {
  const { state, dispatch } = useClinic();
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 1, role: "ai", text: "Oi, Maria! Eu sou a Lia, secretária virtual da clínica. Posso marcar, remarcar e cancelar consultas, ver horários e te colocar na fila de espera. Como posso ajudar?" },
  ]);
  const [qr, setQr] = useState<string[]>(["Quero marcar uma consulta", "Ver horários de Cardiologia", "Minhas consultas", "Como está a fila?"]);
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
  const medicoDe = (id?: number) => stateRef.current.medicos.find((m) => m.id === id);

  const livres = (med: Medico, iso: string) => {
    const s = stateRef.current;
    return slotsDoDia(med, iso).filter(
      (h) => !isBusyExterno(med.id, iso, h, s.freed, s.extra) &&
        !s.ags.some((a) => a.medicoId === med.id && a.dataISO === iso && a.hora === h && a.status === "AGENDADO"),
    );
  };

  const parseData = (raw: string): string | null => {
    const txt = norm(raw);
    if (/\bhoje\b/.test(txt)) return HOJE;
    if (/\bamanha\b/.test(txt)) return addDaysISO(HOJE, 1);
    const dm = txt.match(/(\d{1,2})[\/\-.](\d{1,2})/);
    if (dm) {
      const d = +dm[1], m = +dm[2];
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
        const now = new Date();
        const y = now.getFullYear() + (m < now.getMonth() + 1 ? 1 : 0);
        const iso = `${y}-${pad(m)}-${pad(d)}`;
        return iso >= HOJE ? iso : null;
      }
    }
    /* “12 jun” — formato das sugestões rápidas */
    const dmes = txt.match(/(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/);
    if (dmes) {
      const d = +dmes[1];
      const m = MESES_CURTO.indexOf(dmes[2]) + 1;
      const now = new Date();
      const y = now.getFullYear() + (m < now.getMonth() + 1 ? 1 : 0);
      const iso = `${y}-${pad(m)}-${pad(d)}`;
      return iso >= HOJE ? iso : null;
    }
    const nomes = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    const abrev = ["", "seg", "ter", "qua", "qui", "sex", "sab"];
    for (let i = 1; i <= 10; i++) {
      const iso = addDaysISO(HOJE, i);
      const w = fromISO(iso).getDay();
      if (txt.includes(nomes[w])) return iso;
      if (w > 0 && new RegExp(`\\b${abrev[w]}\\b`).test(txt)) return iso;
    }
    return null;
  };

  const parseHora = (raw: string): string | null => {
    const txt = norm(raw);
    const m = txt.match(/(\d{1,2})\s*[:h]\s*(\d{2})/);
    if (m) return `${pad(+m[1])}:${m[2]}`;
    const h = txt.match(/\b(\d{1,2})\s*(?:h|horas?)\b/);
    if (h) return `${pad(+h[1])}:00`;
    return null;
  };

  const detectaEsp = (txt: string): number | null => {
    if (/cardio|coracao/.test(txt)) return 1;
    if (/clinica geral|clinico|geral|check ?up/.test(txt)) return 2;
    if (/odonto|dent/.test(txt)) return 3;
    if (/ortop|osso|joelho|coluna/.test(txt)) return 4;
    if (/dermato|pele/.test(txt)) return 5;
    if (/pediat|crianca|filho|filha/.test(txt)) return 6;
    return null;
  };
  const detectaMedico = (txt: string): Medico | null => {
    const ms = stateRef.current.medicos;
    return ms.find((m) => txt.includes(norm(m.nome).split(" ").pop()!)) ?? null;
  };

  const proximaDeMaria = (): Agendamento | undefined =>
    stateRef.current.ags
      .filter((a) => a.voce && a.status === "AGENDADO")
      .sort((a, b) => `${a.dataISO}${a.hora}`.localeCompare(`${b.dataISO}${b.hora}`))[0];

  const agendar = async (med: Medico, iso: string, hora: string, tipo: "CONVENIO" | "PARTICULAR", carteirinha?: string) => {
    const s = stateRef.current;
    const confl = isBusyExterno(med.id, iso, hora, s.freed, s.extra) ||
      s.ags.some((a) => a.medicoId === med.id && a.dataISO === iso && a.hora === hora && a.status === "AGENDADO");
    if (confl) {
      const alts = livres(med, iso).slice(0, 3);
      push({ role: "tool", text: `criar_agendamento → ERRO 409 · horário indisponível (RN03 — trava transacional)`, toolName: "criar_agendamento", toolArgs: `{ "medico_id": ${med.id}, "data_hora": "${iso} ${hora}" }` });
      await wait(600);
      push({ role: "ai", text: `Ah, que pena — esse horário acabou de ser reservado por outro paciente. ${alts.length ? `Ainda tenho livres: ${alts.join(", ")}. Quer um deles?` : "Esse dia lotou. Posso te colocar na fila de espera."}` });
      setQr(alts.length ? alts : ["Entrar na fila de espera"]);
      draft.current.step = alts.length ? "time" : "fila";
      return;
    }
    const proto = `FM-${hashStr(slotKey(med.id, iso, hora) + Date.now()).toString(36).slice(0, 5).toUpperCase()}`;
    push({ role: "tool", text: `criar_agendamento → OK · protocolo ${proto}`, toolName: "criar_agendamento", toolArgs: `{ "paciente_id": 1, "medico_id": ${med.id}, "data_hora": "${iso} ${hora}", "tipo_pagamento": "${tipo}"${carteirinha ? `, "carteirinha": "${carteirinha}"` : ""} }` });
    dispatch({ t: "addAg", ag: { id: Date.now(), paciente: "Maria Aparecida", voce: true, medicoId: med.id, dataISO: iso, hora, tipo, carteirinha, status: "AGENDADO", protocolo: proto } });
    await wait(650);
    push({ role: "ai", text: `Prontinho! ✅ Consulta confirmada com ${med.nome} em ${fmtDataLonga(iso)}, às ${hora}. Protocolo ${proto}. ${tipo === "PARTICULAR" ? `Valor: ${fmtBRL(med.valor)} — pagamento na recepção.` : "Apresente a carteirinha na recepção."} Te lembro um dia antes. 💚` });
    setQr(["Minhas consultas", "Marcar outra", "Obrigada!"]);
    draft.current = { step: "idle" };
  };

  const cancelar = async (ag: Agendamento, remarcar: boolean) => {
    const med = medicoDe(ag.medicoId)!;
    const min = minutesUntil(ag.dataISO, ag.hora);
    if (min < MIN_CANCEL) {
      push({ role: "tool", text: `cancelar_agendamento → BLOQUEADO · antecedência ${min} min < ${MIN_CANCEL} min (RN01)`, toolName: "cancelar_agendamento", toolArgs: `{ "agendamento_id": ${ag.id} }` });
      await wait(600);
      push({ role: "ai", text: `Maria, sua consulta com ${med.nome} é ${ag.dataISO === HOJE ? "hoje" : fmtDataMedia(ag.dataISO)} às ${ag.hora} — faltam menos de ${MIN_CANCEL} minutos. Pela regra da clínica (RN01), eu não consigo cancelar pelo app tão perto do horário. Fale com a recepção: (11) 4002-8922. Eles resolvem em 1 minutinho!` });
      setQr(["Entendi", "Minhas consultas"]);
      return;
    }
    push({ role: "tool", text: `cancelar_agendamento → OK · status CANCELADO`, toolName: "cancelar_agendamento", toolArgs: `{ "agendamento_id": ${ag.id} }` });
    dispatch({ t: "cancelAg", id: ag.id });
    await wait(650);
    if (remarcar) {
      push({ role: "ai", text: `Cancelado! Vamos remarcar com ${med.nome}: para qual dia você prefere?` });
      draft.current = { medicoId: med.id, step: "date" };
      setQr(["Amanhã", "Segunda-feira", "Ver dias com vagas"]);
    } else {
      const tinhaFila = stateRef.current.fila.some((f) => f.medicoId === ag.medicoId && f.dataISO === ag.dataISO && f.status === "AGUARDANDO");
      push({ role: "ai", text: `Feito! Sua consulta de ${fmtDataMedia(ag.dataISO)} às ${ag.hora} foi cancelada.${tinhaFila ? " A vaga já foi oferecida ao 1º da fila de espera — a fila anda sozinha por aqui. 😉" : ""} Se precisar de algo, é só chamar.` });
      setQr(["Marcar nova consulta", "Minhas consultas"]);
      draft.current = { step: "idle" };
    }
  };

  const responder = async (raw: string) => {
    setBusy(true);
    setThinking(true);
    await wait(620);
    const txt = norm(raw);
    const s = () => stateRef.current;
    const d = draft.current;

    /* ---------- passos de um fluxo em andamento ---------- */
    if (d.step === "date") {
      const iso = parseData(raw) ?? (txt.includes("dias com vagas") || txt.includes("ver dias") ? "LISTAR" : null);
      const med = medicoDe(d.medicoId)!;
      if (iso === "LISTAR" || iso === null) {
        const dias: string[] = [];
        for (let i = 0; i <= 13 && dias.length < 3; i++) {
          const cand = addDaysISO(HOJE, i);
          if (dayStatus(med, cand, s().ags, s().freed, s().extra) === "livre") dias.push(cand);
        }
        setThinking(false);
        push({ role: "ai", text: `Esses são os próximos dias com vaga para ${med.nome}:` });
        setQr(dias.map((x) => fmtDataMedia(x)));
        d.dataISO = undefined;
        setBusy(false);
        return;
      }
      const st = dayStatus(med, iso, s().ags, s().freed, s().extra);
      if (st === "sem") {
        setThinking(false);
        push({ role: "ai", text: `${med.nome} não atende nesse dia (${fmtDataLonga(iso)}). ${med.jornadas.length ? `Dias de atendimento: ${[...new Set(med.jornadas.map((j) => DIA_LONGO[j.dia]))].join(", ")}.` : ""}` });
        setQr(["Ver dias com vagas", "Amanhã"]);
        setBusy(false);
        return;
      }
      if (st === "passado") {
        setThinking(false);
        push({ role: "ai", text: "Esse dia já passou 😅 — escolha uma data a partir de hoje." });
        setQr(["Hoje", "Amanhã", "Ver dias com vagas"]);
        setBusy(false);
        return;
      }
      push({ role: "tool", text: `consultar_disponibilidade → ${st === "cheio" ? "0 livres · dia lotado" : "horários retornados"}`, toolName: "consultar_disponibilidade", toolArgs: `{ "medico_id": ${med.id}, "data": "${iso}" }` });
      await wait(560);
      setThinking(false);
      if (st === "cheio") {
        push({ role: "ai", text: `${fmtDataLonga(iso)} está completamente lotado para ${med.nome}. Posso te colocar na fila de espera: se alguém cancelar, o sistema te avisa na hora e você tem 1 hora para confirmar. Quer entrar?` });
        d.dataISO = iso;
        d.step = "fila";
        setQr(["Entrar na fila de espera", "Ver outro dia"]);
      } else {
        const lv = livres(med, iso);
        d.dataISO = iso;
        d.step = "time";
        push({ role: "ai", text: `Para ${fmtDataLonga(iso)}, ${med.nome} tem estes horários: ${lv.slice(0, 6).join(", ")}${lv.length > 6 ? "…" : ""}. Qual prefere?` });
        setQr([...lv.slice(0, 4), "Manhã", "Tarde"]);
      }
      setBusy(false);
      return;
    }

    if (d.step === "time" || d.step === "fila") {
      const med = medicoDe(d.medicoId)!;
      const iso = d.dataISO!;
      if (d.step === "fila" || /fila/.test(txt)) {
        if (/entrar|sim|quero|aceito|pode/.test(txt) || d.step === "fila") {
          dispatch({ t: "joinFila", medicoId: med.id, dataISO: iso, paciente: "Maria Aparecida", voce: true });
          const pos = s().fila.filter((f) => f.medicoId === med.id && f.dataISO === iso && (f.status === "AGUARDANDO" || f.status === "NOTIFICADO")).length + 1;
          push({ role: "tool", text: `inserir_fila_espera → OK · posição ${pos}`, toolName: "inserir_fila_espera", toolArgs: `{ "paciente_id": 1, "medico_id": ${med.id}, "data_desejada": "${iso}" }` });
          await wait(560);
          setThinking(false);
          push({ role: "ai", text: `Você é a ${pos}ª na fila de ${fmtDataMedia(iso)} com ${med.nome}. Assim que abrir uma vaga, o app te notifica — e você tem 60 minutos para confirmar, combinado?` });
          setQr(["Como está a fila?", "Obrigada!"]);
          draft.current = { step: "idle" };
          setBusy(false);
          return;
        }
      }
      let hora = parseHora(raw);
      if (!hora) {
        if (/manha/.test(txt)) hora = livres(med, iso).find((h) => +h.slice(0, 2) < 12) ?? null;
        else if (/tarde/.test(txt)) hora = livres(med, iso).find((h) => +h.slice(0, 2) >= 12) ?? null;
      }
      if (!hora || !livres(med, iso).includes(hora)) {
        const lv = livres(med, iso);
        const suger = hora ? lv.filter((h) => h > hora).slice(0, 3) : lv.slice(0, 4);
        setThinking(false);
        push({ role: "ai", text: hora
          ? `${hora} já foi preenchido 😕 — os livres mais próximos são: ${suger.join(", ")}.`
          : `Não achei esse horário. Livres: ${lv.slice(0, 5).join(", ")}.` });
        setQr(suger.length ? suger : ["Ver outro dia"]);
        if (!suger.length) d.step = "date";
        setBusy(false);
        return;
      }
      d.hora = hora;
      d.step = "payment";
      setThinking(false);
      push({ role: "ai", text: `Ótimo, ${hora} em ${fmtDataMedia(iso)}! Como você prefere pagar? Particular sai por ${fmtBRL(med.valor)}.` });
      setQr(["Convênio", `Particular (${fmtBRL(med.valor)})`]);
      setBusy(false);
      return;
    }

    if (d.step === "payment") {
      const med = medicoDe(d.medicoId)!;
      if (/convenio|carteirinha|plano/.test(txt)) {
        d.step = "card";
        setThinking(false);
        push({ role: "ai", text: "Perfeito! Me diga o número da sua carteirinha do convênio." });
        setQr(["0042 8871 3345 09"]);
        setBusy(false);
        return;
      }
      setThinking(false);
      await agendar(med, d.dataISO!, d.hora!, "PARTICULAR");
      setBusy(false);
      return;
    }

    if (d.step === "card") {
      const med = medicoDe(d.medicoId)!;
      const digitos = raw.replace(/\D/g, "");
      if (digitos.length < 8) {
        setThinking(false);
        push({ role: "ai", text: "Hmm, esse número parece curto demais. Confere a carteirinha? São pelo menos 8 dígitos." });
        setQr(["0042 8871 3345 09"]);
        setBusy(false);
        return;
      }
      setThinking(false);
      await agendar(med, d.dataISO!, d.hora!, "CONVENIO", digitos.replace(/(\d{4})(?=\d)/g, "$1 ").trim());
      setBusy(false);
      return;
    }

    /* ---------- intenções globais ---------- */
    const cancelarIntent = /cancel|desmarc/.test(txt);
    const remarcarIntent = /remarc/.test(txt);
    if (cancelarIntent || remarcarIntent) {
      const ag = proximaDeMaria();
      setThinking(false);
      if (!ag) {
        push({ role: "ai", text: "Você não tem consultas futuras agendadas. Quer marcar uma agora?" });
        setQr(["Quero marcar uma consulta"]);
      } else {
        await cancelar(ag, remarcarIntent);
      }
      setBusy(false);
      return;
    }

    if (/minhas consultas|meus agendamentos/.test(txt)) {
      setThinking(false);
      const futuras = s().ags.filter((a) => a.voce && a.status === "AGENDADO").sort((a, b) => `${a.dataISO}${a.hora}`.localeCompare(`${b.dataISO}${b.hora}`));
      if (!futuras.length) push({ role: "ai", text: "Nenhuma consulta futura. A aba “Consultas” mostra seu histórico completo. Quer agendar?" });
      else push({ role: "ai", text: futuras.map((a) => `• ${fmtDataMedia(a.dataISO)} às ${a.hora} — ${medicoDe(a.medicoId)?.nome} (${a.status === "AGENDADO" ? "confirmada" : a.status})`).join("\n") + "\n\nQuer mexer em alguma?" });
      setQr(["Cancelar uma consulta", "Remarcar", "Marcar nova"]);
      setBusy(false);
      return;
    }

    if (/fila/.test(txt)) {
      setThinking(false);
      const minhas = s().fila.filter((f) => f.voce && (f.status === "AGUARDANDO" || f.status === "NOTIFICADO"));
      if (!minhas.length) {
        push({ role: "ai", text: "Você não está em nenhuma fila de espera no momento. Se um dia estiver lotado, eu te ofereço a fila na hora. 😉" });
        setQr(["Quero marcar uma consulta"]);
      } else {
        push({
          role: "tool",
          text: `consultar_fila → ${minhas.length} inscrição(ões) ativa(s)`,
          toolName: "consultar_fila",
          toolArgs: `{ "paciente_id": 1 }`,
        });
        await wait(520);
        push({
          role: "ai",
          text: minhas.map((f) => `• ${fmtDataMedia(f.dataISO)} com ${medicoDe(f.medicoId)?.nome} — posição ${f.posicao}ª (${f.status === "NOTIFICADO" ? `vaga oferecida! restam ${f.janelaRestante} min` : "aguardando"})`).join("\n") +
            "\n\nLembrando: só o 1º colocado é notificado, e a janela de confirmação é de 60 minutos.",
        });
        setQr(["Obrigada!", "Cancelar minha inscrição"]);
      }
      setBusy(false);
      return;
    }

    const esp = detectaEsp(txt);
    const medNome = detectaMedico(txt);
    const querAgendar = /agend|marcar|marca|consulta nova|quero (uma )?consulta/.test(txt);
    const querHorarios = /horario|disponib|vaga|quando.*atende/.test(txt);

    if (querAgendar || querHorarios || esp || medNome) {
      const med = medNome ?? (esp ? s().medicos.find((m) => m.espId === esp) : undefined);
      if (!med) {
        setThinking(false);
        push({ role: "ai", text: "Temos: Cardiologia, Clínica Geral, Odontologia, Ortopedia, Dermatologia e Pediatria. Qual especialidade você procura?" });
        setQr(["Cardiologia", "Ortopedia", "Clínica Geral", "Odontologia"]);
        setBusy(false);
        return;
      }
      const iso = parseData(raw);
      push({ role: "tool", text: `consultar_disponibilidade → ok`, toolName: "consultar_disponibilidade", toolArgs: `{ "medico_id": ${med.id}${iso ? `, "data": "${iso}"` : ""} }` });
      await wait(560);
      setThinking(false);
      if (iso) {
        const st = dayStatus(med, iso, s().ags, s().freed, s().extra);
        if (st === "cheio") {
          draft.current = { medicoId: med.id, dataISO: iso, step: "fila" };
          push({ role: "ai", text: `${fmtDataLonga(iso)} está lotado para ${med.nome}. Quer entrar na fila de espera? Se abrir vaga, você é avisada na hora (janela de 1h para confirmar).` });
          setQr(["Entrar na fila de espera", "Ver outro dia"]);
        } else if (st === "sem") {
          draft.current = { medicoId: med.id, step: "date" };
          push({ role: "ai", text: `${med.nome} não atende em ${fmtDataLonga(iso)}. Quer ver os próximos dias com vaga?` });
          setQr(["Ver dias com vagas"]);
        } else {
          const lv = livres(med, iso);
          draft.current = { medicoId: med.id, dataISO: iso, step: "time" };
          push({ role: "ai", text: `${med.nome} tem horários livres em ${fmtDataLonga(iso)}: ${lv.slice(0, 6).join(", ")}${lv.length > 6 ? "…" : ""}.` });
          setQr([...lv.slice(0, 4), "Ver outro dia"]);
        }
      } else if (querHorarios && !querAgendar) {
        const dias: string[] = [];
        for (let i = 0; i <= 13 && dias.length < 3; i++) {
          const cand = addDaysISO(HOJE, i);
          if (dayStatus(med, cand, s().ags, s().freed, s().extra) === "livre") dias.push(cand);
        }
        push({ role: "ai", text: `Próximos dias com agenda aberta para ${med.nome}: ${dias.map((x) => fmtDataMedia(x)).join(" · ")}. Quer agendar em algum?` });
        draft.current = { medicoId: med.id, step: "date" };
        setQr([...dias.map((x) => fmtDataMedia(x)), "Ver dias com vagas"]);
      } else {
        draft.current = { medicoId: med.id, step: "date" };
        const ex = fromISO(addDaysISO(HOJE, 2));
        push({ role: "ai", text: `Claro! Para qual dia você quer agendar com ${med.nome}? Pode falar “amanhã”, um dia da semana ou a data (ex.: ${pad(ex.getDate())}/${pad(ex.getMonth() + 1)}).` });
        setQr(["Hoje", "Amanhã", "Ver dias com vagas"]);
      }
      setBusy(false);
      return;
    }

    if (/obrigad|valeu|otimo|perfeito/.test(txt)) {
      setThinking(false);
      push({ role: "ai", text: "Eu que agradeço! 💚 Estou aqui 24h — é só chamar. Cuide-se bem, Maria!" });
      setQr(["Quero marcar uma consulta", "Minhas consultas"]);
      setBusy(false);
      return;
    }

    setThinking(false);
    push({ role: "ai", text: "Posso ajudar com agendamentos, horários, cancelamentos e fila de espera. Me conta: qual especialidade você procura, ou diga “minhas consultas”." });
    setQr(["Quero marcar uma consulta", "Minhas consultas", "Como está a fila?"]);
    setBusy(false);
  };

  const send = (text: string) => {
    if (busy || !text.trim()) return;
    push({ role: "user", text });
    setInput("");
    responder(text);
  };

  return (
    <div className="flex h-full flex-col bg-cream">
      {/* header */}
      <div className="flex items-center gap-2.5 border-b border-line bg-paper px-3.5 py-2.5">
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
              <p className="max-w-[82%] rounded-2xl rounded-br-sm bg-jade px-3.5 py-2 text-[13px] leading-snug text-paper shadow-sm">{m.text}</p>
            </div>
          ) : (
            <div key={m.id} className="pop-in flex items-end gap-1.5">
              <div className="mb-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-pine text-mint">
                <IcSpark className="h-3.5 w-3.5" />
              </div>
              <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-bl-sm border border-line bg-paper px-3.5 py-2 text-[13px] leading-snug shadow-sm">{m.id > 1 ? <Typewriter text={m.text} /> : m.text}</p>
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
            className="shrink-0 rounded-full border border-jade/40 bg-jadesoft px-3 py-1.5 text-[11.5px] font-bold text-jadedark transition-all hover:-translate-y-0.5 hover:bg-jade hover:text-paper disabled:opacity-50">
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
          className="min-w-0 flex-1 rounded-xl border border-line bg-cream px-3.5 py-2.5 text-[13px] outline-none transition-colors placeholder:text-ink/35 focus:border-jade"
        />
        <button type="submit" disabled={busy} aria-label="Enviar"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pine text-mint transition-all hover:scale-105 hover:bg-jade disabled:opacity-50">
          <IcSend className="h-4.5 w-4.5" />
        </button>
      </form>
    </div>
  );
}
