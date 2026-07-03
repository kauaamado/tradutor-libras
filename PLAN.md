# PLAN.md: Tradutor Inteligente de LIBRAS

## 1. Visão Geral do Projeto

**Objetivo:** Desenvolver uma aplicação web estática que capture gestos em LIBRAS via webcam, reconheça os sinais utilizando Visão Computacional e Machine Learning, e converta a sequência de sinais em uma frase natural em português utilizando um LLM in-browser.
**Metodologia:** Spec-Driven Development (SDD). O desenvolvimento será modular, validando cada etapa antes de avançar para a próxima.
**Deploy:** GitHub Pages (arquivos estáticos, sem backend).

## 2. Stack Tecnológica

* **Linguagem:** TypeScript (strict mode)
* **Framework:** React 18+
* **Build:** Vite
* **Visão Computacional:** `@mediapipe/tasks-vision` (HandLandmarker via WASM)
* **Machine Learning (Reconhecimento de Sinais):** TensorFlow.js (treino + inferência no browser)
* **Processamento de Linguagem Natural (NLP):** Transformers.js (`@huggingface/transformers`) com modelo de texto via WebGPU
* **Persistência:** IndexedDB (dataset de treino e modelo TF.js)
* **Interface:** Componentes React com overlay Canvas para landmarks

## 3. Arquitetura do Sistema

O sistema será dividido em 4 módulos principais, seguindo Clean Architecture:

1. **Módulo de Captura (`modules/capture/`):** Captura vídeo via `getUserMedia`, extrai coordenadas 3D (landmarks) das mãos via HandLandmarker. Salva os dados em IndexedDB para treinamento.
2. **Módulo de Treinamento (`modules/training/`):** Lê os dados do IndexedDB e treina um classificador TensorFlow.js, salvando o modelo compilado.
3. **Módulo de Inferência (`modules/inference/`):** Captura landmarks em tempo real, extrai features, passa pelo modelo treinado e empilha as palavras detectadas.
4. **Módulo de NLP (`modules/nlp/`):** Recebe o array de palavras detectadas e gera frase fluente via Transformers.js (LLM in-browser).

---

## 4. Fases de Implementação e Especificações (Specs)

### Fase 1: Setup e Rastreamento de Mãos

**Objetivo:** Configurar o ambiente web e capturar os landmarks das mãos com sucesso.

* [x] Inicializar projeto com Vite + React + TypeScript.
* [x] Configurar `vite.config.ts` com `base: '/tradutor-libras/'`, path alias `@/`, e GitFlow (branch `feat/setup-webstack`).
* [x] Configurar ESLint + Prettier com regras TypeScript.
* [x] Criar estrutura de pastas (`src/components/`, `src/modules/`, `src/hooks/`, `src/types/`).
* [x] Implementar captura de webcam via `navigator.mediaDevices.getUserMedia` com stream em `<video>`.
* [x] Integrar `@mediapipe/tasks-vision` HandLandmarker para processar cada frame e desenhar os landmarks em Canvas overlay.
* [x] Criar componente `WebcamView.tsx` com cleanup correto (parar tracks ao desmontar).
* [x] **Spec de Aceitação:** A webcam deve abrir sem lag, e as conexões (esqueleto) da mão devem ser desenhadas corretamente sobre a mão do usuário em tempo real, com o Canvas sobreposto ao vídeo.

### Fase 2: Coleta de Dados para Treinamento (Dataset)

**Objetivo:** Permitir que o usuário grave exemplos de sinais.

* [x] Criar módulo `modules/training/dataCollector.ts` para gerenciar gravação de landmarks.
* [x] Criar UI de gravação: botão "Iniciar Gravação" + input de label (componentes React, não `input()` de terminal).
* [x] Capturar N frames consecutivos da mão, extraindo as coordenadas X, Y, Z de todos os 21 pontos (63 valores numéricos).
* [x] Salvar as coordenadas em IndexedDB, onde cada entrada contém os 63 valores + a label (string).
* [x] Permitir exportar dataset como JSON (arquivo `.json` baixável).
* [x] **Spec de Aceitação:** O dataset deve ser persistido no IndexedDB contendo entradas com 63 valores numéricos (21 pontos * 3 eixos) mais a string da label, sem dados nulos.

### Fase 3: Treinamento do Modelo de Machine Learning (TF.js)

**Objetivo:** Criar o classificador que entende os sinais estáticos.

* [x] Criar módulo `modules/training/modelTrainer.ts`.
* [x] Carregar dados do IndexedDB e preparar tensores (features: 63 valores, labels: one-hot encoded).
* [x] Dividir os dados em treino e teste (80/20).
* [x] Criar modelo TF.js Sequential: camada de entrada (63) → Dense(128, ReLU) → Dropout(0.3) → Dense(N classes, softmax).
* [x] Treinar com `model.fit()`, exibindo perda e acurácia no console.
* [x] Avaliar no conjunto de teste e exibir acurácia no componente de UI.
* [x] Salvar o modelo em IndexedDB via `model.save('indexeddb://sign-model')`.
* [x] Suportar exportação do modelo como arquivos JSON + binários.
* [x] **Spec de Aceitação:** O treino deve rodar do início ao fim, exibir acurácia superior a 85% e salvar o modelo corretamente no IndexedDB.

### Fase 4: Inferência em Tempo Real

**Objetivo:** Juntar a visão com o modelo treinado para traduzir ao vivo.

* [ ] Criar módulo `modules/inference/signClassifier.ts` e hook `useClassifier.ts`.
* [ ] Carregar o modelo TF.js do IndexedDB uma única vez na inicialização.
* [ ] Criar hook `useHandTracking.ts` que expõe landmarks em tempo real via `requestAnimationFrame`.
* [ ] Para cada frame com mão detectada, extrair landmarks, formatar como tensor e prever a classe.
* [ ] Renderizar componente `DetectionBadge.tsx` com a palavra prevista sobreposta ao feed.
* [ ] Implementar lógica de debounce: uma palavra só é confirmada após ser prevista consistentemente por X frames consecutivos.
* [ ] Manter fila de palavras detectadas (`useReducer` ou `useState`).
* [ ] **Spec de Aceitação:** O sistema deve exibir a palavra correta de forma estável quando o usuário fizer um dos sinais treinados na Fase 2.

### Fase 5: Integração com LLM (Transformers.js) para Frases

**Objetivo:** Transformar sinais isolados em uma frase natural.

* [ ] Criar módulo `modules/nlp/llmClient.ts` e hook `useTranslator.ts`.
* [ ] Implementar detecção de suporte WebGPU (`navigator.gpu`).
* [ ] Se WebGPU disponível, carregar modelo de texto via Transformers.js (`pipeline('text-generation', ...)`).
* [ ] Exibir indicador de carregamento (spinner + barra de progresso) durante download do modelo (~500MB-1GB).
* [ ] Se WebGPU indisponível, exibir aviso e ativar modo heurístico de fallback (montagem de frase por template SVO).
* [ ] Criar gatilho para finalizar a frase (botão "Traduzir" na UI ou tecla Enter).
* [ ] Quando o gatilho for acionado, montar prompt e passar para o pipeline do Transformers.js.
* [ ] **Prompt Base:** `"Você é um tradutor de LIBRAS. Transforme as seguintes palavras extraídas de sinais em uma frase fluente, natural e gramaticalmente correta em {idioma}. Retorne APENAS a frase traduzida, sem explicações. Palavras: {lista_palavras}"`.
* [ ] Exibir a frase final no componente `PhraseDisplay.tsx`.
* [ ] **Spec de Aceitação:** O sistema deve receber um array de strings estáticas, processar via Transformers.js e retornar uma frase contínua e correta em português.

### Fase 6: Deploy no GitHub Pages

**Objetivo:** Publicar a aplicação para acesso público.

* [ ] Criar workflow GitHub Actions (`.github/workflows/deploy.yml`) para build e deploy automático.
* [ ] Workflow: `npm ci` → `npm run build` → upload `dist/` para GitHub Pages.
* [ ] Verificar que `vite.config.ts` tem `base: '/tradutor-libras/'` para servir assets corretamente no subpath.
* [ ] Configurar `HashRouter` ou página 404 customizada para SPA routing no Pages.
* [ ] **Spec de Aceitação:** A aplicação deve carregar completamente em `https://<usuario>.github.io/tradutor-libras/`, com webcam, MediaPipe, TF.js e Transformers.js funcionais em ambiente de produção.

---

## 5. Regras de Desenvolvimento para o Agente IA

1. **Um passo de cada vez:** Não tente implementar a Fase 3 sem que as Fases 1 e 2 estejam 100% funcionais e testadas.
2. **Tratamento de Erros:** Sempre adicione blocos `try-catch`, especialmente na captura de webcam (`getUserMedia`), carregamento WASM (MediaPipe), operações TF.js e inferência Transformers.js.
3. **Logs:** Use `console.info`/`console.warn`/`console.error` com prefixo de módulo (`[HandTracker]`, `[SignClassifier]`, `[LLMClient]`).
4. **Refatoração Contínua:** Mantenha o código limpo, modular e documentado usando JSDoc.
5. **WebGPU Fallback:** Sempre verifique suporte WebGPU antes de carregar o LLM. Ofereça fallback heurístico se indisponível.
6. **Cleanup:** Todo `useEffect` que inicia streams, timers ou listeners deve retornar função de cleanup.
