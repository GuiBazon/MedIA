# 📋 Plano de Melhorias, Refatorações e Evolução do AcolheMed

Este documento consolida uma análise técnica, clínica e de produto com **21 iniciativas detalhadas** de melhorias, refatorações arquiteturais, novos módulos e expansão de funcionalidades para o ecossistema **AcolheMed**.

---

## 🏗️ 1. Arquitetura, Backend & Dados (Transição para Produção)

### 🔹 1.1. Backend Real & Camada de API (Node.js / Fastify / NestJS)
- [ ] **Migração do Mock State para API RESTful / GraphQL:**
  - Substituir o estado local em memória (`store.tsx`) por uma API Node.js/TypeScript estruturada.
  - Endpoints padronizados para autenticação, consultas, fila de espera, médicos e auditoria.
- [ ] **Banco de Dados Relacional com ORM (PostgreSQL / MySQL + Prisma / Drizzle):**
  - Implementar o schema relacional consolidado no pitch (`pacientes`, `responsaveis`, `medicos`, `agendamentos`, `fila_espera`, `logs_auditoria`).
  - Criação de índices compostos em `(medico_id, data, hora)` e `(paciente_id, status)` para consultas instantâneas.
- [ ] **Garantia de Concorrência Transacional Real (RN03):**
  - Execução de transações `SERIALIZABLE` ou queries com `SELECT ... FOR UPDATE` no banco para garantir que dois pacientes nunca reservem o mesmo slot simultaneamente.

### 🔹 1.2. Processamento Assíncrono & Filas (Redis + BullMQ)
- [ ] **Motor da Fila de Espera (RN02):**
  - Gerenciamento da janela de 60 minutos através de workers assíncronos no Redis (evitando depender do timer do frontend).
  - Notificação automática do 2º colocado caso o 1º expire.
- [ ] **Disparo Automatizado de Lembretes:**
  - Cron jobs agendados para 24h e 2h antes da consulta para coleta de confirmação de presença.

### 🔹 1.3. Segurança, Autenticação & LGPD
- [ ] **Autenticação Segura & Biometria:**
  - JWT com Refresh Tokens em cookies `HttpOnly` + autenticação biométrica (FaceID / TouchID / WebAuthn).
- [ ] **Criptografia de Prontuários e Dados Sensíveis (LGPD / HIPAA):**
  - Criptografia em repouso (AES-256) dos campos de evolução médica e relatórios.
- [ ] **Controle de Acesso Baseado em Papéis (RBAC):**
  - Validação estrita de permissões de dependentes/acompanhantes antes de qualquer operação de cancelamento ou visualização de prontuário.

---

## 🤖 2. Inteligência Artificial & Agente de Voz (Lia)

### 🔹 2.1. Integração com LLM Local (Ollama / vLLM)
- [ ] **Function Calling Estruturado (JSON Schema):**
  - Integração via endpoint real com Ollama rodando Llama 3.3 8B ou Qwen 2.5 7B, usando schema JSON rígido para as 10 tools.
- [ ] **RAG (Retrieval-Augmented Generation) para Dúvidas Clínicas:**
  - Banco vetorial local (ChromaDB / Qdrant) com termos de preparo de exames, convênios aceitos, especialidades e regras da clínica.
- [ ] **Guardrails Médicos de Segurança (NeMo Guardrails):**
  - Regra estrita para nunca emitir diagnósticos conclusivos nem prescrever medicamentos, redirecionando emergências para o SAMU 192.

### 🔹 2.2. Aprimoramento da Experiência de Voz
- [ ] **Detecção de Palavra de Ativação (Hotword Detection - "Ei Lia"):**
  - Permitir iniciar a conversa por voz sem tocar na tela, ideal para pessoas com deficiência visual severa ou motora.
- [ ] **Streaming de Áudio (TTS em Tempo Real):**
  - Síntese de voz com streaming por chunks (áudio começa a tocar antes do texto terminar de ser gerado, reduzindo a latência percebida para < 400ms).

---

## ♿ 3. Acessibilidade & Inclusão (WCAG 2.2 Nível AAA)

- [ ] **Integração com VLibras:**
  - Widget integrado com avatar 3D para tradução automática em Língua Brasileira de Sinais (Libras) para pacientes surdos.
- [ ] **Modo Alto Contraste Personalizável:**
  - Opções de temas de alto contraste (Amarelo no Preto, Branco no Preto, Azul Acessível).
- [ ] **Navegação por Teclado e Foco Acessível:**
  - Focus trap em todos os modais e atalhos rápidos de teclado (`Alt + 1` Início, `Alt + 2` IA, `Alt + 3` Consultas).
- [ ] **Feedback Háptico (Vibração no Celular):**
  - Vibrações distintas para confirmação de consulta, erro de concorrência e aviso de vaga na fila de espera.

---

## 📱 4. Experiência Mobile & Aplicativo Nativo

- [ ] **Empacotamento Nativo (React Native / Expo):**
  - Publicação nas lojas App Store e Google Play com acesso nativo à câmera (leitura de QR Code da carteirinha) e notificações Push em segundo plano.
- [ ] **PWA Offline Completo com Service Worker + IndexedDB:**
  - Armazenamento em cache local criptografado para que o paciente consulte endereço, carteirinha e relatórios mesmo em "Modo Avião" ou sem sinal.
- [ ] **Check-in Automático por Proximidade (Geofencing / GPS):**
  - Ao chegar a 100 metros da clínica no dia da consulta, o app pergunta por notificação: *"Você chegou! Deseja confirmar presença na recepção?"*.
- [ ] **Integração com Calendários Nativos:**
  - Botão de *"Adicionar ao Google Agenda / Apple Calendar"* com download de arquivo `.ics`.

---

## 🏥 5. Módulos Clínicos & Secretaria

- [ ] **Telemedicina Integrada (WebRTC):**
  - Consulta por vídeo diretamente pelo navegador ou app mobile, sem necessidade de links externos (Zoom / Google Meet).
- [ ] **Prescrição Digital com Assinatura ICP-Brasil:**
  - Emissão de receitas médicas com QR Code e assinatura digital padrão CFM.
- [ ] **Integração Oficial com WhatsApp Business (Meta Cloud API):**
  - Mensagens ativas de confirmação com botões interativos (*"Confirmar Presença"*, *"Remarcar"*, *"Cancelar"*).
- [ ] **Painel de Chamada para TV da Recepção:**
  - Modo telão para sala de espera que chama o próximo paciente com som e exibição do consultório.

---

## ⚙️ 6. Refatoração de Código & Qualidade Técnica

- [ ] **Modularização dos Componentes Grandes:**
  - Desmembrar `PhoneApp.tsx` (1.100+ linhas) em submódulos isolados: `HomeScreen.tsx`, `AppointmentsTab.tsx`, `SettingsTab.tsx`, `BookingWizard/`, `Sheets/`.
  - Desmembrar `Chat.tsx` em `useVoiceChat.ts`, `useAiTools.ts`, `ChatBubble.tsx`, `ChatInput.tsx`.
- [ ] **Testes Automatizados (Vitest + Playwright):**
  - Testes unitários para regras de negócio (RN01 trava de 30 min, RN02 fila sequencial, RN03 concorrência).
  - Testes E2E cobrindo o fluxo completo: Agendar -> Confirmar Presença -> Cancelar -> Fila de Espera.
- [ ] **Monitoramento e Telemetria (Sentry + OpenTelemetry):**
  - Registro de erros no cliente e métricas de desempenho de resposta da IA.

---

## 🚀 7. Novas Funcionalidades Clínicas, Operacionais e de Produto (15 Sugestões Adicionais)

### 🩺 7.1. Triagem Pré-Consulta Inteligente (Anamnese Prévia por IA)
- [ ] **Questionário Adaptativo Automatizado:**
  - 3 horas antes da consulta, a Lia faz 3 a 5 perguntas rápidas de triagem (queixa principal, alergias conhecidas, medicamentos em uso).
  - A IA sintetiza um resumo clínico estruturado que é injetado diretamente no prontuário do médico, economizando até 7 minutos de cada atendimento.

### 🏢 7.2. Totem de Autoatendimento com Check-in por QR Code na Recepção
- [ ] **Totem Físico para Sala de Espera:**
  - O paciente chega na clínica e apenas aproxima o QR Code do app no leitor do totem (ou digita CPF/biometria facial).
  - O totem imprime a senha de atendimento e notifica o painel do médico em tempo real: *"Paciente na sala de espera"*.

### 📅 7.3. Gestão Automatizada de Retornos Médicos (Prazo de 30 Dias CFM)
- [ ] **Controle de Retorno Gratuito:**
  - O sistema calcula automaticamente a janela de retorno de 30 dias após a consulta inicial (conforme resolução CFM).
  - No 20º dia, a Lia envia um lembrete: *"Você ainda tem direito a 1 retorno com a Dra. Helena até dia 15/09. Deseja agendar agora?"*.

### 🎙️ 7.4. Ditado Médico com Speech-to-Text Especializado (Whisper Medical)
- [ ] **Evolução Clínica por Voz no Painel do Médico:**
  - O médico clica no microfone dentro do prontuário e dita a evolução, conduta e prescrição.
  - O modelo converte a fala em texto formatado, reconhecendo terminologias médicas, posologias e CID-10 automaticamente.

### 💳 7.5. Módulo de Pagamento Digital Integrado (PIX Dinâmico + Split de Pagamento)
- [ ] **Geração de QR Code PIX Instantâneo com Webhook:**
  - Para consultas particulares, o app gera o PIX Copia e Cola na hora; assim que o banco confirma o pagamento via Webhook, a vaga é confirmada na agenda.
  - Suporte a Split de Pagamento automático (taxa da clínica retida na fonte e repasse líquido direto na conta do médico).

### 🔍 7.6. Validação Automática de Elegibilidade de Convênio (Padrão TISS/TUSS)
- [ ] **Checagem de Carteirinha em Tempo Real:**
  - Conexão com Web Services das operadoras de saúde (Unimed, Bradesco, SulAmérica, Amil) para validar se a carteirinha está ativa, sem carência e autorizada para a especialidade antes de confirmar o agendamento.

### 👨‍👩‍👧 7.7. Modo Família (Gestão de Múltiplos Dependentes em 1 Conta)
- [ ] **Alternador Rápido de Pacientes:**
  - Permite que um filho ou cuidador alterne entre o perfil da mãe idosa, pai e filhos pequenos na barra superior com 1 toque.
  - Cada dependente mantém seu próprio histórico, carteirinha do convênio, relatórios e permissões de acesso.

### 💊 7.8. Central de Medicamentos e Lembretes de Tomada de Remédio
- [ ] **Organizador de Remédios Contínuos:**
  - O paciente cadastra seus remédios com horários e dosagens. O app emite alarmes sonoros acessíveis na hora certa.
  - Quando a caixa de remédio estiver no fim, o app já sugere marcar consulta de renovação de receita.

### 🔮 7.9. IA Preditiva de No-Show (Previsão de Faltas com Machine Learning)
- [ ] **Score Preditivo de Absenteísmo:**
  - Algoritmo que cruza variáveis (previsão do tempo, dia da semana, histórico prévio de faltas do paciente, distância) e gera um score de risco de falta de 0 a 100%.
  - Consultas com risco elevado (>75%) disparam confirmação prioritária ou deixam a fila de espera pré-aquecida.

### 📈 7.10. Overbooking Inteligente e Seguro
- [ ] **Encaixes Baseados em Probabilidade Estatística:**
  - Para horários com alta probabilidade histórica de desistência, o sistema sugere encaixes automáticos calculados, maximizando a receita da clínica sem gerar atrasos na sala de espera.

### 📊 7.11. Dashboard Financeiro e Produtividade Médica em PDF/Excel
- [ ] **Relatórios Gerenciais para Administradores da Clínica:**
  - Exportação em 1 clique de relatórios de faturamento por profissional, procedimentos mais realizados, taxa de conversão da fila e comparativo de absenteísmo mensal.

### 💬 7.12. Bot da Lia no WhatsApp Oficial (Meta Cloud API / Twilio)
- [ ] **Atendimento Conversacional Direto no WhatsApp:**
  - O paciente que não quiser baixar o aplicativo pode conversar com a Lia diretamente pelo número oficial de WhatsApp da clínica, executando as mesmas 10 Tools (agendar, reagendar, cancelar, checar fila).

### ⭐ 7.13. Pesquisa de Satisfação NPS Pós-Consulta Automatizada
- [ ] **Coleta de Feedback com Análise de Sentimento:**
  - 2 horas após a conclusão da consulta, a Lia envia uma mensagem curta de avaliação de 1 a 5 estrelas.
  - Feedbacks negativos disparam alerta imediato para a ouvidoria da clínica agir antes do paciente reclamar na internet.

### 🚗 7.14. Integração com Aplicativos de Transporte (Uber Health / 99)
- [ ] **Botão "Pedir Carro para a Consulta":**
  - No cartão da próxima consulta, um botão de 1 clique abre o app de transporte com o endereço da clínica já preenchido e horário de partida sugerido para chegar 15 minutos antes.

### 📁 7.15. Cofre de Exames e Laudos com OCR Inteligente (Visão Computacional)
- [ ] **Digitalização de Exames Impressos:**
  - O paciente tira uma foto de um exame de sangue ou laudo em papel; a IA lê os valores de referência por OCR, destaca resultados alterados e anexa ao prontuário para o médico consultar.

---

## 📊 Matriz Consolidada de Priorização (Esforço vs. Impacto)

| Iniciativa | Impacto | Esforço | Prioridade |
| :--- | :---: | :---: | :---: |
| **Backend Real (Node + Postgres + Prisma)** | 🔴 Alto | 🟡 Médio | **P1 (Imediato)** |
| **Modularização de `PhoneApp.tsx` e `Chat.tsx`** | 🟡 Médio | 🟢 Baixo | **P1 (Imediato)** |
| **Ollama Backend Real com JSON Schema** | 🔴 Alto | 🟡 Médio | **P1 (Imediato)** |
| **PIX Dinâmico com Confirmação Instantânea** | 🔴 Alto | 🟢 Baixo | **P1 (Imediato)** |
| **Triagem Pré-Consulta por IA** | 🔴 Alto | 🟢 Baixo | **P1 (Imediato)** |
| **App Nativo (React Native / Expo) com Push Notifications** | 🔴 Alto | 🔴 Alto | **P2 (Médio Prazo)** |
| **Bot da Lia no WhatsApp Oficial** | 🔴 Alto | 🟡 Médio | **P2 (Médio Prazo)** |
| **Gestão Automatizada de Retornos (30 Dias CFM)** | 🟡 Médio | 🟢 Baixo | **P2 (Médio Prazo)** |
| **Ditado Médico por Voz no Prontuário** | 🔴 Alto | 🟡 Médio | **P2 (Médio Prazo)** |
| **Totem de Autoatendimento na Recepção** | 🟡 Médio | 🟡 Médio | **P2 (Médio Prazo)** |
| **Validação de Convênio (TISS/TUSS)** | 🔴 Alto | 🔴 Alto | **P2 (Médio Prazo)** |
| **Previsão de No-Show com Machine Learning** | 🔴 Alto | 🟡 Médio | **P2 (Médio Prazo)** |
| **Central de Medicamentos e Alarmes** | 🟡 Médio | 🟢 Baixo | **P3 (Futuro)** |
| **Telemedicina WebRTC e Prescrição Digital ICP-Brasil** | 🟡 Médio | 🔴 Alto | **P3 (Futuro)** |
| **Avatar VLibras e Hotword "Ei Lia"** | 🟡 Médio | 🟡 Médio | **P3 (Futuro)** |
| **Cofre de Exames com OCR Inteligente** | 🟡 Médio | 🟡 Médio | **P3 (Futuro)** |
| **Integração com Uber Health / 99** | 🟢 Baixo | 🟢 Baixo | **P3 (Futuro)** |
