<div align="center">

# 🩺 AcolheMed

**Sistema Inteligente e Acessível de Agendamento de Consultas**

Secretária virtual com IA local · Fila de espera inteligente · Acessibilidade radical · Painéis médico e de gestão

`SENAI — Projeto Integrador` · `Protótipo demonstrativo 100% funcional`

</div>

---

## 🎯 O problema

Clínicas multiprofissionais sofrem com **linhas telefônicas ocupadas**, **recepção sobrecarregada**, **no-show de até 30%** e **filas de espera estáticas** que não recuperam horários cancelados. Idosos e pessoas com deficiência ficam de fora da saúde digital por interfaces inacessíveis.

## 💡 A solução

O **AcolheMed** une três forças:

1. **Uma secretária virtual que *faz*, não só conversa** — a agente **Lia** entende linguagem natural e executa ações reais via *Tool Calling* (agendar, remarcar, cancelar, confirmar, fila, orientações), sempre validadas pelas regras de negócio.
2. **Uma fila de espera viva** — cada cancelamento notifica o 1º colocado, com janela de 60 minutos e repasse automático.
3. **Acessibilidade de verdade** — Modo Simplificado (terceira idade), Modo Voz (pessoas cegas, com reconhecimento de fala e TTS reais do navegador), modo offline e perfil de responsável autorizado.

> 🔒 **Privacidade por arquitetura:** a IA roda *localmente* (simulando Ollama + Llama 3 no servidor da clínica) — nenhum dado de saúde sai do prédio.

---

## ✨ Funcionalidades por perfil

| Perfil | O que tem no protótipo |
|---|---|
| 👤 **Paciente** | Fluxo visual de agendamento (especialidade → médico → calendário com semáforo → horários → convênio/particular → comprovante com QR), consultas futuras/passadas, relatórios médicos, notificações com ação, Modo Simplificado alternável |
| 🤖 **Lia (IA)** | 10 tools (`agendar_consulta`, `cancelar_consulta`, `reagendar_consulta`, `confirmar_consulta`, `buscar_horarios`, `buscar_consulta`, `buscar_orientacoes`, `buscar_responsavel`, `inserir_fila_espera`, `consultar_fila`), datas/horários flexíveis, sugestões automáticas, trava RN01, fallback acolhedor |
| 🧑‍⚕️ **Médico** | Agenda semanal/diária sincronizada com o app, prontuário simplificado com evolução salvável, status de comparecimento |
| 🏥 **Gestão/Secretaria** | Ocupação ao vivo, jornadas editáveis por médico/dia, cadastro de médicos, **fila RN02 com simulador de desistência**, confirmações com contato rápido, bloqueio de médico com pacientes afetados, "o que levar" por especialidade, retorno automático, absenteísmo e auditoria |
| 🤝 **Responsável** | Acompanhamento com permissões granulares validadas pela API |
| 🙈 **Acessibilidade** | Modo Voz (STT pt-BR + TTS via Web Speech API), tela única centrada na IA, confirmações obrigatórias em ações críticas, modo offline com bloqueios explicados |

---

## 📏 Regras de negócio implementadas

| Regra | Comportamento | Onde testar |
|---|---|---|
| **RN01** · Trava de cancelamento tardio | Cancelar/remarcar exige ≥ 30 min de antecedência; abaixo disso, bloqueia e orienta contato humano | A consulta de encaixe da Maria (~12 min) no app ou via Lia |
| **RN02** · Fila de espera sequencial | Vaga aberta → só o 1º é notificado → janela de 60 min (demo: 1s = 1 min) → expira → repassa | Gestão → "Simular desistência"; Dr. Otávio tem dias propositalmente lotados |
| **RN03** · Prevenção de conflito | Horário ocupado nunca é confirmado; corrida transacional simulada no 1º horário livre do wizard | Agende pelo fluxo visual e veja o aviso |

---

## 🚀 Como rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # gera dist/
```

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS v4 · Web Speech API · (especificação de backend: Node.js + Express + MySQL 8 + Ollama)

---

## 🗂 Estrutura do código

```
src/
├── data.ts                     # modelo de dados, seeds, ocupação determinística (hash)
├── store.tsx                   # estado global + ações (RN02, notificações, fila)
├── App.tsx                     # composição da página + toasts + rodapé
└── components/
    ├── Chat.tsx                # cérebro da Lia: intenções, parsers, tools, fluxos
    ├── PhoneApp.tsx            # app do paciente dentro do smartphone
    ├── AiConsole.tsx           # Central de IA + log de tool calls ao vivo
    ├── FloatingLia.tsx         # botão flutuante global
    ├── DoctorPanel.tsx         # painel do médico
    ├── AdminPanel.tsx          # gestão + fila RN02
    ├── AcessibilidadeSection.tsx   # voz, offline, responsável
    ├── AutomacaoSection.tsx    # secretaria & automação
    ├── RulesSection.tsx        # RN01/RN02/RN03 com diagramas
    ├── PitchSection.tsx        # pitch + schema.sql / tools.json / system.txt
    ├── icons.tsx · ui.tsx      # ícones SVG autorais e utilitários de movimento
```

---

## 🧪 Roteiro rápido de demonstração (3 minutos)

1. **Agende com uma frase** → clique no botão verde da Lia → *"quero marcar cardiologia amanhã de manhã pelo convênio"*.
2. **Veja a regra barrar** → *"quero cancelar minha consulta"* (a de hoje está a menos de 30 min → RN01).
3. **A fila anda sozinha** → Gestão → "Simular desistência" → notificação no celular → confirme a vaga em 60 s.
4. **Acessibilidade** → seção Acessibilidade → ative o microfone e diga *"qual minha próxima consulta?"* (Chrome).
5. **Modo Simplificado** → aba Perfil no telefone → toque em "Ativar".

---

## 📚 Documentação

- [`instrucoes.md`](./instrucoes.md) — guia resumido do projeto, estrutura e onde testar cada regra.
- O *system prompt* da agente, o `schema.sql` e o `tools.json` estão na seção **Pitch** da página.

---

<div align="center">

**Equipe** · Projeto Integrador SENAI 2026
*Protótipo demonstrativo — todos os dados são fictícios.*

</div>
