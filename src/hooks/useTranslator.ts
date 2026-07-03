import { useCallback, useState } from 'react';

import type { TranslatorStatus } from '@/types/translation';
import { heuristicTranslate } from '@/modules/nlp/llmClient';

interface UseTranslatorReturn {
  /** Status atual. */
  status: TranslatorStatus;
  /** Frase traduzida. */
  frase: string;
  /** Mensagem de erro, se houver. */
  error: string | null;
  /** Dispara a tradução heurística das palavras. */
  translate: (words: string[]) => void;
  /** Limpa a frase e reseta o estado. */
  clear: () => void;
}

/**
 * Hook que gerencia a tradução heurística de palavras → frase.
 * Sem dependência de IA externa ou downloads.
 */
export function useTranslator(): UseTranslatorReturn {
  const [status, setStatus] = useState<TranslatorStatus>('idle');
  const [frase, setFrase] = useState('');
  const [error, setError] = useState<string | null>(null);

  const translate = useCallback((words: string[]) => {
    if (words.length === 0) return;

    try {
      setError(null);
      setStatus('translating');
      setFrase('');

      const result = heuristicTranslate(words);
      setFrase(result.frase);
      setStatus('ready');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar frase.';
      setError(msg);
      setStatus('error');
      console.error('[useTranslator] Erro:', msg);
    }
  }, []);

  const clear = useCallback(() => {
    setStatus('idle');
    setFrase('');
    setError(null);
  }, []);

  return {
    status,
    frase,
    error,
    translate,
    clear,
  };
}
