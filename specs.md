# specs.md - Especificações Técnicas do Tradutor-LIBRAS

## 1. Visão Geral

**Produto:** Aplicação web estática (SPA) que captura gestos em LIBRAS via webcam, reconhece os sinais por meio de Visão Computacional e Machine Learning, e converte a sequência de sinais em frases naturais em múltiplos idiomas (português, inglês, espanhol, etc.) utilizando um LLM executado no navegador.

**Metodologia:** Spec-Driven Development (SDD). Cada fase deve ser validada antes de avançar para a próxima.

**Deploy:** GitHub Pages (arquivos estáticos, sem backend).

---

## 2. Requisitos Funcionais

### RF-01: Captura de Vídeo via Webcam
- O sistema deve acessar a webcam via `navigator.mediaDevices.getUserMedia` e exibir o stream em um elemento `<video>`.
- O sistema deve processar cada frame via `requestAnimationFrame` sem acúmulo de lag.
- O sistema deve liberar o recurso da câmera ao desmontar o componente (`stream.getTracks().forEach(t => t.stop())`). `video.srcObject = null`.
- A captura só funciona em HTTPS (fornecido pelo GitHub Pages) ou localhost.

### RF-02: Rastreamento de Mãos (MediaPipe tasks-vision)
- O sistema deve carregar o `HandLandmarker` via `@mediapipe/tasks-vision` (WASM).
- O sistema deve detectar uma ou duas mãos no frame da webcam.
- O sistema deve extrair os 21 landmarks de cada mão detectada, resultando em 63 valores numéricos por mão (21 pontos × 3 eixos: X, Y, Z).
- O sistema deve validar que nenhum landmark é nulo antes de processar os dados.
- O sistema deve desenhar o esqueleto da mão em Canvas overlay sobre o vídeo.

### RF-03: Coleta de Dados para Treinamento
- O sistema deve permitir que o usuário inicie a gravação de um sinal via botão na UI.
- O sistema deve solicitar o nome da classe (label) do sinal (ex.: "EU", "QUERER", "ÁGUA") via input React.
- O sistema deve capturar N frames consecutivos e extrair as coordenadas dos landmarks.
- O sistema deve salvar os dados em IndexedDB com estrutura: 63 colunas numéricas (landmarks) + label (string).
- O sistema deve permitir exportar o dataset como arquivo JSON.
- O dataset não deve conter dados nulos ou inconsistências.

### RF-04: Treinamento do Modelo de ML (TensorFlow.js)
- O sistema deve carregar dados do IndexedDB.
- O sistema deve separar as labels, mapear para índices numéricos e aplicar one-hot encoding.
- O sistema deve dividir os dados em treino e teste (80/20).
- O sistema deve criar um modelo TF.js Sequential com arquitetura: Input(63) → Dense(128, ReLU) → Dropout(0.3) → Dense(N classes, softmax).
- O sistema deve treinar com `model.fit()` e exibir métricas (perda, acurácia) no console e na UI.
- O sistema deve exibir a acurácia final no dataset de teste.
- O sistema deve salvar o modelo treinado em IndexedDB via `model.save('indexeddb://sign-model')`.
- O sistema deve suportar exportação do modelo como arquivos (JSON + binários) para `public/models/`.
- A acurácia mínima aceitável é 85%.

### RF-05: Inferência em Tempo Real
- O sistema deve carregar o modelo TF.js do IndexedDB uma única vez na inicialização.
- O sistema deve, a cada frame com mão detectada, extrair os landmarks, formatar como tensor e prever a classe usando `model.predict()`.
- O sistema deve exibir a palavra prevista em um componente React (`DetectionBadge.tsx`) sobreposto ao feed de vídeo.
- O sistema deve implementar lógica de debounce: uma palavra só é confirmada e adicionada à fila após ser prevista consistentemente por X frames consecutivos (configurável, default: 15 frames).
- O sistema deve manter uma fila de palavras detectadas visível ao usuário.

### RF-06: Geração de Frases via LLM (Transformers.js)
- O sistema deve manter uma fila de palavras detectadas (ex.: `["EU", "QUERER", "ÁGUA"]`).
- O sistema deve fornecer um botão "Traduzir" (ou tecla Enter) como gatilho para finalizar a frase.
- O sistema deve detectar suporte WebGPU (`!!navigator.gpu`) antes de carregar o LLM.
- Se WebGPU disponível, o sistema deve carregar um modelo de texto via `@huggingface/transformers` (`pipeline('text-generation', ...)`).
- O sistema deve exibir indicador de carregamento (progresso + spinner) durante o download do modelo.
- Quando o gatilho for acionado, o sistema deve montar o prompt e gerar a frase via pipeline.
- **Prompt Base:** `"Você é um tradutor de LIBRAS. Transforme as seguintes palavras extraídas de sinais em uma frase fluente, natural e gramaticalmente correta em {idioma}. Retorne APENAS a frase traduzida, sem explicações. Palavras: {lista_palavras}"`.
- Se WebGPU indisponível, o sistema deve exibir aviso e ativar modo heurístico de fallback (montagem de frase por template SVO + correções gramaticais básicas).
- O sistema deve exibir a frase retornada no componente `PhraseDisplay.tsx`.
- O sistema nunca deve bloquear a UI principal durante a inferência do LLM.

### RF-07: Suporte Multilíngue
- O sistema deve permitir ao usuário selecionar o idioma de saída da tradução (português-BR, inglês, espanhol, etc.) via componente `LanguageSelector.tsx`.
- O idioma selecionado deve ser injetado no prompt enviado ao LLM.
- O estado do idioma selecionado deve ser mantido em Context API.

---

## 3. Requisitos Não Funcionais

| ID | Requisito | Detalhamento |
|----|-----------|-------------|
| RNF-01 | Performance | O processamento de cada frame deve ocorrer em tempo real (~33ms por frame para manter 30fps). Predição TF.js e desenho Canvas não devem causar jank. |
| RNF-02 | Confiabilidade | Falhas na webcam (permissão negada, câmera indisponível), MediaPipe WASM (falha de download) ou Transformers.js (WebGPU ausente) não devem causar crash da aplicação. Exceções devem ser tratadas e exibidas ao usuário com mensagem amigável. |
| RNF-03 | Portabilidade | A aplicação deve funcionar em qualquer navegador moderno (Chrome 113+, Edge 113+) sem dependência de backend. |
| RNF-04 | Logging | `console.info`/`console.warn`/`console.error` com prefixo de módulo (`[HandTracker]`, `[SignClassifier]`, `[LLMClient]`). |
| RNF-05 | Modularidade | Módulos de domínio (`modules/`) não devem importar componentes React. Componentes consomem módulos via hooks. A falha de um módulo não deve derrubar os demais. |
| RNF-06 | Extensibilidade | O modelo de ML (TF.js) e o LLM (Transformers.js) devem ser intercambiáveis. Deve ser possível trocar o classificador (ex.: MobileNet no lugar de Dense) ou o modelo de texto (ex.: Qwen no lugar de Llama) sem alterar a estrutura do projeto. |
| RNF-07 | Responsividade | A aplicação deve adaptar o layout a diferentes tamanhos de viewport (desktop e tablet). O feed da webcam deve ocupar a área principal, com overlays reposicionados proporcionalmente. |
| RNF-08 | Segurança | Sem APIs externas que exijam chaves expostas. Todo processamento é local (browser) ou serve arquivos estáticos. Nenhum segredo é commitado. |

---

## 4. Stack Tecnológica

| Componente | Tecnologia | Versão Mínima |
|-----------|-----------|---------------|
| Linguagem | TypeScript | 5.x (strict mode) |
| Framework | React | 18.x |
| Build | Vite | 5.x |
| Visão Computacional | @mediapipe/tasks-vision | latest |
| Machine Learning | TensorFlow.js | 4.x |
| LLM in-browser | @huggingface/transformers | 3.x |
| Persistência | IndexedDB | - |
| Deploy | GitHub Pages | - |

---

## 5. Especificações por Fase

### Fase 1: Setup e Rastreamento de Mãos
- **Entrada:** Feed da webcam via `getUserMedia`.
- **Saída:** Elemento `<video>` com Canvas overlay desenhando landmarks.
- **Critério de Aceitação:** A webcam abre sem lag e os landmarks são desenhados corretamente sobre a mão em tempo real, com cleanup adequado ao desmontar.

### Fase 2: Coleta de Dados
- **Entrada:** UI de gravação (botão + input de label) + feed de landmarks.
- **Saída:** Dataset persistido em IndexedDB com 63 valores numéricos + label por entrada.
- **Critério de Aceitação:** Dataset gerado sem dados nulos, exportável como JSON, com 63 features + label por linha.

### Fase 3: Treinamento do Modelo (TF.js)
- **Entrada:** Dataset do IndexedDB.
- **Saída:** Modelo TF.js salvo em IndexedDB (`indexeddb://sign-model`), exportável.
- **Critério de Aceitação:** Treino executa sem erros, acurácia > 85%, modelo salvo e recarregável do IndexedDB.

### Fase 4: Inferência em Tempo Real
- **Entrada:** Feed da webcam + landmarks + modelo TF.js carregado.
- **Saída:** Palavra prevista exibida em `DetectionBadge.tsx` sobreposta ao feed de vídeo.
- **Critério de Aceitação:** Sinal correto exibido de forma estável (com debounce) ao realizar gesto treinado.

### Fase 5: Integração com LLM (Transformers.js)
- **Entrada:** Lista de palavras detectadas + idioma selecionado.
- **Saída:** Frase natural no idioma selecionado, exibida em `PhraseDisplay.tsx`.
- **Critério de Aceitação:** Array de palavras é processado pelo Transformers.js (WebGPU) e a frase retornada é fluente e gramaticalmente correta. Se WebGPU indisponível, fallback heurístico funciona.

### Fase 6: Deploy GitHub Pages
- **Entrada:** Código fonte no repositório.
- **Saída:** Aplicação funcional em `https://<usuario>.github.io/tradutor-libras/`.
- **Critério de Aceitação:** Todos os módulos (webcam, MediaPipe, TF.js, Transformers.js) funcionais em produção, assets carregados corretamente via subpath.

---

## 6. Estrutura de Arquivos Esperada

```
tradutor-libras/
├── src/
│   ├── components/         # Componentes React
│   ├── modules/            # Módulos de domínio (Clean Architecture)
│   │   ├── capture/        # HandLandmarker wrapper
│   │   ├── training/       # Coleta + treino TF.js
│   │   ├── inference/      # Classificador em tempo real
│   │   └── nlp/            # Cliente Transformers.js
│   ├── hooks/              # Custom hooks React
│   └── types/              # Tipos e interfaces TypeScript
├── public/
│   └── wasm/               # Assets WASM (MediaPipe + modelos TF.js)
├── .github/workflows/      # CI/CD GitHub Pages
├── AGENTS.md               # Regras do agente IA
├── PLAN.md                 # Plano de fases
├── specs.md                # Especificações (este arquivo)
├── design.md               # Design e convenções
├── README.md               # Documentação do projeto
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 7. Dependências Externas

| Dependência | Propósito | Obrigatória? |
|-------------|-----------|-------------|
| Webcam | Captura de vídeo | Sim |
| Navegador compatível WebGPU | Execução do LLM in-browser | Sim (Fase 5+) |
| CDN / Servidor WASM | Download de assets MediaPipe e modelos Transformers.js | Sim |

---

## 8. Restrições e Premissas

- A aplicação é 100% estática (sem backend). Todo processamento ocorre no navegador do usuário.
- O modelo de ML é treinado apenas para sinais estáticos (não dinâmicos) no MVP.
- O download do modelo Transformers.js (~500MB-1GB) ocorre no primeiro uso e é cacheado pelo navegador.
- WebGPU é necessário para o módulo de NLP. Navegadores sem suporte (Firefox, Safari) recebem fallback heurístico.
- O idioma padrão de saída é português-BR.
- O site é servido sob subpath `/tradutor-libras/` no GitHub Pages.
