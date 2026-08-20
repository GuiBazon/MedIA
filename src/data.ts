/* ============================================================
   FácilMed · modelo de dados + motor determinístico de agenda
   (espelha o schema MySQL do projeto: usuarios, medicos,
    horarios_medico, agendamentos, fila_espera)
   ============================================================ */

export type DiaSemana = "SEG" | "TER" | "QUA" | "QUI" | "SEX" | "SAB";
export const DIAS_SEMANA: DiaSemana[] = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
export const DIA_LONGO: Record<DiaSemana, string> = {
  SEG: "Segunda", TER: "Terça", QUA: "Quarta", QUI: "Quinta", SEX: "Sexta", SAB: "Sábado",
};

export interface Jornada { dia: DiaSemana; inicio: string; fim: string; duracao: number }
export interface Especialidade { id: number; nome: string; cor: string; desc: string }
export interface Medico { id: number; nome: string; crm: string; espId: number; valor: number; jornadas: Jornada[] }

export type TipoPag = "CONVENIO" | "PARTICULAR";
export type StatusAg = "AGENDADO" | "CONCLUIDO" | "CANCELADO" | "NAO_COMPARECEU";
export interface Relatorio { titulo: string; texto: string; emissao: string }
export interface Agendamento {
  id: number; paciente: string; voce?: boolean; medicoId: number; dataISO: string; hora: string;
  tipo: TipoPag; carteirinha?: string; status: StatusAg; protocolo: string;
  anotacoes?: string; encaixe?: boolean; relatorio?: Relatorio;
}

export type FilaStatus = "AGUARDANDO" | "NOTIFICADO" | "EXPIRADO" | "CONFIRMADO";
export interface FilaEntry {
  id: number; paciente: string; voce?: boolean; medicoId: number; dataISO: string;
  posicao: number; status: FilaStatus; janelaRestante?: number; vagaKey?: string;
}

export interface Notif {
  id: number; titulo: string; texto: string; tipo: "vaga" | "lembrete" | "info" | "alerta";
  lida: boolean; waitId?: number;
}
export interface ToastMsg { id: number; texto: string; tom: "ok" | "erro" | "info" }

/* ---------------- datas ---------------- */
export const pad = (n: number) => String(n).padStart(2, "0");
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
};
export const addDaysISO = (iso: string, n: number) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const HOJE = toISO(new Date());
const MAPA_DIA: Record<number, DiaSemana | null> = { 0: null, 1: "SEG", 2: "TER", 3: "QUA", 4: "QUI", 5: "SEX", 6: "SAB" };
export const diaSemanaDe = (iso: string): DiaSemana | null => MAPA_DIA[fromISO(iso).getDay()];

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const DIAS_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const DIAS_LONGO_D = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export const fmtDataLonga = (iso: string) => {
  const d = fromISO(iso);
  return `${DIAS_LONGO_D[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
};
export const fmtDataMedia = (iso: string) => {
  const d = fromISO(iso);
  return `${DIAS_CURTO[d.getDay()]}, ${d.getDate()} ${MESES_CURTO[d.getMonth()]}`;
};
export const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const minutesUntil = (dataISO: string, hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  const alvo = fromISO(dataISO);
  alvo.setHours(h, m, 0, 0);
  return Math.round((alvo.getTime() - Date.now()) / 60000);
};
export const MIN_CANCEL = 30;

/* ---------------- hash determinístico ---------------- */
export const hashStr = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};
export const slotKey = (medicoId: number, dataISO: string, hora: string) => `${medicoId}|${dataISO}|${hora}`;

/* ---------------- especialidades / médicos ---------------- */
export const ESPECIALIDADES: Especialidade[] = [
  { id: 1, nome: "Cardiologia", cor: "#e5484d", desc: "Coração e circulação" },
  { id: 2, nome: "Clínica Geral", cor: "#0c8a64", desc: "Check-up e rotina" },
  { id: 3, nome: "Odontologia", cor: "#4c86c6", desc: "Saúde bucal" },
  { id: 4, nome: "Ortopedia", cor: "#f0a32f", desc: "Ossos e articulações" },
  { id: 5, nome: "Dermatologia", cor: "#d97ba6", desc: "Pele, cabelo e unhas" },
  { id: 6, nome: "Pediatria", cor: "#e8843c", desc: "Crianças e adolescentes" },
];

const j = (dias: DiaSemana[], inicio: string, fim: string, duracao = 30): Jornada[] =>
  dias.map((dia) => ({ dia, inicio, fim, duracao }));

export const MEDICOS_SEED: Medico[] = [
  { id: 1, nome: "Dra. Helena Duarte", crm: "CRM-SP 128.443", espId: 1, valor: 320, jornadas: j(["SEG", "TER", "QUA", "QUI", "SEX"], "08:00", "13:00") },
  { id: 2, nome: "Dra. Beatriz Nogueira", crm: "CRM-SP 97.210", espId: 2, valor: 220, jornadas: j(["SEG", "TER", "QUA", "QUI", "SEX"], "13:00", "18:00") },
  { id: 3, nome: "Dra. Camila Fontes", crm: "CRO-SP 44.812", espId: 3, valor: 180, jornadas: j(["SEG", "TER", "QUA", "QUI", "SEX"], "09:00", "17:00", 45) },
  { id: 4, nome: "Dr. Otávio Sampaio", crm: "CRM-SP 71.556", espId: 4, valor: 280, jornadas: j(["SEG", "TER", "QUA", "QUI", "SEX", "SAB"], "08:00", "12:00") },
  { id: 5, nome: "Dr. Ricardo Teles", crm: "CRM-SP 154.902", espId: 5, valor: 260, jornadas: j(["SEG", "QUA", "SEX"], "14:00", "19:00") },
  { id: 6, nome: "Dra. Paula Serrano", crm: "CRM-SP 88.137", espId: 6, valor: 240, jornadas: [...j(["TER", "QUA", "QUI", "SEX"], "08:00", "14:00"), ...j(["SAB"], "08:00", "11:00")] },
];

/* ---------------- horários / ocupação ---------------- */
export const slotsDoDia = (med: Medico, iso: string): string[] => {
  const dia = diaSemanaDe(iso);
  if (!dia) return [];
  const jor = med.jornadas.find((x) => x.dia === dia);
  if (!jor) return [];
  const [hi, mi] = jor.inicio.split(":").map(Number);
  const [hf, mf] = jor.fim.split(":").map(Number);
  const out: string[] = [];
  for (let t = hi * 60 + mi; t + jor.duracao <= hf * 60 + mf; t += jor.duracao) {
    out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return out;
};

/* dias propositalmente lotados (Dr. Otávio) para demonstrar fila de espera */
const buildFullDays = () => {
  const s = new Set<string>();
  let d = 1, found = 0;
  while (found < 2 && d < 21) {
    const iso = addDaysISO(HOJE, d);
    if (diaSemanaDe(iso)) { s.add(`4|${iso}`); found++; }
    d++;
  }
  return s;
};
export const FULL_DAYS = buildFullDays();
export const firstFullDate = () => {
  for (const k of FULL_DAYS) return k.split("|")[1];
  return addDaysISO(HOJE, 3);
};

export const isBusyExterno = (medicoId: number, iso: string, hora: string, freed: string[], extra: string[]) => {
  const k = slotKey(medicoId, iso, hora);
  if (freed.includes(k)) return false;
  if (extra.includes(k)) return true;
  if (FULL_DAYS.has(`${medicoId}|${iso}`)) return true;
  return hashStr(k) % 10 < 4;
};

export type DayStatus = "passado" | "sem" | "cheio" | "livre";
export const dayStatus = (med: Medico, iso: string, ags: Agendamento[], freed: string[], extra: string[]): DayStatus => {
  if (iso < HOJE) return "passado";
  const slots = slotsDoDia(med, iso);
  if (!slots.length) return "sem";
  const all = slots.every(
    (h) =>
      ags.some((a) => a.medicoId === med.id && a.dataISO === iso && a.hora === h && a.status === "AGENDADO") ||
      isBusyExterno(med.id, iso, h, freed, extra),
  );
  return all ? "cheio" : "livre";
};

export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/* ---------------- seeds relativas a HOJE ---------------- */
const proximaJornada = (med: Medico, minOffset: number): string => {
  for (let i = minOffset; i < minOffset + 14; i++) {
    const iso = addDaysISO(HOJE, i);
    if (diaSemanaDe(iso) && med.jornadas.some((x) => x.dia === diaSemanaDe(iso))) return iso;
  }
  return addDaysISO(HOJE, minOffset);
};

export const buildSeeds = () => {
  const helena = MEDICOS_SEED[0];
  const otavio = MEDICOS_SEED[3];

  const dEnc = new Date(Date.now() + 12 * 60000);
  const horaEncaixe = `${pad(dEnc.getHours())}:${pad(dEnc.getMinutes())}`;
  const dataEncaixe = toISO(dEnc);

  const dataOrto = proximaJornada(otavio, 4);
  const fullDate = firstFullDate();

  const ags: Agendamento[] = [
    { id: 1, paciente: "Maria Aparecida", voce: true, medicoId: 1, dataISO: dataEncaixe, hora: horaEncaixe, tipo: "CONVENIO", carteirinha: "0042 8871 3345 09", status: "AGENDADO", protocolo: "FM-8H3K2", encaixe: true },
    { id: 2, paciente: "Maria Aparecida", voce: true, medicoId: 4, dataISO: dataOrto, hora: "09:30", tipo: "PARTICULAR", status: "AGENDADO", protocolo: "FM-2QX9B" },
    {
      id: 3, paciente: "Maria Aparecida", voce: true, medicoId: 2, dataISO: addDaysISO(HOJE, -12), hora: "14:00", tipo: "CONVENIO",
      carteirinha: "0042 8871 3345 09", status: "CONCLUIDO", protocolo: "FM-7T1LD",
      relatorio: {
        titulo: "Hemograma + Glicemia em jejum",
        texto: "Paciente sem queixas agudas. PA 118/76 mmHg, FC 72 bpm. Hemograma dentro da referência; glicemia de jejum 91 mg/dL. Orientada hidratação e caminhada 30 min/dia. Retorno em 6 meses ou antes, se sintomas.",
        emissao: fmtDataLonga(addDaysISO(HOJE, -12)),
      },
    },
    { id: 4, paciente: "Maria Aparecida", voce: true, medicoId: 3, dataISO: addDaysISO(HOJE, -38), hora: "10:30", tipo: "PARTICULAR", status: "NAO_COMPARECEU", protocolo: "FM-9C4PP" },
    { id: 5, paciente: "João Pereira", medicoId: 1, dataISO: HOJE, hora: "08:30", tipo: "CONVENIO", carteirinha: "8811 2093 7741 02", status: "CONCLUIDO", protocolo: "FM-3ZM8A", anotacoes: "Hipertensão controlada. PA 124/82. Mantido losartana 50mg. ECG sem alterações." },
    { id: 6, paciente: "Ana Beatriz Souza", medicoId: 1, dataISO: HOJE, hora: "10:00", tipo: "CONVENIO", carteirinha: "5530 1187 2296 11", status: "AGENDADO", protocolo: "FM-6K2RE" },
    { id: 7, paciente: "Pedro Lima", medicoId: 1, dataISO: HOJE, hora: "11:30", tipo: "PARTICULAR", status: "AGENDADO", protocolo: "FM-1B7WX" },
    { id: 8, paciente: "Tereza Costa", medicoId: 1, dataISO: proximaJornada(helena, 1), hora: "08:30", tipo: "CONVENIO", carteirinha: "9024 6651 0038 77", status: "AGENDADO", protocolo: "FM-4D9QT" },
  ];

  const fila: FilaEntry[] = [
    { id: 1, paciente: "Carlos Menezes", medicoId: 4, dataISO: fullDate, posicao: 1, status: "AGUARDANDO" },
    { id: 2, paciente: "Maria Aparecida", voce: true, medicoId: 4, dataISO: fullDate, posicao: 2, status: "AGUARDANDO" },
    { id: 3, paciente: "José Ferreira", medicoId: 4, dataISO: fullDate, posicao: 3, status: "AGUARDANDO" },
    { id: 4, paciente: "Rafael Duarte", medicoId: 4, dataISO: dataOrto, posicao: 1, status: "AGUARDANDO" },
  ];

  const notifs: Notif[] = [
    { id: 1, titulo: "Consulta hoje", texto: `Sua consulta com ${helena.nome} é hoje às ${horaEncaixe} (encaixe). Chegue 10 minutos antes.`, tipo: "lembrete", lida: false },
    { id: 2, titulo: "Relatório disponível", texto: "Dra. Beatriz Nogueira disponibilizou o relatório “Hemograma + Glicemia em jejum”.", tipo: "info", lida: false },
  ];

  return { ags, fila, notifs };
};

export const PACIENTE_DEMO = { nome: "Maria Aparecida", cpf: "***.482.917-**", plano: "Convênio Vida+", inicial: "MA" };

/* orientações "o que levar" por especialidade (configuradas pela secretaria) */
export const ORIENTACOES: Record<number, string[]> = {
  1: ["Jejum de 8h se houver coleta de exames", "Traga exames anteriores (ECG, eco, holter)", "Use roupas confortáveis", "Chegue 10 min antes para aferir a pressão"],
  2: ["Jejum de 8h apenas se houver coleta de sangue", "Traga a lista de medicamentos em uso", "Documento com foto e carteirinha do convênio"],
  3: ["Escove os dentes normalmente antes da consulta", "Traga radiografias anteriores, se tiver", "Evite alimentos com corantes 2h antes"],
  4: ["Traga exames de imagem (raio-X, ressonância)", "Use roupas que facilitem a movimentação", "Anote onde dói e desde quando"],
  5: ["Não use maquiagem na área a ser avaliada", "Evite cremes e ácidos na noite anterior", "Traga a lista de medicamentos em uso"],
  6: ["Traga a caderneta de vacinação", "Anote sintomas, febre e medicações usadas", "A criança deve vir acompanhada do responsável"],
};

export const RESPONSAVEL_SEED = {
  nome: "Ana Aparecida",
  parentesco: "filha",
  telefone: "(11) 98877-1024",
  permissoes: [
    { acao: "Visualizar consultas", ok: true },
    { acao: "Receber lembretes", ok: true },
    { acao: "Confirmar presença", ok: true },
    { acao: "Reagendar", ok: false },
    { acao: "Cancelar", ok: false },
  ],
};

export const FUNCIONAMENTO = "segunda a sexta, 7h às 19h · sábado, 7h às 13h";
export const ENDERECO_CLINICA = "Rua das Figueiras, 245 — Centro (ao lado da Farmácia São Lucas)";
export const TEL_CLINICA = "(11) 4002-8922";
