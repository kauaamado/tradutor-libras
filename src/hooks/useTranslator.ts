import { useCallback, useRef, useState } from 'react';

import type { TranslatorStatus, DownloadProgress } from '@/types/translation';
import {
  detectWebGPU,
  heuristicTranslate,
  loadLLM,
  translateWithLLM,
} from '@/modules/nlp/llmClient';

interface UseTranslatorReturn {
  /** Status atual (idle, loading, translating, ready, etc.). */
  status: TranslatorStatus;
  /** Frase traduzida (resultado final). */
  frase: string;
  /** Progresso do download do modelo (0-100 estimado). */
  downloadProgress: number;
  /** Mensagem de erro, se houver. */
  error: string | null;
  /** Se WebGPU está disponível. */
  webgpuAvailable: boolean;
  /** Dispara a tradução das palavras. */
  translate: (words: string[]) => Promise<void>;
  /**
   * Tradução simples — força fallback heurístico mesmo com WebGPU disponível.
   * Útil quando o usuário opta por não baixar o modelo LLM.
   */
  translateSimple: (words: string[]) => void;
  /** Limpa a frase e reseta o estado. */
  clear: () => void;
}

/**
 * Hook que gerencia a tradução de palavras → frase via LLM (Transformers.js).
 *
 * No primeiro uso, baixa o modelo (~500MB). Downloads subsequentes usam cache.
 * Fallback heurístico se WebGPU indisponível.
 */
export function useTranslator(): UseTranslatorReturn {
  const [status, setStatus] = useState<TranslatorStatus>('idle');
  const [frase, setFrase] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const webgpuAvailable = detectWebGPU();

  // Pipeline carregado (ref para evitar re-render)
  const generatorRef = useRef<unknown>(null);
  const loadedRef = useRef(false);

  /** Inicia a tradução. */
  const translate = useCallback(
    async (words: string[]) => {
      if (words.length === 0) return;

      setError(null);

      // Sem WebGPU → heurístico imediato
      if (!webgpuAvailable) {
        console.info(
          '[useTranslator] WebGPU indisponível — usando fallback heurístico.',
        );
        const result = heuristicTranslate(words);
        setFrase(result.frase);
        setStatus('fallback');
        return;
      }

      try {
        // Carregar modelo (só na primeira vez)
        if (!loadedRef.current) {
          setStatus('loading');
          setDownloadProgress(0);

          generatorRef.current = await loadLLM((p: DownloadProgress) => {
            // Estimar progresso total
            if (p.progress !== undefined) {
              setDownloadProgress(Math.round(p.progress));
            }
          });

          loadedRef.current = true;
        }

        // Gerar frase
        setStatus('translating');
        setFrase('');

        const result = await translateWithLLM(generatorRef.current, words);
        setFrase(result.frase);
        setStatus('ready');
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Erro ao gerar frase.';
        setError(msg);
        setStatus('error');
        console.error('[useTranslator] Erro:', msg);

        // Fallback heurístico em caso de erro
        const fallback = heuristicTranslate(words);
        setFrase(fallback.frase);
      }
    },
    [webgpuAvailable],
  );

  /** Reseta o estado. */
  const clear = useCallback(() => {
    setStatus('idle');
    setFrase('');
    setError(null);
    setDownloadProgress(0);
  }, []);

  /** Tradução simples — fallback heurístico forçado (sem LLM). */
  const translateSimple = useCallback((words: string[]) => {
    const result = heuristicTranslate(words);
    setFrase(result.frase);
    setStatus('fallback');
    console.info('[useTranslator] Tradução simples:', result.frase);
  }, []);

  return {
    status,
    frase,
    downloadProgress,
    error,
    webgpuAvailable,
    translate,
    translateSimple,
    clear,
  };
}
