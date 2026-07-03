/** Resultado da geração de frase. */
export interface TranslationResult {
  /** Frase gerada. */
  frase: string;
  /** Idioma alvo. */
  idioma: 'pt-BR' | 'en' | 'es';
  /** Modo de geração usado. */
  modo: 'llm' | 'heuristico';
  /** Timestamp da geração. */
  timestamp: number;
}

/** Configuração do LLM. */
export interface LLMConfig {
  /** ID do modelo no HuggingFace Hub. */
  modelo: string;
  /** Dispositivo de execução. */
  device: 'webgpu' | 'wasm';
  /** Tokens máximos na resposta. */
  maxTokens: number;
}

/** Estado do carregamento/tradução. */
export type TranslatorStatus =
  | 'idle'
  | 'loading'
  | 'translating'
  | 'ready'
  | 'fallback'
  | 'error';

/** Progresso do download do modelo. */
export interface DownloadProgress {
  /** Status textual (ex.: 'downloading', 'loading'). */
  status: string;
  /** Nome do arquivo sendo baixado. */
  file?: string;
  /** Progresso do arquivo atual (0-100). */
  progress?: number;
  /** Progresso total estimado (0-100). */
  total?: number;
  /** Bytes baixados. */
  loaded?: number;
  /** Total de bytes a baixar. */
  totalBytes?: number;
}

/** Configuração padrão do LLM para o tradutor. */
export const DEFAULT_LLM_CONFIG: LLMConfig = {
  modelo: 'onnx-community/Qwen2.5-0.5B-Instruct',
  device: 'webgpu',
  maxTokens: 80,
};
