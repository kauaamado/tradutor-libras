# specs.md - Especificações Técnicas do Tradutor-LIBRAS

## 1. Visão Geral

**Produto:** Aplicação desktop local que captura gestos em LIBRAS via webcam, reconhece os sinais por meio de Visão Computacional e Machine Learning, e converte a sequência de sinais em frases naturais em múltiplos idiomas (português, inglês, espanhol, etc.) utilizando um LLM local (Ollama).

**Metodologia:** Spec-Driven Development (SDD). Cada fase deve ser validada antes de avançar para a próxima.

---

## 2. Requisitos Funcionais

### RF-01: Captura de Vídeo via Webcam
- O sistema deve abrir a webcam do dispositivo e exibir o feed em tempo real.
- O sistema deve processar cada frame individualmente sem acúmulo de lag.
- O sistema deve liberar o recurso da câmera corretamente ao encerrar (`cap.release()`) e fechar todas as janelas OpenCV (`cv2.destroyAllWindows()`).

### RF-02: Rastreamento de Mãos (MediaPipe)
- O sistema deve detectar uma ou duas mãos no frame da webcam.
- O sistema deve extrair os 21 landmarks de cada mão detectada, resultando em 63 valores numéricos por mão (21 pontos × 3 eixos: X, Y, Z).
- O sistema deve validar que nenhum landmark é nulo antes de processar os dados.
- O sistema deve desenhar o esqueleto da mão sobre a imagem exibida ao usuário.

### RF-03: Coleta de Dados para Treinamento
- O sistema deve permitir que o usuário inicie a gravação de um sinal por meio de uma tecla (ex.: 'S').
- O sistema deve solicitar o nome da classe (label) do sinal (ex.: "EU", "QUERER", "ÁGUA").
- O sistema deve capturar N frames consecutivos e extrair as coordenadas dos landmarks.
- O sistema deve salvar os dados em `dataset.csv` com 63 colunas numéricas (landmarks) + 1 coluna de label (string).
- O CSV não deve conter dados nulos ou inconsistências.

### RF-04: Treinamento do Modelo de ML
- O sistema deve carregar dados de `dataset.csv`.
- O sistema deve dividir os dados em treino e teste (80/20).
- O sistema deve treinar um classificador (Random Forest ou SVM) via scikit-learn.
- O sistema deve exibir a acurácia do modelo no terminal.
- O sistema deve salvar o modelo treinado em `model.pkl`.
- A acurácia mínima aceitável é 85%.

### RF-05: Inferência em Tempo Real
- O sistema deve carregar `model.pkl` uma única vez na inicialização.
- O sistema deve, a cada frame com mão detectada, extrair os landmarks, formatá-los como no treinamento e prever a classe usando o modelo.
- O sistema deve exibir a palavra prevista na tela (sobre o feed da webcam).
- O sistema deve implementar lógica de debounce: uma palavra só é confirmada após ser prevista consistentemente por X frames consecutivos.

### RF-06: Geração de Frases via LLM (Ollama)
- O sistema deve manter uma fila de palavras detectadas (ex.: `["EU", "QUERER", "ÁGUA"]`).
- O sistema deve fornecer um gatilho para finalizar a frase (tecla 'Enter' ou gesto de encerramento).
- Quando o gatilho for acionado, o sistema deve enviar uma requisição HTTP para `http://localhost:11434/api/generate` com o prompt contendo a lista de palavras.
- O prompt base: `"Você é um tradutor de LIBRAS. Transforme as seguintes palavras extraídas de sinais em uma frase fluente, natural e gramaticalmente correta em {idioma}. Retorne APENAS a frase traduzida, sem explicações. Palavras: {lista_palavras}"`.
- O sistema deve exibir a frase retornada pelo Ollama na interface.
- O sistema deve implementar timeout e retry condicional nas requisições ao Ollama.
- O sistema nunca deve bloquear a thread principal aguardando resposta do LLM.

### RF-07: Suporte Multilíngue
- O sistema deve permitir ao usuário selecionar o idioma de saída da tradução (português-BR, inglês, espanhol, etc.).
- O idioma selecionado deve ser injetado no prompt enviado ao LLM.

---

## 3. Requisitos Não Funcionais

| ID | Requisito | Detalhamento |
|----|-----------|-------------|
| RNF-01 | Performance | O processamento de cada frame deve ocorrer em tempo real (máximo ~30ms por frame para manter 30fps). |
| RNF-02 | Confiabilidade | Falhas na webcam ou no Ollama não devem causar crash da aplicação. Exceções devem ser tratadas e logadas. |
| RNF-03 | Portabilidade | A aplicação deve rodar localmente sem dependência de serviços em nuvem. |
| RNF-04 | Logging | Todas as operações críticas (inicialização, carregamento de modelo, requisições ao LLM, erros) devem ser registradas via módulo `logging` do Python. |
| RNF-05 | Modularidade | O sistema deve ser dividido em módulos independentes (captura, treinamento, inferência, NLP). A falha de um módulo não deve derrubar os demais. |
| RNF-06 | Extensibilidade | O modelo de ML e o LLM devem ser intercambiáveis. Deve ser possível trocar o classificador ou o modelo do Ollama sem alterar a estrutura do projeto. |

---

## 4. Stack Tecnológica

| Componente | Tecnologia | Versão Mínima |
|-----------|-----------|---------------|
| Linguagem | Python | 3.10+ |
| Visão Computacional | OpenCV (`opencv-python`) | - |
| Rastreamento de Mãos | MediaPipe | - |
| Machine Learning | scikit-learn, numpy | - |
| LLM Local | Ollama (`llama3` ou `gemma`) | - |
| Interface | OpenCV (janela de vídeo) | - |

---

## 5. Especificações por Fase

### Fase 1: Setup e Rastreamento de Mãos
- **Entrada:** Feed da webcam.
- **Saída:** Frame com esqueleto da mão desenhado.
- **Critério de Aceitação:** A webcam abre sem lag e os landmarks são desenhados corretamente sobre a mão em tempo real.

### Fase 2: Coleta de Dados
- **Entrada:** Tecla do usuário + nome do sinal.
- **Saída:** Arquivo `dataset.csv` com 63 colunas numéricas + 1 label.
- **Critério de Aceitação:** CSV gerado sem dados nulos, com 63 features + label por linha.

### Fase 3: Treinamento do Modelo
- **Entrada:** `dataset.csv`.
- **Saída:** `model.pkl`.
- **Critério de Aceitação:** Script executa sem erros, acurácia > 85%, `model.pkl` gerado e válido.

### Fase 4: Inferência em Tempo Real
- **Entrada:** Feed da webcam + `model.pkl`.
- **Saída:** Palavra prevista sobreposta ao feed de vídeo.
- **Critério de Aceitação:** Sinal correto exibido de forma estável ao realizar gesto treinado.

### Fase 5: Integração com LLM
- **Entrada:** Lista de palavras detectadas + idioma de saída.
- **Saída:** Frase natural no idioma selecionado.
- **Critério de Aceitação:** Array de palavras é enviado ao Ollama e a frase retornada é fluente e gramaticalmente correta.

---

## 6. Estrutura de Arquivos Esperada

```
tradutor-libras/
├── src/
│   ├── captura/          # Módulo de captura e coleta de dados
│   ├── treinamento/      # Módulo de treinamento do modelo
│   ├── inferencia/       # Módulo de inferência em tempo real
│   ├── nlp/              # Módulo de integração com Ollama
│   └── ui/               # Módulo de interface (janela OpenCV)
├── data/
│   ├── dataset.csv       # Dados coletados para treinamento
│   └── model.pkl         # Modelo treinado
├── app.py                # Ponto de entrada da aplicação
├── requirements.txt      # Dependências
└── README.md
```

---

## 7. Dependências Externas

| Dependência | Propósito | Obrigatória? |
|-------------|-----------|-------------|
| Webcam | Captura de vídeo | Sim |
| Ollama (local) | Geração de frases via LLM | Sim (Fase 5+) |

---

## 8. Restrições e Premissas

- A aplicação roda 100% local, sem upload de dados para a nuvem.
- O modelo de ML é treinado apenas para sinais estáticos (não dinâmicos) no MVP.
- O Ollama deve estar em execução local antes do uso do módulo de NLP.
- O idioma padrão é português-BR, mas o sistema suporta seleção de idioma.