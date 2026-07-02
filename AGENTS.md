# AGENTS.md — Tradutor-LIBRAS

App web estática (GitHub Pages) que traduz gestos de LIBRAS via webcam → texto.
Stack: React + TypeScript + Vite, `@mediapipe/tasks-vision` (WASM), TensorFlow.js, Transformers.js (WebGPU).
Specs detalhadas nos arquivos `specs.md`, `design.md`, `PLAN.md`.

## Setup

```bash
npm install
npm run dev      # http://localhost:5173/tradutor-libras/
npm run build    # output: dist/
npm run lint     # ESLint + TypeScript check
npm run format   # Prettier
```

## Arquitetura

- `src/modules/` — domínio puro (capture, training, inference, nlp). **Nunca importe React ou `components/`.**
- `src/components/` — UI React. Consome módulos exclusivamente via `src/hooks/`.
- `src/hooks/` — ponte entre UI e domínio. Um hook por responsabilidade.
- `src/types/` — tipos e interfaces globais.
- `@/` é alias para `src/` (ex: `import { HandTracker } from '@/modules/capture/handTracker'`).

## Regras de Domínio

- **Landmarks:** 21 pontos × 3 eixos (X, Y, Z) = 63 valores `number` por mão. Valide que nenhum é `null` antes de alimentar o modelo.
- **Webcam:** `getUserMedia` com cleanup obrigatório ao desmontar:
  ```typescript
  stream.getTracks().forEach(t => t.stop());
  video.srcObject = null;
  ```
- **Modelo TF.js:** Carregue **uma vez** na inicialização (IndexedDB: `indexeddb://sign-model` ou `public/models/`). Nunca recarregue por frame.
- **Dataset TF.js:** Salve em IndexedDB. Entradas com 63 features (`number[]`) + label (`string`).
- **Transformers.js:** Detecte WebGPU (`!!navigator.gpu`) antes de carregar o LLM. Se ausente → exiba aviso + ative fallback heurístico (template SVO). Exiba progresso durante download (~500MB+).
- **Logging:** `console.info`/`console.warn`/`console.error` com prefixo `[NOME_DO_MODULO]`. Proibido `console.log` genérico para status.

## Workflow

- **GitFlow:** Branches `feat/*` a partir de `dev`; PR para `dev`. **Nunca PR direto para `main`.**
- **Commits:** Conventional Commits em **PT-BR**. Ex: `feat(captura): adiciona HandLandmarker via tasks-vision`.
- **SDD:** Uma fase por vez. Não implemente a Fase N+1 sem a N estar validada.
- **Vite base:** O `vite.config.ts` DEVE ter `base: '/tradutor-libras/'` — sem isso, assets quebram no GitHub Pages.

## Agentes OpenCode

Definições em `.agents/`. Para ativar: `mkdir -p .opencode/agent && cp .agents/*.md .opencode/agent/`.
