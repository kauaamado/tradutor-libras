import { describe, it, expect } from 'vitest';

import { heuristicTranslate } from '@/modules/nlp/llmClient';

// ---------------------------------------------------------------------------
// heuristicTranslate
// ---------------------------------------------------------------------------
describe('heuristicTranslate', () => {
  it('junta palavras com espaço e adiciona ponto', () => {
    const result = heuristicTranslate(['EU', 'QUERER', 'ÁGUA']);
    expect(result.frase).toBe('Eu querer água.');
    expect(result.idioma).toBe('pt-BR');
  });

  it('capitaliza primeira letra', () => {
    const result = heuristicTranslate(['ola', 'mundo']);
    expect(result.frase).toBe('Ola mundo.');
  });

  it('não duplica ponto final', () => {
    const result = heuristicTranslate(['ok']);
    expect(result.frase).toBe('Ok.');
  });

  it('retorna frase vazia para array vazio', () => {
    const result = heuristicTranslate([]);
    expect(result.frase).toBe('');
  });

  it('respeita idioma informado', () => {
    const result = heuristicTranslate(['HELLO'], 'en');
    expect(result.idioma).toBe('en');
    expect(result.frase).toBe('Hello.');
  });
});
