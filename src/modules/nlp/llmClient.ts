import type { TranslationResult } from '@/types/translation';

/**
 * Tradução heurística — junta palavras, capitaliza, adiciona ponto.
 * Sem dependência de IA externa, sem download de modelo.
 */
export function heuristicTranslate(
  words: string[],
  idioma: string = 'pt-BR',
): TranslationResult {
  if (words.length === 0) {
    return {
      frase: '',
      idioma: idioma as TranslationResult['idioma'],
      timestamp: Date.now(),
    };
  }

  const joined = words.join(' ').toLowerCase();
  const frase =
    joined.charAt(0).toUpperCase() + joined.slice(1) +
    (joined.endsWith('.') ? '' : '.');

  console.info('[LLMClient] Heurística:', frase);

  return {
    frase,
    idioma: idioma as TranslationResult['idioma'],
    timestamp: Date.now(),
  };
}
