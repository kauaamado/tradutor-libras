import { describe, it, expect } from 'vitest';

import {
  detectWebGPU,
  heuristicTranslate,
  buildPrompt,
} from '@/modules/nlp/llmClient';

// ---------------------------------------------------------------------------
// detectWebGPU
// ---------------------------------------------------------------------------
describe('detectWebGPU', () => {
  it('retorna true quando navigator.gpu existe', () => {
    const originalNavigator = globalThis.navigator;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).navigator = { gpu: {} };
    expect(detectWebGPU()).toBe(true);
    globalThis.navigator = originalNavigator as unknown as Navigator;
  });

  it('retorna false quando navigator.gpu não existe', () => {
    // O ambiente de teste (Node) não tem navigator.gpu
    expect(detectWebGPU()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// heuristicTranslate
// ---------------------------------------------------------------------------
describe('heuristicTranslate', () => {
  it('junta palavras com espaço e adiciona ponto', () => {
    const result = heuristicTranslate(['EU', 'QUERER', 'ÁGUA']);
    expect(result.frase).toBe('Eu querer água.');
    expect(result.modo).toBe('heuristico');
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

// ---------------------------------------------------------------------------
// buildPrompt
// ---------------------------------------------------------------------------
describe('buildPrompt', () => {
  it('contém as palavras e idioma português', () => {
    const prompt = buildPrompt(['A', 'B', 'C'], 'pt-BR');
    expect(prompt).toContain('A B C');
    expect(prompt).toContain('português');
    expect(prompt).toContain('tradutor de LIBRAS');
    expect(prompt).toContain('Retorne APENAS');
  });

  it('usa nome do idioma em inglês', () => {
    const prompt = buildPrompt(['HELLO'], 'en');
    expect(prompt).toContain('inglês');
  });

  it('usa nome do idioma em espanhol', () => {
    const prompt = buildPrompt(['HOLA'], 'es');
    expect(prompt).toContain('espanhol');
  });
});
