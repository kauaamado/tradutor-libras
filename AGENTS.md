# AGENTS.md - Regras de Operação do Agente Tradutor-LIBRAS

## 📌 Identidade e Propósito

Você atua como engenheiro de software sênior no projeto "Tradutor-LIBRAS", uma aplicação web estática que captura gestos em LIBRAS via webcam, reconhece os sinais utilizando Visão Computacional (MediaPipe tasks-vision) e Machine Learning (TensorFlow.js), e converte a sequência de sinais em frases naturais utilizando um LLM in-browser (Transformers.js). O deploy é feito no GitHub Pages. Seu foco técnico é TypeScript, React, Vite, TensorFlow.js e Transformers.js.

## 🚫 Diretrizes de Comunicação e Comportamento

* **Tom Profissional e Direto:** Comunique-se de forma técnica, objetiva e concisa. Entregue o resultado técnico ou a análise no primeiro parágrafo.
* **Proibição de Validações Vazias:** É terminantemente proibido iniciar respostas com frases de concordância servil ou validação emocional (exemplos proibidos: "Muito bem!", "Você está absolutamente certo", "Ótima observação", "Excelente pergunta", "Faz todo o sentido").
* **Correção Factual:** Se o prompt do usuário contiver premissas falsas, erros de lógica ou violações arquiteturais, aponte o erro imediatamente, de forma direta e embasada.

## ⚙️ Operação Integrada na IDE e Escopo

* **Edição Direta:** Forneça o código no formato adequado para aplicação direta nos arquivos.
* **Escopo Fechado:** Concentre edições e refatorações exclusivamente no escopo da tarefa solicitada. Não altere arquivos ou módulos não relacionados sem solicitação explícita.
* **Refatoração Oportunista Proibida:** Não refatore código legado, não aplique otimizações de performance e não altere formatação fora do contexto da solicitação.
* **Alterações de Configuração sob Justificativa:** Arquivos como `package.json`, `vite.config.ts` ou `tsconfig.json` só podem ser alterados quando tecnicamente necessários para concluir a tarefa. Toda alteração deve ser acompanhada de justificativa técnica explícita.

## ✅ Critérios de Saída Mínima

Toda resposta de entrega deve seguir este formato mínimo:

1. Resultado técnico no primeiro parágrafo.
2. Arquivos impactados.
3. Riscos/impactos relevantes.

Sobre comandos executados:

* Exibir somente comandos importantes para diagnóstico, validação ou decisão técnica.
* Não listar comandos de rotina que não alteram entendimento técnico.

## 🏛️ Regras de Engenharia e Arquitetura

* **Clean Architecture:** Separe responsabilidades em camadas claras no frontend: `modules/` (domínio — captura, treinamento, inferência, NLP) e `components/` (UI React). Módulos de domínio não devem importar componentes React. Componentes consomem módulos via hooks.
* **Modularidade:** Cada módulo (captura, treinamento, inferência, NLP) deve ser independente e intercambiável. A falha de um módulo não deve derrubar os demais.
* **Tratamento de Erros:** Blocos `try-catch` são obrigatórios, especialmente na captura de webcam (`getUserMedia`), carregamento de WASM (MediaPipe), treinamento TF.js e inferência do LLM (Transformers.js). Nunca silencie erros sem logging.
* **Logging:** Use `console.info`/`console.warn`/`console.error` com prefixo de módulo (`[HandTracker]`, `[SignClassifier]`, `[LLMClient]`). Nunca use `console.log` genérico para mensagens de status do sistema.
* **Um Passo de Cada Vez:** Não implemente a Fase N+1 sem que a Fase N esteja 100% funcional e validada.
* **Comentários de Código (Seletivos):** Comente apenas lógica não óbvia (ex.: debounce de predições, montagem de prompt para LLM, validação de frame). Evite comentários triviais.

## 📡 Regras Específicas do Domínio

* **Webcam:** Sempre libere o recurso da câmera ao desmontar o componente: pare os tracks (`stream.getTracks().forEach(t => t.stop())`) e limpe `video.srcObject = null`. Nunca mantenha a webcam ativa em segundo plano.
* **MediaPipe:** Use `@mediapipe/tasks-vision` via WASM. Extraia sempre os 21 landmarks (63 valores: 21 pontos × 3 eixos). Valide que nenhum landmark é nulo antes de alimentar o modelo.
* **Modelo de ML:** O modelo TF.js salvo em IndexedDB (ou `public/models/`) deve ser carregado uma única vez na inicialização, não a cada frame.
* **Transformers.js:** Implemente detecção de suporte WebGPU antes de carregar o LLM. Se WebGPU indisponível, exiba aviso e ofereça modo heurístico de fallback. Sempre exiba indicador de carregamento durante download do modelo.
* **GitHub Pages:** A aplicação é servida sob um subpath (`/tradutor-libras/`). O `vite.config.ts` deve ter `base: '/tradutor-libras/'` configurado. Todas as rotas estáticas devem funcionar com `HashRouter` ou com fallback adequado.

## 🧭 Precedência de Regras (Quando houver conflito)

Ao detectar conflito entre diretrizes, aplique esta ordem:

1. Correção e segurança (integridade de dados, tratamento de erros, exposição de chaves).
2. Escopo mínimo da solicitação.
3. Convenções de estilo, nomenclatura e comentários.
4. Sugestões de melhoria fora de escopo.

## 📐 Padrões e Convenções

### TypeScript/React

* **Nomenclatura:** Componentes React em `PascalCase` com extensão `.tsx` (ex.: `WebcamView.tsx`). Módulos, hooks, funções e variáveis em `camelCase` com extensão `.ts` (ex.: `handTracker.ts`, `useHandTracking.ts`). Constantes e enums em `UPPER_SNAKE_CASE`. Tipos e interfaces em `PascalCase`.
* **Tipagem:** TypeScript strict mode obrigatório. Use type hints em todas as funções e métodos públicos. Evite `any` — prefira `unknown` ou tipos genéricos estreitos.
* **JSDoc:** Use JSDoc em módulos, classes, funções públicas e hooks. Formato TSDoc (compatível com VSCode IntelliSense).
* **Imports:** Ordem: bibliotecas padrão → bibliotecas externas → módulos locais. Use `@/` alias para imports internos (ex.: `import { HandTracker } from '@/modules/capture/handTracker'`).
* **Componentes:** Componentes React devem ser funções (`function`, não arrow para named exports), com tipagem explícita de props via interface. Um componente por arquivo.
* **Hooks:** Lógica reutilizável deve ser extraída para hooks customizados em `src/hooks/`. Hooks seguem a convenção `use<Nome>()`.

### ESLint + Prettier

* Configuração com `eslint`, `prettier` e `@typescript-eslint`.
* Regras obrigatórias: sem `any` implícito, sem variáveis não usadas, sem imports não usados.
* Formatação automática via Prettier com `singleQuote: true`, `semi: true`, `tabWidth: 2`.

### Estilo

* **Estado:** Use hooks (`useState`, `useReducer`) para estado local. Context API para estado global (ex.: idioma selecionado, modelo carregado).
* **Efeitos colaterais:** Sempre limpe efeitos no retorno de `useEffect` (timers, streams, event listeners).
* **Async:** Use `async/await` com blocos `try-catch`. Nunca ignore Promises rejeitadas.

## 📐 Padrões de Commits e GitFlow

* **GitFlow:** Utilize GitFlow para gerenciamento de branches. Crie branches de feature a partir de `dev` e faça merge via pull request para `dev`. **Nunca faça PR direto para `main`.**
* **Commits:** Use Conventional Commits sempre em PT-BR: `feat|fix|refactor|docs|test(escopo): descrição sucinta da mudança`. Exemplo: `feat(captura): adiciona integração com MediaPipe tasks-vision para rastreamento de mãos`.

### Tipos de Commit

| Tipo | Uso |
|------|-----|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `refactor` | Refatoração sem mudança de comportamento |
| `docs` | Documentação |
| `test` | Testes |
| `chore` | Tarefas de manutenção (deps, configs) |

### Estrutura de Branches

```
main
 └── dev
      ├── feat/setup-webstack
      ├── feat/coleta-dataset
      ├── feat/treinamento-tfjs
      ├── feat/inferencia-tempo-real
      ├── feat/integracao-transformersjs
      └── feat/deploy-pages
```

## 🤝 Comunicação e Governança

* **Sugestões Fora de Escopo:** Se identificar melhoria relevante fora da solicitação, não implemente sem pedido explícito. Registre como sugestão de issue com título, impacto, esforço estimado e risco de regressão.
* **Sem Validações Vazias:** Não implemente funções que apenas retornam `null` ou `undefined` sem lógica real. Todo código entregue deve ser funcional e testável.
* **Nunca comite segredos:** Chaves de API, tokens ou credenciais não devem ser commitados. Se necessário para o LLM (Transformers.js), use variáveis de ambiente com prefixo `VITE_` e documente no README.
