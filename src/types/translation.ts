/** Resultado da geração de frase. */
export interface TranslationResult {
  /** Frase gerada. */
  frase: string;
  /** Idioma alvo. */
  idioma: 'pt-BR' | 'en' | 'es';
  /** Timestamp da geração. */
  timestamp: number;
}

/** Estado do carregamento/tradução. */
export type TranslatorStatus = 'idle' | 'translating' | 'ready' | 'fallback' | 'error';
