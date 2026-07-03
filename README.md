# Tradutor-LIBRAS

Aplicação web estática que captura gestos em LIBRAS via webcam, reconhece sinais com Visão Computacional (MediaPipe) e Machine Learning (TensorFlow.js), e converte a sequência de sinais em frases em português.

## Stack

| Componente | Tecnologia |
|---|---|
| Frontend | React + TypeScript |
| Build | Vite |
| Visão Computacional | @mediapipe/tasks-vision (HandLandmarker via WASM) |
| Machine Learning | TensorFlow.js (treino e inferência no browser) |
| Persistência | IndexedDB (dataset de treino, modelo TF.js) |
| Deploy | GitHub Pages (workflow automático) |

## Como Executar Localmente

### Pré-requisitos

- Node.js 18+
- npm 9+
- Navegador moderno (Chrome, Firefox, Edge, Safari)

### Instalação

```bash
npm install --ignore-scripts
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

## Dataset de Exemplo

O repositório inclui um dataset com **100 amostras** de sinais em LIBRAS (`dataset-libras-1783090215089.json`). Cobre 19 letras do alfabeto manual (A, B, C, D, E, F, I, L, M, N, O, R, S, T, U, V, W, X, Y), com amostras para mão direita (`D_`) e esquerda (`E_`).

### Como usar

1. Clone o repositório
2. Inicie o app com `npm run dev`
3. Clique em **"Mostrar ferramentas"** para expandir o painel avançado
4. No painel **Coleta de Dados**, clique em **"Importar JSON"**
5. Selecione o arquivo `dataset-libras-1783090215089.json`
6. Vá ao painel **Treinamento** e clique em **"Treinar Modelo"**
7. Após o treino, recarregue a página para usar o modelo TF.js

## Estrutura do Projeto

```
tradutor-libras/
├── src/
│   ├── components/          # Componentes React (UI)
│   │   ├── WebcamView.tsx
│   │   ├── HandCanvas.tsx
│   │   ├── DataCollectorPanel.tsx
│   │   ├── TrainingPanel.tsx
│   │   └── AlphabetCheatSheet.tsx
│   ├── modules/            # Módulos de domínio (Clean Architecture)
│   │   ├── capture/        # Wrapper do HandLandmarker (MediaPipe)
│   │   ├── inference/      # Classificadores (heurístico + TF.js)
│   │   ├── training/       # Coleta de dados e treinamento TF.js
│   │   └── nlp/            # Tradução heurística (palavras → frase)
│   ├── hooks/              # Custom hooks (useWebcam, useHandTracking, etc.)
│   ├── types/              # Tipos TypeScript
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
│   └── images/             # Imagens estáticas (cola do alfabeto)
├── .github/workflows/      # CI + Deploy automático
├── dataset-*.json          # Dataset de exemplo (100 amostras)
├── .agents/                # Definições de agentes OpenCode
├── AGENTS.md               # Regras de operação do agente IA
├── PLAN.md                 # Plano de implementação em fases
├── specs.md                # Especificações técnicas
├── design.md               # Design e convenções
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Deploy no GitHub Pages

O deploy é automático via GitHub Actions. Todo push na branch `main` dispara o workflow `.github/workflows/deploy.yml`:

1. `npm install --ignore-scripts`
2. `npm run build`
3. Deploy do `dist/` via `actions/deploy-pages@v4`

A aplicação está disponível em **[https://kauaamado.github.io/tradutor-libras/](https://kauaamado.github.io/tradutor-libras/)**.

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
