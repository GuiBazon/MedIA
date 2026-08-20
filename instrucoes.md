# 📋 AcolheMed — Guia de Instruções, Testes e Especificações

Este documento fornece um guia prático para avaliadores, desenvolvedores e bancas examinadoras explorarem todas as capacidades do protótipo **AcolheMed**.

---

## 🎯 1. Visão Geral da Demonstração

O **AcolheMed** é executado como uma Single Page Application (SPA) reativa e determinística, contendo múltiplos simuladores interconectados por um **store centralizado** que reproduz o comportamento de uma API com banco de dados MySQL e servidor de IA local.

### Características do Ambiente Demonstrativo
- **Execução 100% Client-Side:** Não requer infraestrutura de backend ou chaves de API pagas para a demonstração das 10 ferramentas de IA, fila viva ou acessibilidade.
- **Ocupação Determinística:** O status de disponibilidade de cada horário (`médico | data | hora`) é gerado por algoritmo de hash determinístico, mantendo a consistência dos dados durante a navegação.
- **Voz Nativa:** Utiliza a *Web Speech API* do navegador para reconhecimento contínuo de voz e síntese de áudio humanizada em português (pt-BR).

---

## 🚀 2. Como Executar Localmente

```bash
# 1. Instalação das dependências
npm install

# 2. Execução do servidor local
npm run dev

# 3. Validação de tipagem e build de produção
npm run typecheck
npm run build
```

---

## 🧪 3. Roteiro Prático de Testes por Funcionalidade

### 🟢 Cenário 1: Agendamento Inteligente via Linguagem Natural (Lia)
1. Clique no botão flutuante da **Lia** no canto inferior direito ou navegue até a **Central de IA**.
2. Digite ou fale frases em linguagem natural como:
   - *"Quero marcar uma consulta com cardiologista amanhã de manhã pelo convênio"*
   - *"Tem horário com o Dr. Otávio na próxima quinta?"*
   - *"Quais médicos atendem ortopedia?"*
3. **Comportamento Esperado:** A Lia identifica especialidade, médico, data e turno, executa a *tool* `buscar_horarios`, sugere horários disponíveis e solicita a confirmação dos dados.

---

### 🔴 Cenário 2: Validação da Regra de Negócio RN01 (Trava de 30 Minutos)
1. No smartphone interativo ou na Central de IA, tente cancelar a consulta de encaixe agendada para a paciente **Maria Aparecida** (marcada com menos de 30 min de antecedência).
2. Na conversa com a Lia, digite: *"Quero cancelar minha consulta de hoje"*.
3. **Comportamento Esperado:** O sistema bloqueia a ação automática informando que faltam menos de 30 minutos (protegendo a agenda médica) e fornece imediatamente o telefone de contato da recepção humana.

---

### 🟡 Cenário 3: Fila de Espera Sequencial RN02 & Janela de 60 Minutos
1. Acesse a seção **Painel de Gestão**.
2. Na aba **Fila de Espera**, localize o botão **"Simular Desistência"** e clique nele.
3. **Comportamento Esperado:**
   - O primeiro paciente posicionado na fila recebe uma notificação prioritária no smartphone.
   - Um contador regressivo de **60 minutos** (na demo: 1 segundo = 1 minuto para agilidade) é iniciado.
   - Ao clicar em **"Aceitar Vaga"**, a consulta é gravada na agenda do médico. Se o tempo expirar sem resposta, a vaga é repassada automaticamente ao próximo colocado.

---

### 🔵 Cenário 4: Prevenção de Concorrência Transacional RN03
1. No simulador de smartphone, inicie o fluxo manual de agendamento clicando em **"Agendar"**.
2. Selecione um médico e data que possuam horários livres.
3. Escolha o primeiro horário marcado como prioritário/concorrido.
4. **Comportamento Esperado:** O sistema simula a tentativa de reserva concorrente e demonstra o tratamento com retorno explicativo e sugestão de horários vizinhos livres.

---

### ♿ Cenário 5: Acessibilidade Radical — Modo Voz para Deficientes Visuais
1. Navegue até a seção **Acessibilidade Radical** (`#acessibilidade`).
2. No card do **Modo Voz**, clique no botão **"● Toque e fale"** (recomendado utilizar Google Chrome).
3. Diga em voz alta: *"Qual a minha próxima consulta?"* ou *"Confirmar presença"*.
4. **Comportamento Esperado:** O sistema transcreve a fala em tempo real via STT, identifica a intenção, dispara a tool correspondente e reproduz a resposta em áudio sintetizado (TTS).

---

### 👵 Cenário 6: Modo Simplificado para Terceira Idade
1. No aplicativo dentro do smartphone, acesse a aba **Perfil**.
2. Ative a chave **Modo Simplificado**.
3. **Comportamento Esperado:** Toda a interface adapta seus alvos de toque, remove elementos secundários, eleva o contraste e aumenta o tamanho das fontes.

---

### 📴 Cenário 7: Modo Offline Resiliente
1. Na seção de Acessibilidade, no card **Modo Offline**, alterne a chave para **"Offline"**.
2. Tente navegar pelo aplicativo no telefone.
3. **Comportamento Esperado:** Consultas agendadas, dados de preparo e contatos continuam acessíveis no cache local, enquanto tentativas de novos agendamentos exibem aviso amigável de conexão necessária.

---

## 🏛️ 4. Mapeamento dos Arquivos do Código-Fonte

| Arquivo | Finalidade Principal |
|---|---|
| [`src/data.ts`](file:///C:/Users/46588975805/Documents/repositorios/AcolheMed/src/data.ts) | Modelagem TypeScript, lista de especialidades, corpo clínico, jornadas e hash determinístico. |
| [`src/store.tsx`](file:///C:/Users/46588975805/Documents/repositorios/AcolheMed/src/store.tsx) | Estado global (`useReducer`), controle da fila RN02, notificações em tempo real e persistência local. |
| [`src/components/Chat.tsx`](file:///C:/Users/46588975805/Documents/repositorios/AcolheMed/src/components/Chat.tsx) | Processamento de linguagem natural, interpretador de datas/horários e motor de execução das 10 tools. |
| [`src/components/PhoneApp.tsx`](file:///C:/Users/46588975805/Documents/repositorios/AcolheMed/src/components/PhoneApp.tsx) | Emulador do aplicativo mobile do paciente (fluxos de agendamento, comprovantes, perfil e acessibilidade). |
| [`src/components/AcessibilidadeSection.tsx`](file:///C:/Users/46588975805/Documents/repositorios/AcolheMed/src/components/AcessibilidadeSection.tsx) | Laboratório interativo de voz (Web Speech API), modo offline e permissões de cuidadores/dependentes. |
| [`src/components/AdminPanel.tsx`](file:///C:/Users/46588975805/Documents/repositorios/AcolheMed/src/components/AdminPanel.tsx) | Painel da gestão hospitalar, monitor de absenteísmo e simulador de desistências da fila de espera. |
| [`src/components/DoctorPanel.tsx`](file:///C:/Users/46588975805/Documents/repositorios/AcolheMed/src/components/DoctorPanel.tsx) | Painel do médico com visão de agenda sincronizada e prontuário para evolução clínica. |
| [`src/components/RulesSection.tsx`](file:///C:/Users/46588975805/Documents/repositorios/AcolheMed/src/components/RulesSection.tsx) | Apresentação interativa com diagramas explicativos das regras RN01, RN02 e RN03. |
| [`src/components/PitchSection.tsx`](file:///C:/Users/46588975805/Documents/repositorios/AcolheMed/src/components/PitchSection.tsx) | Pitch institucional, schema SQL de produção, definições de schemas JSON de tools e prompt do sistema. |

---

## 👥 5. Dados da Paciente de Testes (Persona Demo)

- **Nome:** Maria Aparecida da Silva (71 anos)
- **Convênio:** Vida+ Saúde Familiar (Carteirinha: `0042 8871 3345 09`)
- **Responsável Autorizado:** João Pedro Almeida (Filho)
- **Consultas Pré-carregadas:**
  - Cardiologia com Dra. Camila Torres (Encaixe imediato · ideal para testar a trava RN01)
  - Clínica Geral com Dr. Roberto Faria (Confirmada para amanhã)
