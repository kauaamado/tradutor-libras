# design.md - Design e Convenções do Tradutor-LIBRAS

## 1. Princípios de Design

* **Minimalismo Funcional:** A interface deve exibir apenas o essencial: feed da webcam e controles mínimos. Nada de painéis laterais, menus complexos ou informações desnecessárias.
* **Feedback Visual Imediato:** O usuário deve sempre saber o que o sistema está fazendo (palavra detectada, frase traduzida, status de carregamento).
* **Separação de Camadas:** A lógica de domínio (`modules/`) é totalmente desacoplada da interface (`components/`). Componentes React consomem módulos via hooks customizados.
* **Clean Architecture:** Módulos de domínio não importam componentes React. Componentes consomem hooks. Hooks encapsulam módulos.

## 2. Layout da Interface (Web)

A aplicação ocupa a viewport inteira com o feed da webcam como plano de fundo. Overlays são posicionados sobre o vídeo.

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                    FEED DA WEBCAM                    │
│              (com Canvas overlay para landmarks)     │
│                                                      │
│   ┌─────────────────────────┐                        │
│   │ Palavra: "EU"           │  ← DetectionBadge     │
│   └─────────────────────────┘                        │
│                                                      │
│   ┌───────────────────────────────────────────────┐  │
│   │ Frase: "Eu quero água"                        │  │
│   └───────────────────────────────────────────────┘  │
│                                                      │
│   [🌐 PT-BR ▼]  [🔄 Limpar]  [📝 Traduzir]  [⏹ Sair]│
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 2.1 Componentes React

| Componente | Descrição | Responsabilidades |
|-----------|-----------|-------------------|
| `App.tsx` | Container principal, estado global via Context | Inicialização, roteamento, providers |
| `WebcamView.tsx` | Gerencia `<video>` element + `getUserMedia` | Iniciar/parar stream, limpar ao desmontar |
| `HandCanvas.tsx` | Canvas overlay sobre o vídeo | Desenhar landmarks da mão, conexões, cores |
| `AlphabetCheatSheet.tsx` | Cola do alfabeto manual em LIBRAS | Exibir imagem de referência do alfabeto |
| `DetectionBadge.tsx` | Badge com a palavra detectada | Exibir palavra atual, debounce status |
| `PhraseDisplay.tsx` | Área de frase traduzida | Exibir frase final, estado de carregamento |
| `LanguageSelector.tsx` | Dropdown de idioma | Selecionar PT-BR / EN / ES |
| `ControlBar.tsx` | Barra inferior de controles | Botões: Limpar, Traduzir, Sair |
| `ModelStatus.tsx` | Indicador de status do modelo | Carregamento, acurácia, WebGPU disponível |
| `DataCollectorUI.tsx` | UI de coleta de dados | Input label, botão gravar, contador de amostras |

### 2.2 Hooks Customizados

| Hook | Descrição | Consome |
|------|-----------|---------|
| `useWebcam()` | Gerencia stream da webcam | `navigator.mediaDevices` |
| `useHandTracking()` | Processa frames via HandLandmarker, retorna landmarks | `HandTracker` (module) |
| `useDataset()` | CRUD do dataset no IndexedDB | `DataCollector` (module) |
| `useClassifier()` | Carrega modelo TF.js e faz predições | `SignClassifier` (module) |
| `useTranslator()` | Gerencia fila de palavras + LLM | `LLMClient` (module) |
| `useWebGPU()` | Detecta suporte WebGPU | `navigator.gpu` |

---

## 3. Arquitetura de Módulos (Clean Architecture)

### 3.1 Estrutura

```
src/
├── components/             # Camada de UI (React)
│   ├── WebcamView.tsx
│   ├── HandCanvas.tsx
│   ├── AlphabetCheatSheet.tsx
│   ├── DetectionBadge.tsx
│   ├── PhraseDisplay.tsx
│   ├── LanguageSelector.tsx
│   ├── ControlBar.tsx
│   ├── ModelStatus.tsx
│   └── DataCollectorUI.tsx
├── modules/                # Camada de Domínio (sem React)
│   ├── capture/
│   │   └── handTracker.ts          # Wrapper HandLandmarker
│   ├── training/
│   │   ├── dataCollector.ts        # Coleta de landmarks
│   │   └── modelTrainer.ts         # Treino TF.js
│   ├── inference/
│   │   └── signClassifier.ts       # Classificação em tempo real
│   └── nlp/
│       └── llmClient.ts            # Cliente Transformers.js
├── hooks/                  # Ponte entre UI e Domínio
│   ├── useWebcam.ts
│   ├── useHandTracking.ts
│   ├── useDataset.ts
│   ├── useClassifier.ts
│   ├── useTranslator.ts
│   └── useWebGPU.ts
├── types/                  # Tipos TypeScript
│   ├── hand.ts             # HandLandmark, HandLandmarks
│   ├── dataset.ts          # DatasetEntry, DatasetRecord
│   ├── model.ts            # TrainingResult, ModelMetadata
│   └── translation.ts      # TranslationResult, LLMConfig
├── App.tsx
├── main.tsx
└── index.css
```

### 3.2 Fluxo de Dependência

```
App.tsx (Context Providers)
  ├── WebcamView.tsx ← useWebcam()
  │     └── HandCanvas.tsx ← useHandTracking()
  │           └── modules/capture/handTracker.ts (HandLandmarker)
  ├── DetectionBadge.tsx ← useClassifier()
  │     └── modules/inference/signClassifier.ts (TF.js predict)
  ├── PhraseDisplay.tsx ← useTranslator()
  │     └── modules/nlp/llmClient.ts (Transformers.js pipeline)
  ├── LanguageSelector.tsx (context dispatch)
  ├── ControlBar.tsx (ações: limpar, traduzir, sair)
  ├── ModelStatus.tsx (estado do modelo)
  └── DataCollectorUI.tsx ← useDataset()
        └── modules/training/dataCollector.ts (IndexedDB)
```

As setas indicam direção de dependência: componentes → hooks → módulos. Módulos nunca importam de `hooks/` ou `components/`.

---

## 4. Tipos TypeScript

### 4.1 Hand

```typescript
/** Coordenadas normalizadas de um ponto da mão (0.0 a 1.0). */
type HandLandmark = {
  x: number;
  y: number;
  z: number;
};

/** 21 landmarks de uma mão (63 valores: 21 × 3). */
type HandLandmarks = HandLandmark[];

/** Resultado do HandLandmarker para um frame. */
type HandLandmarkerResult = {
  landmarks: HandLandmarks[];
  worldLandmarks: HandLandmarks[];
  handedness: ('Left' | 'Right')[];
};
```

### 4.2 Dataset

```typescript
/** Uma entrada do dataset (63 features + label). */
type DatasetEntry = {
  /** 63 valores numéricos (21 landmarks × 3 eixos) achatados. */
  features: number[];
  /** Label do sinal (ex.: "EU", "QUERER", "ÁGUA"). */
  label: string;
};

/** Dataset completo com metadados. */
type DatasetMetadata = {
  id: string;
  name: string;
  entries: DatasetEntry[];
  createdAt: number;
};
```

### 4.3 Model

```typescript
/** Resultado do treinamento. */
type TrainingResult = {
  accuracy: number;
  loss: number;
  valAccuracy: number;
  valLoss: number;
  epochs: number;
};
```

### 4.4 Translation / LLM

```typescript
/** Resultado da geração de frase. */
type TranslationResult = {
  frase: string;
  idioma: 'pt-BR' | 'en' | 'es';
  modo: 'llm' | 'heuristico';
  timestamp: number;
};

/** Configuração do LLM. */
type LLMConfig = {
  modelo: string;
  device: 'webgpu' | 'wasm';
  maxTokens: number;
};
```

---

## 5. Design Visual

### 5.1 Paleta de Cores (CSS / Canvas)

| Elemento | Cor | Código |
|----------|-----|--------|
| Fundo da página | Preto | `#000000` |
| Fundo do badge de detecção | Verde escuro com opacidade | `rgba(0, 100, 0, 0.85)` |
| Texto da palavra detectada | Branco | `#ffffff` |
| Fundo da área de frase | Preto com opacidade | `rgba(0, 0, 0, 0.85)` |
| Texto da frase | Branco | `#ffffff` |
| Botão primário | Azul | `#1a73e8` |
| Botão hover | Azul claro | `#4a90d9` |
| Landmarks (Canvas) | Verde claro | `#00ff00` |
| Conexões (Canvas) | Verde escuro | `#00cc00` |
| Indicador de carregamento | Laranja | `#ff9800` |
| Badge de WebGPU indisponível | Vermelho | `#d32f2f` |

### 5.2 Tipografia (CSS)

| Elemento | Família | Tamanho | Peso |
|----------|---------|---------|------|
| Títulos | `system-ui, sans-serif` | 1.5rem | 700 |
| Palavra detectada (badge) | `system-ui, sans-serif` | 1.25rem | 600 |
| Frase traduzida | `system-ui, sans-serif` | 1.1rem | 400 |
| Status / loading | `system-ui, sans-serif` | 0.85rem | 400 |
| Botões | `system-ui, sans-serif` | 0.9rem | 500 |

### 5.3 Canvas Overlay

- Canvas posicionado absolutamente sobre o `<video>`, com mesmas dimensões.
- Landmarks desenhados como círculos de raio 5px.
- Conexões desenhadas como linhas de espessura 2px.
- Atualizado a cada `requestAnimationFrame`.

---

## 6. Gerenciamento de Estado

### 6.1 Estado Local (useState / useReducer)

- Fila de palavras detectadas: `useReducer` (ações: `APPEND`, `CLEAR`).
- Estado de carregamento de modelo: `useState<'idle' | 'loading' | 'ready' | 'error'>`.
- Debounce de predição: `useRef` para contador de frames + `useState` para palavra estável.

### 6.2 Estado Global (Context API)

- Idioma selecionado: `LanguageContext`.
- Status do modelo (carregado, acurácia): `ModelContext`.
- Status WebGPU: `WebGPUContext`.

### 6.3 Persistência (IndexedDB)

- Dataset de treino: `DatasetStore`.
- Modelo TF.js: `tf.io.browserIndexedDB('sign-model')`.
- Preferências do usuário (idioma): `localStorage`.

---

## 7. Tratamento de Erros e Estados

### 7.1 Estados de UI

Todo componente que depende de recurso externo deve lidar com 4 estados:

| Estado | Descrição | UI |
|--------|-----------|-----|
| `idle` | Inicial, recurso não carregado | Placeholder / nada |
| `loading` | Carregando recurso (WASM, modelo, webcam) | Spinner + texto |
| `ready` | Recurso disponível e funcional | Conteúdo normal |
| `error` | Falha irrecuperável | Mensagem amigável + botão "Tentar novamente" |

### 7.2 Erros Esperados e Fallbacks

| Erro | Causa | Fallback |
|------|-------|----------|
| `getUserMedia` rejeitada | Permissão negada, sem câmera | Mensagem: "Permita acesso à câmera para usar o tradutor." |
| MediaPipe WASM falha ao carregar | Rede lenta, CDN offline | Mensagem + botão "Tentar novamente" |
| Modelo TF.js não encontrado no IndexedDB | Primeiro uso, nunca treinou | Redirecionar para UI de coleta/treino |
| WebGPU indisponível | Firefox, Safari, GPU antiga | Aviso + modo heurístico de fallback |
| Transformers.js download falha | Rede, espaço em disco | Mensagem + sugestão de usar fallback heurístico |

---

## 8. Convenções de Código

### 8.1 Nomenclatura

| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| Componentes React | `PascalCase.tsx` | `WebcamView.tsx` |
| Módulos | `camelCase.ts` | `handTracker.ts` |
| Hooks | `use<PascalCase>.ts` | `useHandTracking.ts` |
| Tipos/Interfaces | `PascalCase` | `HandLandmarks`, `DatasetEntry` |
| Funções | `camelCase` | `extractLandmarks()`, `predictClass()` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_DEBOUNCE_FRAMES`, `OLLAMA_URL` (se aplicável) |
| Arquivos de tipo | `camelCase.ts` | `hand.ts`, `dataset.ts` |
| Diretórios | `camelCase` | `modules/capture/`, `components/` |

### 8.2 Imports

Ordem: bibliotecas padrão → bibliotecas externas → módulos locais.

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';

import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import * as tf from '@tensorflow/tfjs';

import { HandTracker } from '@/modules/capture/handTracker';
import { useWebcam } from '@/hooks/useWebcam';
import type { HandLandmarkerResult } from '@/types/hand';
```

### 8.3 JSDoc (TSDoc)

```typescript
/**
 * Hook para rastreamento de mãos via HandLandmarker.
 *
 * @param videoRef - Referência ao elemento <video> da webcam.
 * @param running - Flag que controla o loop de detecção.
 * @returns Resultado dos landmarks em tempo real.
 */
export function useHandTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  running: boolean,
): HandLandmarkerResult | null {
```

### 8.4 Componentes

```typescript
/** Props do componente WebcamView. */
interface WebcamViewProps {
  onReady: () => void;
  onError: (error: Error) => void;
}

/**
 * Componente que gerencia a captura de vídeo da webcam.
 */
export function WebcamView({ onReady, onError }: WebcamViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        onReady();
      } catch (err) {
        onError(err as Error);
      }
    }

    startCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [onReady, onError]);

  return <video ref={videoRef} autoPlay playsInline muted />;
}
```

### 8.5 Logging

```typescript
// ✅ Correto: prefixo de módulo, nível adequado
console.info('[HandTracker] HandLandmarker carregado com sucesso.');
console.warn('[SignClassifier] Modelo não encontrado no IndexedDB. Treine um modelo primeiro.');
console.error('[LLMClient] WebGPU indisponível. Ativando modo heurístico de fallback.');

// ❌ Proibido: console.log genérico para status
console.log('Modelo carregado');
```

---

## 9. Formato de Dados

### 9.1 Dataset (IndexedDB / JSON)

```json
{
  "id": "dataset-001",
  "name": "Sinais Básicos",
  "createdAt": 1719000000000,
  "entries": [
    {
      "features": [0.45, 0.32, 0.01, ..., 0.67, 0.45, 0.02],
      "label": "EU"
    }
  ]
}
```

- 63 valores `number` por entrada (21 landmarks × 3 eixos), normalizados (0.0–1.0).
- Sem dados nulos.

### 9.2 Modelo TF.js (save/load)

- Salvo em IndexedDB: `indexeddb://sign-model`.
- Exportável: `model.json` + `group1-shard1of1.bin`.
- Carregado uma vez na inicialização do módulo `SignClassifier`.

### 9.3 Prompt para Transformers.js

```typescript
const PROMPT_TEMPLATE = `
Você é um tradutor de LIBRAS. Transforme as seguintes palavras extraídas de sinais em uma frase fluente, natural e gramaticalmente correta em {idioma}.
Retorne APENAS a frase traduzida, sem explicações.
Palavras: {palavras}
`;
```

---

## 10. Padrões de Commits (Conventional Commits PT-BR)

Formato: `<tipo>(<escopo>): <descrição em PT-BR>`

| Tipo | Uso |
|------|-----|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `refactor` | Refatoração sem mudança de comportamento |
| `docs` | Documentação |
| `test` | Testes |
| `chore` | Tarefas de manutenção (deps, configs) |

**Exemplos:**

```
feat(captura): adiciona integração com MediaPipe tasks-vision para rastreamento de mãos
fix(inferencia): corrige debounce de predições para evitar flickering
refactor(nlp): separa cliente Transformers.js em módulo dedicado
docs(readme): atualiza instruções de execução local
test(treinamento): adiciona testes de validação de acurácia do modelo
chore(deps): atualiza @tensorflow/tfjs para 4.20
```

---

## 11. Branches e GitFlow

```
main
 └── dev
      ├── feat/setup-webstack         → Fase 1
      ├── feat/coleta-dataset         → Fase 2
      ├── feat/treinamento-tfjs       → Fase 3
      ├── feat/inferencia-tempo-real  → Fase 4
      ├── feat/integracao-transformersjs → Fase 5
      └── feat/deploy-pages           → Fase 6
```

* **`main`**: Branch de produção. Recebe merges de `dev` via PR.
* **`dev`**: Branch de desenvolvimento. Features são mescladas aqui via PR.
* **`feat/*`**: Branches de feature, criadas a partir de `dev`.
* **Nunca faça commit direto em `main`.**
