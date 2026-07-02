# Tradutor-LIBRAS

Aplicação web estática que captura gestos em LIBRAS via webcam, reconhece sinais com Visão Computacional (MediaPipe) e Machine Learning (TensorFlow.js), e converte a sequência de sinais em frases naturais em português utilizando um LLM no navegador (Transformers.js).

## Stack

| Componente | Tecnologia |
|---|---|
| Frontend | React + TypeScript |
| Build | Vite |
| Visão Computacional | @mediapipe/tasks-vision (HandLandmarker via WASM) |
| Machine Learning | TensorFlow.js (treino e inferência no browser) |
| LLM | Transformers.js (modelo de texto via WebGPU) |
| Persistência | IndexedDB (dataset de treino, modelo TF.js) |
| Deploy | GitHub Pages |

## Como Executar Localmente

### Pré-requisitos

- Node.js 18+
- npm 9+
- Navegador moderno com suporte WebGPU (Chrome 113+, Edge 113+) — obrigatório para o módulo de geração de frases

### Instalação

```bash
npm install
```

### Desenvolvimento

```bash
npm run dev
```

Acesse `http://localhost:5173/tradutor-libras/` no navegador.

### Build de Produção

```bash
npm run build        # gera dist/
npm run preview      # preview local do build
```

## Estrutura do Projeto

```
tradutor-libras/
├── src/
│   ├── components/          # Componentes React (UI)
│   │   ├── WebcamView.tsx
│   │   ├── HandCanvas.tsx
│   │   ├── DetectionBadge.tsx
│   │   ├── PhraseDisplay.tsx
│   │   ├── LanguageSelector.tsx
│   │   └── ControlBar.tsx
│   ├── modules/            # Módulos de domínio (Clean Architecture)
│   │   ├── capture/        # Wrapper do HandLandmarker (MediaPipe)
│   │   ├── training/       # Coleta de dataset + treino TF.js
│   │   ├── inference/      # Classificador de sinais em tempo real
│   │   └── nlp/            # Cliente Transformers.js (LLM in-browser)
│   ├── hooks/              # Custom hooks (useHandTracking, useClassifier, etc.)
│   ├── types/              # Tipos TypeScript
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
│   └── wasm/               # Assets WASM do MediaPipe + modelos TF.js
├── AGENTS.md               # Regras de operação do agente IA
├── PLAN.md                 # Plano de implementação em fases
├── specs.md                # Especificações técnicas
├── design.md               # Design e convenções
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Deploy no GitHub Pages

O deploy é feito automaticamente via GitHub Actions ao fazer push na branch `main`.

Para deploy manual:

```bash
npm run build
npx gh-pages -d dist
```

A aplicação é servida em `https://<seu-usuario>.github.io/tradutor-libras/`.

## Agentes OpenCode

O projeto inclui definições de agentes OpenCode em `.agents/`:

- `auxiliar` — Implementador: escreve código, implementa features, corrige bugs
- `revisor` — Revisor: code review, verifica conformidade com specs

### Para ativar os agentes

```bash
mkdir -p .opencode/agent && cp .agents/*.md .opencode/agent/
```

Reinicie o OpenCode após copiar. A pasta `.opencode/` é gitignored (config local).

## Arquivos de Especificação

O desenvolvimento utiliza os seguintes arquivos de referência:

- `AGENTS.md` — Regras de operação, padrões de código e convenções
- `PLAN.md` — Plano de implementação faseado
- `specs.md` — Requisitos funcionais e não funcionais
- `design.md` — Design de UI, arquitetura e convenções visuais

## Licença

MIT
