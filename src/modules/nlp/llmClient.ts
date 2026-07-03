import type { TranslationResult, DownloadProgress } from '@/types/translation';

/** Modelo padrão. */
const DEFAULT_MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';

/**
 * Detecta se WebGPU está disponível no navegador.
 */
export function detectWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/**
 * Tradução heurística (fallback quando sem WebGPU).
 * Template SVO simples: junta palavras, capitaliza, adiciona ponto.
 */
export function heuristicTranslate(
  words: string[],
  idioma: string = 'pt-BR',
): TranslationResult {
  if (words.length === 0) {
    return {
      frase: '',
      idioma: idioma as TranslationResult['idioma'],
      modo: 'heuristico',
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
    modo: 'heuristico',
    timestamp: Date.now(),
  };
}

/**
 * Monta o prompt conforme especificação do design.md.
 */
export function buildPrompt(words: string[], idioma: string): string {
  const idiomaNome = idioma === 'pt-BR' ? 'português' : idioma === 'en' ? 'inglês' : 'espanhol';
  const palavras = words.join(' ');
  return [
    'Você é um tradutor de LIBRAS. Transforme as seguintes palavras extraídas de sinais em uma frase fluente, natural e gramaticalmente correta em ' + idiomaNome + '.',
    'Retorne APENAS a frase traduzida, sem explicações.',
    'Palavras: ' + palavras,
    'Frase:',
  ].join('\n');
}

/** Tipo genérico para o pipeline — evita import pesado no módulo. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TextGenerator = any;

/**
 * Carrega o pipeline de text-generation via Transformers.js.
 * O download do modelo é cacheado pelo navegador (Cache API).
 *
 * @param onProgress - Callback com progresso detalhado do download.
 * @returns Pipeline pronto para uso.
 */
export async function loadLLM(
  onProgress?: (p: DownloadProgress) => void,
): Promise<TextGenerator> {
  // Import dinâmico — o módulo pesa ~10MB e só deve ser carregado quando necessário
  const { pipeline } = await import('@huggingface/transformers');

  console.info('[LLMClient] Carregando LLM:', DEFAULT_MODEL);

  const generator = await pipeline('text-generation', DEFAULT_MODEL, {
    device: 'webgpu',
    dtype: 'q4f16', // quantização 4-bit para reduzir memória
    progress_callback: (p: {
      status: string;
      file?: string;
      progress?: number;
      loaded?: number;
      total?: number;
    }) => {
      onProgress?.({
        status: p.status,
        file: p.file,
        progress: p.progress ?? undefined,
        loaded: p.loaded ?? undefined,
        totalBytes: p.total ?? undefined,
      });
    },
  });

  console.info('[LLMClient] LLM carregado com sucesso.');
  return generator;
}

/**
 * Gera uma frase a partir das palavras usando o LLM.
 *
 * @param generator - Pipeline carregado.
 * @param words - Palavras detectadas.
 * @param idioma - Idioma alvo (pt-BR, en, es).
 * @param maxTokens - Tokens máximos na resposta.
 * @returns Frase gerada.
 */
export async function translateWithLLM(
  generator: TextGenerator,
  words: string[],
  idioma: string = 'pt-BR',
  maxTokens: number = 80,
): Promise<TranslationResult> {
  if (words.length === 0) {
    return {
      frase: '',
      idioma: idioma as TranslationResult['idioma'],
      modo: 'llm',
      timestamp: Date.now(),
    };
  }

  const prompt = buildPrompt(words, idioma);
  console.info('[LLMClient] Prompt:', prompt);

  const output = await generator(prompt, {
    max_new_tokens: maxTokens,
    temperature: 0.7,
    do_sample: false,
  });

  // output[0].generated_text contém o prompt + resposta
  const rawText: string =
    Array.isArray(output) && output.length > 0
      ? (output[0] as { generated_text: string }).generated_text
      : '';

  // Extrair apenas a frase (remover o prompt)
  const frase = extractFrase(rawText, prompt);

  console.info('[LLMClient] Frase gerada:', frase);

  return {
    frase: frase.trim(),
    idioma: idioma as TranslationResult['idioma'],
    modo: 'llm',
    timestamp: Date.now(),
  };
}

/** Extrai a frase da resposta do modelo (remove o prompt do início). */
function extractFrase(rawText: string, prompt: string): string {
  // O modelo instruído retorna o prompt seguido da resposta
  // Tentar remover o prefixo do prompt
  let result = rawText;
  if (result.startsWith(prompt)) {
    result = result.slice(prompt.length);
  }
  // Remover prefixos comuns que o modelo pode adicionar
  result = result.replace(/^(Frase:|Resposta:|Output:)\s*/i, '');
  // Remover quebras de linha extras e espaços
  result = result.replace(/\n+/g, ' ').trim();
  return result;
}
