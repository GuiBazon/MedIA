# FácilMed — Instruções do Projeto (resumo)

## O que é
Protótipo demonstrativo do **FácilMed**: sistema de agendamento para clínicas multiprofissionais com **secretária virtual de IA** (simulando Ollama/Llama 3 local), **fila de espera inteligente**, **acessibilidade** (Modo Simplificado, Modo Voz, offline) e painéis para médico e gestão.

> Tudo roda **100% no navegador** — sem backend real. Os dados vivem em um store React (useReducer) que espelha o schema MySQL do projeto.

## Como rodar
```bash
npm install
npm run dev      # desenvolvimento
npm run build    # produção (gera dist/)
```

## Estrutura (src/)
| Arquivo | O que faz |
|---|---|
| `data.ts` | Modelo de dados, médicos, jornadas, seeds, regras de ocupação (hash determinístico), helpers de data |
| `store.tsx` | Estado global + todas as ações (agendar, cancelar, fila, notificações, filas com janela de 60 min) |
| `components/Chat.tsx` | **Cérebro da IA (Lia)**: parse de intenções, datas, horários, ferramentas e fluxos |
| `components/PhoneApp.tsx` | App do paciente no smartphone (wizard, calendário, relatórios, Modo Simplificado) |
| `components/AiConsole.tsx` | Central de IA em tela cheia + log de tool calls |
| `components/FloatingLia.tsx` | Botão flutuante global da Lia |
| `components/DoctorPanel.tsx` | Painel do médico (agenda + prontuário) |
| `components/AdminPanel.tsx` | Gestão (ocupação, jornadas, fila RN02 com simulador) |
| `components/AcessibilidadeSection.tsx` | Modo Voz (Web Speech), Modo Offline, Responsável |
| `components/AutomacaoSection.tsx` | Secretaria: confirmações, bloqueio de médico, "o que levar", retorno, absenteísmo, auditoria |
| `components/RulesSection.tsx` | RN01 / RN02 / RN03 com diagramas |
| `components/PitchSection.tsx` | Pitch SENAI + schema.sql / tools.json / system.txt |

## Regras de negócio
- **RN01 — Trava de 30 min:** cancelar/remarcar só com 30+ min de antecedência (IA e app bloqueiam e mandam ligar para a recepção).
- **RN02 — Fila sequencial:** vaga cancelada → **só o 1º da fila** é notificado → janela de **60 min** (demo: 1s = 1min) → expira → próximo.
- **RN03 — Conflito de horários:** horário já ocupado nunca é confirmado; o wizard simula uma corrida transacional no 1º horário livre.

## Onde testar cada coisa
1. **Agendar:** telefone → aba Início → "Agendar" (ou fale com a Lia: "quero marcar cardiologia amanhã de manhã").
2. **IA faz tudo:** botão flutuante verde → chips prontos ou texto livre.
3. **Fila RN02:** aba Gestão → "Simular desistência" → veja a notificação no celular e confirme a vaga.
4. **Dia lotado (RN02):** Dr. Otávio tem dias propositalmente lotados → tente agendar → a Lia oferece a fila.
5. **RN01:** a consulta de encaixe da Maria está a ~12 min → tente cancelar (app ou IA).
6. **Modo Simplificado:** telefone → aba Perfil.
7. **Modo Voz:** seção Acessibilidade → botão de microfone (use Chrome).
8. **Modo Offline:** seção Acessibilidade → chave "Online/Offline".

## Convenções importantes
- Ocupação de horários é **determinística por hash** (`medico|data|hora`): o mesmo horário é sempre ocupado/livre entre reloads.
- O paciente demo é **Maria Aparecida** (convênio Vida+); responsável: **João Pedro Almeida**.
- A IA valida TUDO como se fosse a API: permissões, RN01, RN02 e RN03 — peça o impossível e ela explica o motivo.
